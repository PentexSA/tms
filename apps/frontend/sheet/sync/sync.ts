import type { QueryClient } from '@tanstack/react-query'
import { type Issue, MAX_EVENTS_PER_BATCH, parsePath } from '@tms/sheet-core'
import { chronicleKeys } from '../../lib/queries/chronicles'
import { sheetKeys } from '../data'
import { refusalCodeOf, refusalReason } from '../policy'
import type {
  ChangedBy,
  ConflictDetail,
  SheetStore,
  SheetSync,
} from '../store/sheetStore'
import { ledgerMessage } from '../xp/messages'
import { createMemoryDraftStore, type DraftStore } from './draftStore'
import type { Outbox, QueuedBatch } from './outbox'
import { createSender, type PostOutcome, type Sender } from './sender'

// Liga o outbox e o sender às fichas abertas e ao cache do TanStack Query
// (doc/arquitetura §6.6). Uma instância por app; a ficha fechada continua
// sincronizando, e a resposta atualiza o cache mesmo sem tela.

export interface SyncDeps {
  readonly outbox: Outbox
  // Os rascunhos de Criação/Editar guardados no aparelho (T-03); sem eles,
  // em memória
  readonly drafts?: DraftStore
  readonly post: (
    characterId: string,
    batch: QueuedBatch
  ) => Promise<PostOutcome>
  readonly queryClient: QueryClient
  /** Aviso para a pessoa (o toast). */
  readonly notify: (message: string) => void
  readonly random?: () => number
  readonly baseDelayMs?: number
}

/**
 * O que o indicador de sincronização mostra. `failure`: por que o último
 * envio não foi (sem resposta ou erro do servidor); limpa quando o servidor
 * responde ou a fila esvazia.
 */
export interface SyncStatus {
  readonly pending: number
  readonly failure: 'network' | 'server' | null
}

export interface SyncStatusStore {
  getSnapshot(): SyncStatus
  subscribe(listener: () => void): () => void
}

export interface Sync extends SheetSync {
  /** A ficha aberta passa a receber as respostas; devolve o "desligar". */
  register(characterId: string, store: SheetStore): () => void
  /** Reconectou: tenta de novo o que esperava o backoff. */
  flush(): Promise<void>
  /**
   * Logout: para o envio e apaga a fila e os rascunhos (nada fica para o
   * próximo usuário).
   */
  reset(): Promise<void>
  /** Abriu o app: conta o que ficou na fila, retoma o envio e varre os rascunhos vencidos. */
  start(): Promise<void>
  /** O lote entrou no outbox (resolve) ou não pôde ser guardado (rejeita). */
  enqueue(characterId: string, batch: QueuedBatch): Promise<void>
  readonly drafts: DraftStore
  readonly status: SyncStatusStore
  readonly sender: Sender
}

interface CharacterCache {
  readonly sheet: unknown
  readonly sheetVersion: number
}

/**
 * As issues de um 422 (`{ path, message }`). A resposta é input hostil: só
 * strings curtas, no máximo 50, e o resto é ignorado.
 */
export function issuesOf(body: unknown): Issue[] {
  const raw = (body as { issues?: unknown } | null)?.issues
  if (!Array.isArray(raw)) return []
  return raw
    .filter(
      (i): i is Issue =>
        typeof i?.path === 'string' &&
        typeof i?.message === 'string' &&
        i.path.length <= 200 &&
        i.message.length <= 200
    )
    .slice(0, 50)
    .map(i => ({ path: i.path, message: i.message }))
}

const CHANGED_BY: ReadonlySet<unknown> = new Set([
  'self',
  'owner',
  'storyteller',
])

/**
 * O corpo de um 409 (`issues` com os caminhos em conflito, `changedBy` com
 * quem mudou cada um). A resposta é input hostil: só caminhos válidos que
 * estão no próprio lote, até 50, e `changedBy` só com os valores conhecidos
 * (o resto vira null). O `current` do corpo é ignorado: o valor atual vem da
 * ficha rebuscada.
 */
export function parseConflictBody(
  body: unknown,
  batch: QueuedBatch
): ConflictDetail {
  const inBatch = new Set(batch.events.map(e => e.path))
  const raw = (body as { issues?: unknown } | null)?.issues
  const paths: string[] = []
  if (Array.isArray(raw))
    for (const issue of raw) {
      const path = (issue as { path?: unknown } | null)?.path
      if (
        typeof path === 'string' &&
        inBatch.has(path) &&
        parsePath(path) &&
        !paths.includes(path)
      )
        paths.push(path)
      if (paths.length >= MAX_EVENTS_PER_BATCH) break
    }
  const by = (body as { changedBy?: unknown } | null)?.changedBy
  const changedBy = new Map<string, ChangedBy>()
  for (const path of paths) {
    const value =
      by && typeof by === 'object' && Object.hasOwn(by, path)
        ? (by as Record<string, unknown>)[path]
        : null
    changedBy.set(path, CHANGED_BY.has(value) ? (value as ChangedBy) : null)
  }
  return { paths, changedBy: Object.fromEntries(changedBy) }
}

/**
 * O aviso de um lote recusado. Um 403 da política traz o motivo (`code`):
 * "O narrador travou a ficha. A alteração foi desfeita."
 */
