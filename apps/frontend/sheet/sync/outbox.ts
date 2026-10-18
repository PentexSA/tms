import { type EventBatch, MAX_EVENTS_PER_BATCH } from '@tms/sheet-core'

// Lotes ainda não confirmados pelo servidor (doc/arquitetura §7.3). Nesta
// etapa a fila é em memória; a Etapa 20 troca por storage persistido sem mudar
// a interface. Tokens nunca entram aqui: só o lote e o rótulo do aviso.

/** Um lote na fila: o EventBatch do core e o rótulo do aviso ("Sangue −1"). */
export interface QueuedBatch extends EventBatch {
  readonly label: string
  // Veio do "Salvar" de Evoluir: recusado (422), volta como rascunho. Fica
  // no aparelho; a API recebe só clientBatchId e events.
  readonly draft?: boolean
}

export interface Outbox {
  enqueue(characterId: string, batch: QueuedBatch): Promise<void>
  /** Os lotes da ficha, na ordem em que entraram (FIFO). */
  pending(characterId: string): Promise<QueuedBatch[]>
  /** Fichas com lote pendente (para retomar o envio ao abrir o app). */
  characters(): Promise<string[]>
  /** Confirmado pelo servidor. */
  ack(clientBatchId: string): Promise<void>
  /** Rejeitado: não tenta de novo. */
  drop(clientBatchId: string): Promise<void>
  /** Logout: nada de um usuário fica para o próximo. */
  clear(): Promise<void>
}

// Iguais aos do servidor (apps/api/src/sheets/events.ts): o que passaria
// daqui seria recusado lá.
export const MAX_BATCH_BYTES = 64 * 1024
export const MAX_PENDING_PER_CHARACTER = 200

export class OutboxLimitError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OutboxLimitError'
  }
}

/** Bytes do corpo que vai para `POST /characters/:id/events`. */
export const batchBytes = (batch: EventBatch): number =>
  new TextEncoder().encode(
    JSON.stringify({ clientBatchId: batch.clientBatchId, events: batch.events })
  ).length

/** Confere os limites antes de enfileirar; lança OutboxLimitError. */
export function checkLimits(batch: EventBatch, alreadyPending: number): void {
  if (batch.events.length === 0 || batch.events.length > MAX_EVENTS_PER_BATCH)
    throw new OutboxLimitError(
      `O lote precisa ter de 1 a ${MAX_EVENTS_PER_BATCH} alterações.`
    )
  if (batchBytes(batch) > MAX_BATCH_BYTES)
    throw new OutboxLimitError('Alteração grande demais para enviar.')
  if (alreadyPending >= MAX_PENDING_PER_CHARACTER)
    throw new OutboxLimitError(
      'Muitas alterações esperando a conexão. Aguarde sincronizar.'
    )
}

export function createMemoryOutbox(): Outbox {
  const queues = new Map<string, QueuedBatch[]>()
  const remove = (clientBatchId: string) => {
    for (const [id, queue] of queues) {
      const next = queue.filter(b => b.clientBatchId !== clientBatchId)
      if (next.length === queue.length) continue
      if (next.length) queues.set(id, next)
      else queues.delete(id)
      return
    }
  }
  return {
    async enqueue(characterId, batch) {
      const queue = queues.get(characterId) ?? []
      if (queue.some(b => b.clientBatchId === batch.clientBatchId)) return
      checkLimits(batch, queue.length)
      queues.set(characterId, [...queue, batch])
    },
    async pending(characterId) {
      return [...(queues.get(characterId) ?? [])]
    },
    async characters() {
      return [...queues.keys()]
    },
    async ack(clientBatchId) {
      remove(clientBatchId)
    },
    async drop(clientBatchId) {
      remove(clientBatchId)
    },
    async clear() {
      queues.clear()
    },
  }
}
