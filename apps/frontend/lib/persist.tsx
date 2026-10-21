import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import {
  type DehydratedState,
  hashKey,
  IsRestoringProvider,
  type QueryKey,
  useQueryClient,
} from '@tanstack/react-query'
import {
  type PersistedClient,
  persistQueryClientRestore,
  persistQueryClientSubscribe,
} from '@tanstack/react-query-persist-client'
import {
  compileTemplate,
  parseSheet,
  type SheetModel,
  UnsupportedTemplateError,
} from '@tms/sheet-core'
import Constants from 'expo-constants'
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  type KeyValueStorage,
  scopeStorage,
  type UserStorage,
} from '../sheet/sync/kv'
import { useSession } from './session/SessionProvider'

// Cache de leitura persistido (doc/arquitetura §7.1 e §7.2): só templates e
// fichas, por usuário, apagado no logout. O que vem do disco é input hostil:
// o template passa por compileTemplate, a ficha pelo validador do template
// da versão dela; o resto é descartado (e rebuscado quando houver rede).

export const CACHE_KEY = 'query-cache'
export const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000
// Outra versão do app descarta o cache inteiro
export const APP_VERSION = Constants.expoConfig?.version ?? '0'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ROLES = new Set(['owner', 'storyteller'])

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
const isText = (v: unknown, max = 200): v is string =>
  typeof v === 'string' && v.length <= max

type Persistable =
  | {
      readonly kind: 'template'
      readonly code: string
      readonly version: string
    }
  | { readonly kind: 'character'; readonly id: string }

/** As queries que vão para o disco: o template de uma versão e a ficha. */
export function persistable(key: QueryKey): Persistable | null {
  if (key.length === 3 && key[0] === 'templates') {
    const [, code, version] = key
    if (isText(code, 64) && isText(version, 32) && version !== 'latest')
      return { kind: 'template', code, version }
  }
  if (key.length === 2 && key[0] === 'characters') {
    const [, id] = key
    if (typeof id === 'string' && UUID.test(id))
      return { kind: 'character', id }
  }
  return null
}

const compile = (json: unknown): SheetModel | null => {
  try {
    return compileTemplate(json)
  } catch (e) {
    if (e instanceof UnsupportedTemplateError) return null
    return null
  }
}

/** A ficha do cache, se a forma bater com a da API e a ficha validar. */
function validCharacter(
  id: string,
  data: unknown,
  templates: ReadonlyMap<string, SheetModel>
): boolean {
  if (!isObject(data) || data.id !== id) return false
  const { name, systemCode, templateVersion, sheetVersion, roles, chronicle } =
    data
  if (!isText(name) || !isText(systemCode, 64) || !isText(templateVersion, 32))
    return false
  if (!Number.isInteger(sheetVersion) || (sheetVersion as number) < 0)
    return false
  if (!Array.isArray(roles) || !roles.every(r => ROLES.has(r as string)))
    return false
  if (!isObject(chronicle) || !isText(chronicle.id) || !isText(chronicle.name))
    return false
  const model = templates.get(`${systemCode}@${templateVersion}`)
  return Boolean(model && parseSheet(model, data.sheet).ok)
}

const EMPTY: PersistedClient = {
  buster: '',
  timestamp: 0,
  clientState: { queries: [], mutations: [] },
}

/**
 * O cliente persistido, só com o que passou na validação. Sem `timestamp`
 * válido o TanStack descarta tudo (removeClient).
 */
export function sanitizeClient(raw: unknown): PersistedClient {
  if (!isObject(raw) || !isObject(raw.clientState)) return EMPTY
  const { buster, timestamp, clientState } = raw
  if (typeof buster !== 'string' || typeof timestamp !== 'number') return EMPTY
  const queries = Array.isArray(clientState.queries) ? clientState.queries : []

  const entries: {
    key: QueryKey
    what: Persistable
    data: unknown
    at: number
  }[] = []
  for (const q of queries) {
    if (!isObject(q) || !Array.isArray(q.queryKey) || !isObject(q.state))
      continue
    const what = persistable(q.queryKey)
    // O último dado bom vale, mesmo que o refetch seguinte tenha falhado
    // (offline, a ficha em "error" ainda tem os dados)
    const ok = q.state.status === 'success' || q.state.status === 'error'
    if (!what || !ok || q.state.data === undefined) continue
    const at = q.state.dataUpdatedAt
    entries.push({
      key: q.queryKey,
      what,
      data: q.state.data,
      at: typeof at === 'number' && Number.isFinite(at) ? at : 0,
    })
  }

  // Templates primeiro: a ficha valida contra o template da versão dela
  const templates = new Map<string, SheetModel>()
  const kept: typeof entries = []
  for (const e of entries) {
    if (e.what.kind !== 'template') continue
    const model = compile(e.data)
    if (!model) continue
    templates.set(`${e.what.code}@${e.what.version}`, model)
    kept.push(e)
  }
  for (const e of entries)
    if (
      e.what.kind === 'character' &&
      validCharacter(e.what.id, e.data, templates)
    )
      kept.push(e)

  const state: DehydratedState = {
    mutations: [],
    queries: kept.map(e => ({
      queryKey: e.key,
      // Recalculado: um hash adulterado não cria entrada fantasma no cache
      queryHash: hashKey(e.key),
      dehydratedAt: timestamp,
      state: {
        data: e.data,
        dataUpdateCount: 1,
        dataUpdatedAt: e.at,
        error: null,
        errorUpdateCount: 0,
        errorUpdatedAt: 0,
        fetchFailureCount: 0,
        fetchFailureReason: null,
        fetchMeta: null,
        isInvalidated: false,
        status: 'success',
        fetchStatus: 'idle',
      },
    })),
  }
  return { buster, timestamp, clientState: state }
}

