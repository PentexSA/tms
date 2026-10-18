import {
  hashKey,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'
import { render, waitFor } from '@testing-library/react-native'
import { Text } from 'react-native'
import { useSession } from '../../lib/session/SessionProvider'
import {
  createMemoryStorage,
  type KeyValueStorage,
  userPrefix,
} from '../../sheet/sync/kv'
import { clone, example, templateJson } from '../../test/fixtures'
import { json, memoryStore } from '../../test/session'
import {
  APP_VERSION,
  CACHE_KEY,
  dehydrateOptions,
  OfflineProvider,
  persistable,
  sanitizeClient,
  useUserStorage,
} from '../persist'
import { SessionProvider } from '../session/SessionProvider'
import { Session } from '../session/session'

// Etapa 20: o cache de leitura no aparelho (doc/arquitetura §7.2).

const ID = '00000000-0000-4000-8000-00000000c001'
const A = { id: '00000000-0000-4000-8000-0000000000a1', username: 'ana' }
const B = { id: '00000000-0000-4000-8000-0000000000b2', username: 'bia' }
const TEMPLATE_KEY = ['templates', 'vtm-v20', '1.0.0'] as const
const CHARACTER_KEY = ['characters', ID] as const

const character = (sheet: unknown = example('helena').sheet) => ({
  id: ID,
  name: 'Helena Varga',
  chronicle: { id: 'c1', name: 'Crônica da Liberdade' },
  owner: { id: A.id, username: 'ana' },
  systemCode: 'vtm-v20',
  templateVersion: '1.0.0',
  sheetVersion: 3,
  roles: ['owner'],
  updatedAt: '2026-10-18T12:00:00Z',
  sheet,
})

const query = (queryKey: readonly unknown[], data: unknown) => ({
  queryKey,
  queryHash: hashKey(queryKey),
  state: { data, status: 'success', dataUpdatedAt: 1000 },
})

const client = (queries: unknown[], extra: Record<string, unknown> = {}) => ({
  buster: APP_VERSION,
  timestamp: Date.now(),
  clientState: { queries, mutations: [{ mutationKey: ['x'] }] },
  ...extra,
})

const keysOf = (c: ReturnType<typeof sanitizeClient>) =>
  c.clientState.queries.map(q => q.queryKey)

describe('o que vai para o disco', () => {
  it('só templates de uma versão e fichas', () => {
    expect(persistable(TEMPLATE_KEY)).toEqual({
      kind: 'template',
      code: 'vtm-v20',
      version: '1.0.0',
    })
    expect(persistable(CHARACTER_KEY)).toEqual({ kind: 'character', id: ID })
    expect(persistable(['templates', 'vtm-v20', 'latest'])).toBeNull()
    expect(persistable(['characters', 'nao-uuid'])).toBeNull()
    expect(persistable(['chronicles'])).toBeNull()
    expect(persistable(['chronicles', 'c1', 'invites'])).toBeNull()
    const should = dehydrateOptions.shouldDehydrateQuery
    const data = character()
    expect(
      should({ queryKey: CHARACTER_KEY, state: { status: 'success', data } })
    ).toBe(true)
    // Refetch que falhou sem rede: os dados de antes continuam indo
    expect(
      should({ queryKey: CHARACTER_KEY, state: { status: 'error', data } })
    ).toBe(true)
    expect(
      should({ queryKey: CHARACTER_KEY, state: { status: 'error' } })
    ).toBe(false)
    expect(
      should({ queryKey: ['chronicles'], state: { status: 'success', data } })
    ).toBe(false)
    expect(dehydrateOptions.shouldDehydrateMutation()).toBe(false)
  })
})

describe('o que volta do disco é input hostil', () => {
  it('template e ficha válidos voltam; o resto e as mutações não', () => {
    const restored = sanitizeClient(
      client([
        query(CHARACTER_KEY, character()),
        query(TEMPLATE_KEY, templateJson('vtm-v20')),
        query(['chronicles'], [{ id: 'c1' }]),
        query(['templates', 'vtm-v20', 'latest'], templateJson('vtm-v20')),
      ])
    )
    expect(keysOf(restored)).toEqual([TEMPLATE_KEY, CHARACTER_KEY])
    expect(restored.clientState.mutations).toEqual([])
    expect(restored.clientState.queries[1]?.state.data).toEqual(character())
  })

  it('template adulterado some, e a ficha dele junto', () => {
    const t = templateJson('vtm-v20')
    t.fields = 'nada'
    const restored = sanitizeClient(
      client([query(TEMPLATE_KEY, t), query(CHARACTER_KEY, character())])
    )
    expect(keysOf(restored)).toEqual([])
  })

  it('ficha sem o template da versão dela não volta', () => {
    const restored = sanitizeClient(client([query(CHARACTER_KEY, character())]))
    expect(keysOf(restored)).toEqual([])
  })

  it.each([
    [
      'ficha que não passa no validador',
      { sheet: { values: { strength: 99 } } },
    ],
    ['id diferente da chave', { id: '00000000-0000-4000-8000-00000000c002' }],
    ['papel desconhecido', { roles: ['admin'] }],
    ['versão negativa', { sheetVersion: -1 }],
    ['versão não inteira', { sheetVersion: 1.5 }],
    ['nome que não é texto', { name: 42 }],
    ['crônica sem nome', { chronicle: { id: 'c1' } }],
    ['outro template', { templateVersion: '9.9.9' }],
  ])('%s: descartada', (_, change) => {
    const restored = sanitizeClient(
      client([
        query(TEMPLATE_KEY, templateJson('vtm-v20')),
        query(CHARACTER_KEY, { ...character(), ...change }),
      ])
    )
    expect(keysOf(restored)).toEqual([TEMPLATE_KEY])
  })

  it('ficha cujo último refetch falhou volta com os dados, como sucesso', () => {
    const failed = query(CHARACTER_KEY, character())
    const restored = sanitizeClient(
      client([
        query(TEMPLATE_KEY, templateJson('vtm-v20')),
        { ...failed, state: { ...failed.state, status: 'error', error: {} } },
      ])
    )
    expect(keysOf(restored)).toEqual([TEMPLATE_KEY, CHARACTER_KEY])
    expect(restored.clientState.queries[1]?.state).toMatchObject({
      status: 'success',
      error: null,
      data: character(),
    })
  })

  it('hash adulterado é recalculado; estado de erro não volta', () => {
    const restored = sanitizeClient(
      client([
        {
          ...query(TEMPLATE_KEY, templateJson('vtm-v20')),
          queryHash: '["outra"]',
        },
        { ...query(CHARACTER_KEY, character()), state: { status: 'error' } },
        'lixo',
        { queryKey: 'não é lista', state: {} },
      ])
    )
    expect(restored.clientState.queries.map(q => q.queryHash)).toEqual([
      hashKey(TEMPLATE_KEY),
    ])
  })

  it.each([
    ['nada', null],
    ['sem clientState', { buster: APP_VERSION, timestamp: 1 }],
    ['sem timestamp', { buster: APP_VERSION, clientState: {} }],
    ['buster que não é texto', { buster: 1, timestamp: 1, clientState: {} }],
  ])('%s: vazio, sem timestamp (o TanStack apaga)', (_, raw) => {
    expect(sanitizeClient(raw)).toMatchObject({
      timestamp: 0,
      clientState: { queries: [] },
    })
  })

  it('queries que não são lista viram nenhuma', () => {
    expect(
      keysOf(sanitizeClient(client([], { clientState: { queries: 'x' } })))
    ).toEqual([])
  })
})

// --- OfflineProvider: por usuário, restaura, persiste e apaga no logout ---

function sessionFor(user: typeof A, online = true) {
  return new Session({
    apiUrl: 'http://api.test',
    store: memoryStore(true, 'refresh'),
    fetch: jest.fn(async () => {
      if (!online) throw new Error('Network request failed')
      return json(200, { accessToken: 'a', refreshToken: 'r', user })
    }),
  })
}

function Probe({ onStorage }: { readonly onStorage?: (s: unknown) => void }) {
  const { status } = useSession()
  onStorage?.(useUserStorage())
  return <Text>{status}</Text>
}

function app(storage: KeyValueStorage, session: Session) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { gcTime: Number.POSITIVE_INFINITY } },
  })
  const view = render(
    <QueryClientProvider client={queryClient}>
      <SessionProvider session={session}>
        <OfflineProvider storage={storage}>
          <Probe />
        </OfflineProvider>
      </SessionProvider>
    </QueryClientProvider>
  )
  return { queryClient, view }
}

