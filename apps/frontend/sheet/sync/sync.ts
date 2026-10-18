import type { QueryClient } from '@tanstack/react-query'
import { chronicleKeys } from '../../lib/queries/chronicles'
import { sheetKeys } from '../data'
import type { SheetStore, SheetSync } from '../store/sheetStore'
import type { Outbox, QueuedBatch } from './outbox'
import { createSender, type PostOutcome, type Sender } from './sender'

// Liga o outbox e o sender às fichas abertas e ao cache do TanStack Query
// (doc/arquitetura §6.6). Uma instância por app; a ficha fechada continua
// sincronizando, e a resposta atualiza o cache mesmo sem tela.

export interface SyncDeps {
  readonly outbox: Outbox
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

export interface Sync extends SheetSync {
  /** A ficha aberta passa a receber as respostas; devolve o "desligar". */
  register(characterId: string, store: SheetStore): () => void
  /** Reconectou: tenta de novo o que esperava o backoff. */
  flush(): Promise<void>
  /** Logout: para o envio e apaga a fila (nada fica para o próximo usuário). */
  reset(): Promise<void>
  readonly sender: Sender
}

interface CharacterCache {
  readonly sheet: unknown
  readonly sheetVersion: number
}

export function rejectionMessage(label: string, status: number): string {
  if (status === 403)
    return `Sem permissão para “${label}”. A alteração foi desfeita.`
  if (status === 404)
    return `A ficha não está mais disponível. “${label}” não foi salva.`
  return `O servidor recusou “${label}”. A alteração foi desfeita.`
}

export function createSync(deps: SyncDeps): Sync {
  const { outbox, queryClient, notify } = deps
  const stores = new Map<string, SheetStore>()
  const refetch = (characterId: string) =>
    queryClient.invalidateQueries({
      queryKey: sheetKeys.character(characterId),
    })

  const sender = createSender({
    outbox,
    post: deps.post,
    random: deps.random,
    baseDelayMs: deps.baseDelayMs,
    events: {
      confirmed(characterId, batch, body) {
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
      conflicted(characterId, batch) {
        stores.get(characterId)?.getState().conflicted(batch.clientBatchId)
        void refetch(characterId)
      },
      rejected(characterId, batch, status) {
        stores.get(characterId)?.getState().rejected(batch.clientBatchId)
        notify(rejectionMessage(batch.label, status))
        if (status === 404) void refetch(characterId)
      },
    },
  })

  return {
    sender,
    enqueue(characterId, batch) {
      outbox.enqueue(characterId, batch).then(
        () => sender.kick(characterId),
        () => {
          stores.get(characterId)?.getState().rejected(batch.clientBatchId)
          notify(`Não foi possível guardar “${batch.label}” no aparelho.`)
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
    async reset() {
      sender.reset()
      stores.clear()
      await outbox.clear()
    },
  }
}