export function createCachePersister(storage: KeyValueStorage) {
  return createAsyncStoragePersister({
    storage,
    key: CACHE_KEY,
    // Rápido: quem abre a ficha e perde a rede logo em seguida precisa dela no
    // disco (o outbox já é gravado na hora). O cache é pequeno (templates e
    // fichas) e só é regravado quando muda
    throttleTime: 200,
    deserialize: text => {
      try {
        return sanitizeClient(JSON.parse(text))
      } catch {
        return EMPTY
      }
    },
  })
}

export const dehydrateOptions = {
  // Com dados, mesmo que o último refetch tenha falhado: sem rede, um refetch
  // que falha não pode apagar a ficha do disco (o cache é regravado inteiro)
  shouldDehydrateQuery: (q: {
    queryKey: QueryKey
    state: { status: string; data?: unknown }
  }) => q.state.data !== undefined && persistable(q.queryKey) !== null,
  // Mutação nunca vai para o disco: o que precisa sobreviver está no outbox
  shouldDehydrateMutation: () => false,
}

const UserStorageContext = createContext<UserStorage | null>(null)

/** O storage do usuário da sessão (null sem sessão ou sem OfflineProvider). */
export const useUserStorage = (): UserStorage | null =>
  useContext(UserStorageContext)

/**
 * Por usuário: restaura o cache dele ao entrar (as queries esperam a
 * restauração), persiste as mudanças e, no logout, fecha e apaga o storage
 * dele. O usuário B nunca lê o que é de A.
 */
export function OfflineProvider({
  storage,
  children,
  buster = APP_VERSION,
  maxAge = CACHE_MAX_AGE_MS,
}: {
  readonly storage: KeyValueStorage
  readonly children: ReactNode
  readonly buster?: string
  readonly maxAge?: number
}) {
  const queryClient = useQueryClient()
  const { status, user, session } = useSession()
  const userId = status === 'signedIn' ? (user?.id ?? null) : null
  const userStorage = useMemo(
    () => (userId ? scopeStorage(storage, userId) : null),
    [storage, userId]
  )
  const [restored, setRestored] = useState<UserStorage | null>(null)

  useEffect(() => {
    if (!userStorage) return
    let alive = true
    let unsubscribe: (() => void) | undefined
    const options = {
      queryClient,
      persister: createCachePersister(userStorage),
      buster,
      maxAge,
      dehydrateOptions,
    }
    persistQueryClientRestore(options)
      .catch(() => undefined)
      .finally(() => {
        if (!alive) return
        // O disco pode estar atrás do servidor (a última confirmação ainda
        // não tinha sido gravada, outra pessoa mexeu): a ficha restaurada
        // abre na hora, mas como velha, e é rebuscada ao montar com rede.
        // O template é imutável por versão e não precisa
        void queryClient.invalidateQueries({
          queryKey: ['characters'],
          refetchType: 'none',
        })
        unsubscribe = persistQueryClientSubscribe(options)
        setRestored(userStorage)
      })
    return () => {
      alive = false
      unsubscribe?.()
    }
  }, [userStorage, queryClient, buster, maxAge])

  useEffect(
    () =>
      session.onSignOut(() => {
        if (!userStorage) return
        userStorage.close()
        void userStorage.clear()
      }),
    [session, userStorage]
  )

  const restoring = userStorage !== null && restored !== userStorage
  return (
    <UserStorageContext.Provider value={userStorage}>
      <IsRestoringProvider value={restoring}>{children}</IsRestoringProvider>
    </UserStorageContext.Provider>
  )
}
