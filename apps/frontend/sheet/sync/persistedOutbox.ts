import { MAX_EVENTS_PER_BATCH, parsePath } from '@tms/sheet-core'
import type { KeyValueStorage } from './kv'
import {
  batchBytes,
  checkLimits,
  MAX_BATCH_BYTES,
  type Outbox,
  type QueuedBatch,
} from './outbox'

// O outbox no storage do aparelho (doc/arquitetura §7.3), com a mesma
// interface e os mesmos limites do outbox em memória. Uma chave por ficha
// (`outbox:<id>`) com a lista em ordem. Reiniciar o app não perde nada.
//
// O que vem do disco é input hostil (§7.2): JSON quebrado, lote com forma
// errada ou id estranho é descartado (e a ficha é rebuscada do servidor).

const KEY = 'outbox:'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_LABEL = 200

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/** O lote, se a forma bater com a que o servidor aceita; senão null. */
export function parseQueuedBatch(raw: unknown): QueuedBatch | null {
  if (!isObject(raw)) return null
  const { clientBatchId, events, label } = raw
  if (typeof clientBatchId !== 'string' || !UUID.test(clientBatchId))
    return null
  if (typeof label !== 'string' || label.length > MAX_LABEL) return null
  if (
    !Array.isArray(events) ||
    events.length === 0 ||
    events.length > MAX_EVENTS_PER_BATCH
  )
    return null
  const parsed = []
  for (const e of events) {
    if (!isObject(e) || !Object.hasOwn(e, 'to') || !parsePath(e.path))
      return null
    parsed.push({ path: e.path as string, from: e.from ?? null, to: e.to })
  }
  const batch: QueuedBatch = { clientBatchId, events: parsed, label }
  return batchBytes(batch) > MAX_BATCH_BYTES ? null : batch
}

export function createPersistedOutbox(storage: KeyValueStorage): Outbox {
  // Uma operação por vez: enqueue e ack concorrentes não perdem gravação
  let chain: Promise<unknown> = Promise.resolve()
  const serial = <T>(work: () => Promise<T>): Promise<T> => {
    const next = chain.then(work, work)
    chain = next.catch(() => undefined)
    return next
  }

  const read = async (characterId: string): Promise<QueuedBatch[]> => {
    const key = KEY + characterId
    const text = await storage.getItem(key)
    if (text === null) return []
    let raw: unknown
    try {
      raw = JSON.parse(text)
    } catch {
      await storage.removeItem(key)
      return []
    }
    if (!Array.isArray(raw)) {
      await storage.removeItem(key)
      return []
    }
    const seen = new Set<string>()
    const batches: QueuedBatch[] = []
    for (const item of raw) {
      const batch = parseQueuedBatch(item)
      if (!batch || seen.has(batch.clientBatchId)) continue
      seen.add(batch.clientBatchId)
      batches.push(batch)
    }
    // Descartou alguma coisa: o disco fica igual ao que sobrou
    if (batches.length !== raw.length) await write(characterId, batches)
    return batches
  }

  const write = async (characterId: string, batches: QueuedBatch[]) => {
    const key = KEY + characterId
    if (batches.length) await storage.setItem(key, JSON.stringify(batches))
    else await storage.removeItem(key)
  }

  const characters = async (): Promise<string[]> => {
    const ids: string[] = []
    for (const key of await storage.keys(KEY)) {
      const id = key.slice(KEY.length)
      if (UUID.test(id)) ids.push(id)
      else await storage.removeItem(key)
    }
    return ids
  }

  const remove = (clientBatchId: string) =>
    serial(async () => {
      for (const id of await characters()) {
        const batches = await read(id)
        const next = batches.filter(b => b.clientBatchId !== clientBatchId)
        if (next.length !== batches.length) {
          await write(id, next)
          return
        }
      }
    })

  return {
    enqueue: (characterId, batch) =>
      serial(async () => {
        if (!UUID.test(characterId)) throw new Error('ficha inválida')
        const queue = await read(characterId)
        if (queue.some(b => b.clientBatchId === batch.clientBatchId)) return
        checkLimits(batch, queue.length)
        const clean = parseQueuedBatch(batch)
        if (!clean) throw new Error('lote com forma inválida')
        await write(characterId, [...queue, clean])
      }),
    pending: characterId =>
      serial(() =>
        UUID.test(characterId) ? read(characterId) : Promise.resolve([])
      ),
    characters: () =>
      serial(async () => {
        const ids = await characters()
        // Só as que ainda têm lote válido
        const withBatches: string[] = []
        for (const id of ids) if ((await read(id)).length) withBatches.push(id)
        return withBatches
      }),
    ack: remove,
    drop: remove,
    clear: () =>
      serial(async () => {
        for (const key of await storage.keys(KEY)) await storage.removeItem(key)
      }),
  }
}