export function rejectionMessage(
  label: string,
  status: number,
  draft = false,
  body: unknown = null,
  storyteller = false
): string {
  // As projeções do extrato não se gravam por evento (v4, §3.6)
  if (
    status === 403 &&
    (body as { code?: unknown } | null)?.code === 'XP_MANAGED_BY_LEDGER'
  )
    return `${ledgerMessage(storyteller)} A alteração foi desfeita.`
  const why = status === 403 ? refusalReason(refusalCodeOf(body)) : null
  if (why) return `${why} A alteração foi desfeita.`
  if (status === 403)
    return `Sem permissão para “${label}”. A alteração foi desfeita.`
  if (status === 404)
    return `A ficha não está mais disponível. “${label}” não foi salva.`
  // O "Salvar" de Evoluir volta como rascunho, com os campos marcados
  if (status === 422 && draft)
    return `O servidor recusou “${label}”. Confira os campos marcados em Editar.`
  return `O servidor recusou “${label}”. A alteração foi desfeita.`
}

export function createSync(deps: SyncDeps): Sync {
  const { outbox, queryClient, notify } = deps
  const drafts = deps.drafts ?? createMemoryDraftStore()
  const stores = new Map<string, SheetStore>()
  const refetch = (characterId: string) =>
    queryClient.invalidateQueries({
      queryKey: sheetKeys.character(characterId),
    })

  let status: SyncStatus = { pending: 0, failure: null }
  const listeners = new Set<() => void>()
  const setStatus = (next: SyncStatus) => {
    if (next.pending === status.pending && next.failure === status.failure)
      return
    status = next
    for (const l of listeners) l()
  }
  // Conta direto do outbox (a verdade, também depois de reiniciar o app).
  // Só a contagem mais recente vale.
  let counting = 0
  const recount = async () => {
    const mine = ++counting
    let pending = 0
    try {
      for (const id of await outbox.characters())
        pending += (await outbox.pending(id)).length
    } catch {
      return
    }
    if (mine !== counting) return
    setStatus({ pending, failure: pending ? status.failure : null })
  }
  const answered = () => {
    setStatus({ ...status, failure: null })
    void recount()
  }

  const sender = createSender({
    outbox,
    post: deps.post,
    random: deps.random,
    baseDelayMs: deps.baseDelayMs,
    events: {
      retrying(_characterId, _attempt, _delayMs, code) {
        setStatus({ ...status, failure: code === 0 ? 'network' : 'server' })
      },
      confirmed(characterId, batch, body) {
        answered()
        const store = stores.get(characterId)
        store?.getState().confirmed(batch.clientBatchId, body)
        const res = body as Partial<CharacterCache> | null
        if (res && typeof res.sheetVersion === 'number') {
          const { sheet, sheetVersion } = res
          queryClient.setQueryData<CharacterCache>(
            sheetKeys.character(characterId),
            old =>
              old && sheetVersion >= old.sheetVersion
                ? { ...old, sheet, sheetVersion }
                : old
          )
        }
        // O nome aparece no título e na lista da crônica
        const name = store?.getState().model.template.identity.name
        if (!name || batch.events.some(e => e.path === `values.${name}`)) {
          void refetch(characterId)
          void queryClient.invalidateQueries({ queryKey: chronicleKeys.all })
        }
      },
      conflicted(characterId, batch, body) {
        answered()
        stores
          .get(characterId)
          ?.getState()
          .conflicted(batch.clientBatchId, parseConflictBody(body, batch))
        void refetch(characterId)
      },
      rejected(characterId, batch, status, body) {
        answered()
        stores
          .get(characterId)
          ?.getState()
          .rejected(
            batch.clientBatchId,
            status === 422 ? issuesOf(body) : undefined
          )
        notify(
          rejectionMessage(
            batch.label,
            status,
            batch.draft,
            body,
            stores.get(characterId)?.getState().roles.includes('storyteller')
          )
        )
        // A recusa da política diz que o estado mudou (travada, concluída):
        // a ficha rebuscada mostra o motivo no lugar
        if (status === 404 || refusalCodeOf(body)) void refetch(characterId)
      },
    },
  })

  return {
    sender,
    status: {
      getSnapshot: () => status,
      subscribe(listener) {
        listeners.add(listener)
        return () => listeners.delete(listener)
      },
    },
    drafts,
    enqueue(characterId, batch) {
      // A Promise diz se o lote está no outbox: o rascunho persistido só some
      // depois disso (T-03)
      return outbox.enqueue(characterId, batch).then(
        () => {
          void recount()
          void sender.kick(characterId)
        },
        error => {
          stores.get(characterId)?.getState().rejected(batch.clientBatchId)
          notify(`Não foi possível guardar “${batch.label}” no aparelho.`)
          throw error
        }
      )
    },
    register(characterId, store) {
      stores.set(characterId, store)
      // O que ficou na fila (ficha reaberta antes de sincronizar) volta como
      // otimista, e o envio recomeça
      void outbox.pending(characterId).then(batches => {
        if (stores.get(characterId) === store) store.getState().hydrate(batches)
        return sender.kick(characterId)
      })
      return () => {
        if (stores.get(characterId) === store) stores.delete(characterId)
      }
    },
    flush: () => sender.flush(),
    async start() {
      await drafts.sweep(Date.now()).catch(() => undefined)
      await recount()
      await sender.flush()
    },
    async reset() {
      sender.reset()
      stores.clear()
      counting++
      setStatus({ pending: 0, failure: null })
      await Promise.all([
        outbox.clear().catch(() => undefined),
        drafts.clear().catch(() => undefined),
      ])
    },
  }
}
