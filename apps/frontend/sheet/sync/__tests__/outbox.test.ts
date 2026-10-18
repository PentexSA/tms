import { MAX_EVENTS_PER_BATCH } from '@tms/sheet-core'
import {
  batchBytes,
  checkLimits,
  createMemoryOutbox,
  MAX_BATCH_BYTES,
  MAX_PENDING_PER_CHARACTER,
  OutboxLimitError,
  type QueuedBatch,
} from '../outbox'

const batch = (n: number, events = 1): QueuedBatch => ({
  clientBatchId: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  events: Array.from({ length: events }, () => ({
    path: 'values.blood',
    from: null,
    to: { current: n },
  })),
  label: `#${n}`,
})

describe('outbox em memória (doc/arquitetura §7.3)', () => {
  it('FIFO por ficha; ack e drop tiram da fila; clear apaga tudo', async () => {
    const outbox = createMemoryOutbox()
    await outbox.enqueue('a', batch(1))
    await outbox.enqueue('a', batch(2))
    await outbox.enqueue('b', batch(3))
    expect((await outbox.pending('a')).map(b => b.label)).toEqual(['#1', '#2'])
    expect(await outbox.characters()).toEqual(['a', 'b'])
    await outbox.ack(batch(1).clientBatchId)
    await outbox.drop(batch(3).clientBatchId)
    await outbox.drop('desconhecido')
    expect(await outbox.pending('a')).toEqual([batch(2)])
    expect(await outbox.characters()).toEqual(['a'])
    await outbox.clear()
    expect(await outbox.characters()).toEqual([])
    expect(await outbox.pending('a')).toEqual([])
  })

  it('o mesmo lote enfileirado duas vezes entra uma vez', async () => {
    const outbox = createMemoryOutbox()
    await outbox.enqueue('a', batch(1))
    await outbox.enqueue('a', batch(1))
    expect(await outbox.pending('a')).toHaveLength(1)
  })

  it('pending devolve uma cópia', async () => {
    const outbox = createMemoryOutbox()
    await outbox.enqueue('a', batch(1))
    const list = await outbox.pending('a')
    list.pop()
    expect(await outbox.pending('a')).toHaveLength(1)
  })

  it('os limites são os do servidor', async () => {
    expect(() => checkLimits(batch(1, 0), 0)).toThrow(OutboxLimitError)
    expect(() => checkLimits(batch(1, MAX_EVENTS_PER_BATCH + 1), 0)).toThrow(
      'de 1 a 50'
    )
    const big: QueuedBatch = {
      ...batch(1),
      events: [
        {
          path: 'values.notes',
          from: null,
          to: 'é'.repeat(MAX_BATCH_BYTES / 2),
        },
      ],
    }
    // Bytes, não caracteres: "é" ocupa 2 em UTF-8
    expect(big.events[0]?.to).toHaveLength(MAX_BATCH_BYTES / 2)
    expect(batchBytes(big)).toBeGreaterThan(MAX_BATCH_BYTES)
    expect(() => checkLimits(big, 0)).toThrow('grande demais')
    expect(() => checkLimits(batch(1), MAX_PENDING_PER_CHARACTER)).toThrow(
      'Aguarde sincronizar'
    )
    const outbox = createMemoryOutbox()
    await expect(outbox.enqueue('a', big)).rejects.toBeInstanceOf(
      OutboxLimitError
    )
  })
})