const seed = (queryClient: QueryClient) => {
  queryClient.setQueryData(TEMPLATE_KEY, templateJson('vtm-v20'))
  queryClient.setQueryData(CHARACTER_KEY, character())
  queryClient.setQueryData(
    ['chronicles'],
    [{ id: 'c1', name: 'lista-que-nao-persiste' }]
  )
}

describe('OfflineProvider', () => {
  it('persiste no storage do usuário e restaura num app novo', async () => {
    const storage = createMemoryStorage()
    const first = app(storage, sessionFor(A))
    await first.view.findByText('signedIn')
    seed(first.queryClient)
    const key = `${userPrefix(A.id)}${CACHE_KEY}`
    await waitFor(() => expect(storage.data.has(key)).toBe(true), {
      timeout: 3000,
    })
    // Só o que pode ir para o disco foi
    await waitFor(
      () => {
        const text = storage.data.get(key) ?? ''
        expect(text).toContain('Helena Varga')
      },
      { timeout: 3000 }
    )
    expect(storage.data.get(key)).not.toContain('lista-que-nao-persiste')
    first.view.unmount()

    const second = app(storage, sessionFor(A))
    await waitFor(() =>
      expect(second.queryClient.getQueryData(CHARACTER_KEY)).toEqual(
        character()
      )
    )
    expect(second.queryClient.getQueryData(['chronicles'])).toBeUndefined()
    // A ficha do disco abre na hora, mas como velha: com rede, é rebuscada
    // ao montar (a última confirmação pode não ter chegado ao disco). O
    // template é imutável por versão e fica fresco
    await waitFor(() =>
      expect(
        second.queryClient.getQueryState(CHARACTER_KEY)?.isInvalidated
      ).toBe(true)
    )
    expect(second.queryClient.getQueryState(TEMPLATE_KEY)?.isInvalidated).toBe(
      false
    )
    second.view.unmount()
  })

  it('o usuário B nunca vê o cache de A', async () => {
    const storage = createMemoryStorage()
    const first = app(storage, sessionFor(A))
    await first.view.findByText('signedIn')
    seed(first.queryClient)
    await waitFor(
      () =>
        expect(storage.data.has(`${userPrefix(A.id)}${CACHE_KEY}`)).toBe(true),
      { timeout: 3000 }
    )
    first.view.unmount()

    const other = app(storage, sessionFor(B))
    await other.view.findByText('signedIn')
    // Dá tempo da restauração terminar
    await new Promise(r => setTimeout(r, 50))
    expect(other.queryClient.getQueryData(CHARACTER_KEY)).toBeUndefined()
    other.view.unmount()
  })

  it('o logout apaga o cache do usuário (e gravação atrasada não volta)', async () => {
    const storage = createMemoryStorage()
    const session = sessionFor(A)
    const first = app(storage, session)
    await first.view.findByText('signedIn')
    seed(first.queryClient)
    await waitFor(
      () =>
        expect(storage.data.has(`${userPrefix(A.id)}${CACHE_KEY}`)).toBe(true),
      { timeout: 3000 }
    )
    // Outra mudança dispara o throttle; o logout chega antes de gravar
    first.queryClient.setQueryData(CHARACTER_KEY, {
      ...character(),
      name: 'Helena V.',
    })
    await session.signOut()
    await first.view.findByText('signedOut')
    await new Promise(r => setTimeout(r, 1200))
    expect(await storage.keys(userPrefix(A.id))).toEqual([])
    first.view.unmount()
  })

  it('cache adulterado ou de outra versão do app é descartado', async () => {
    const storage = createMemoryStorage()
    const key = `${userPrefix(A.id)}${CACHE_KEY}`
    await storage.setItem(key, '{lixo')
    const first = app(storage, sessionFor(A))
    await first.view.findByText('signedIn')
    await waitFor(() => expect(storage.data.has(key)).toBe(false))
    first.view.unmount()

    await storage.setItem(
      key,
      JSON.stringify(
        client(
          [
            query(TEMPLATE_KEY, templateJson('vtm-v20')),
            query(CHARACTER_KEY, character()),
          ],
          { buster: 'outra-versao' }
        )
      )
    )
    const second = app(storage, sessionFor(A))
    await second.view.findByText('signedIn')
    await waitFor(() => expect(storage.data.has(key)).toBe(false))
    expect(second.queryClient.getQueryData(CHARACTER_KEY)).toBeUndefined()
    second.view.unmount()
  })

  it('sem sessão não há storage de usuário', async () => {
    const storage = createMemoryStorage()
    const session = new Session({
      apiUrl: 'http://api.test',
      store: memoryStore(true, null),
      fetch: jest.fn(),
    })
    const seen: unknown[] = []
    const queryClient = new QueryClient()
    const view = render(
      <QueryClientProvider client={queryClient}>
        <SessionProvider session={session}>
          <OfflineProvider storage={storage}>
            <Probe onStorage={s => seen.push(s)} />
          </OfflineProvider>
        </SessionProvider>
      </QueryClientProvider>
    )
    await view.findByText('signedOut')
    expect(seen.at(-1)).toBeNull()
    // Logout sem usuário não quebra
    await session.signOut()
    expect(storage.data.size).toBe(0)
    view.unmount()
  })

  it('o cache restaurado passa pelo validador (clone da ficha intacto)', () => {
    const data = character(clone(example('helena').sheet))
    const restored = sanitizeClient(
      client([
        query(TEMPLATE_KEY, templateJson('vtm-v20')),
        query(CHARACTER_KEY, data),
      ])
    )
    expect(restored.clientState.queries[1]?.state.data).toEqual(data)
  })
})
