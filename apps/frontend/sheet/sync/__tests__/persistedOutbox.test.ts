import { createMemoryStorage } from '../kv'
import { MAX_PENDING_PER_CHARACTER, type QueuedBatch } from '../outbox'
import { createPersistedOutbox, parseQueuedBatch } from '../persistedOutbox'

// Etapa 20: o outbox no storage do aparelho. Mesma interface e limites da
// Etapa 16; sobrevive a reiniciar o app; o que vem do disco é hostil.

const C1 = '00000000-0000-4000-8000-0000000000c1'
const C2 = '00000000-0000-4000-8000-0000000000c2'

const batch = (n: number, extra: Partial<QueuedBatch> = {}): QueuedBatch => ({
  clientBatchId: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  events: [
    { path: 'values.blood', from: { current: n }, to: { current: n - 1 } },
  ],
  label: `#${n}`,
  ...extra,
})

describe('a mesma interface do outbox em memória', () => {
  it('FIFO por ficha, ack, drop, characters e clear', async () => {
    const outbox = createPersistedOutbox(createMemoryStorage())
    await outbox.enqueue(C1, batch(1))
    await outbox.enqueue(C1, batch(2))
    await outbox.enqueue(C2, batch(3))
    await outbox.enqueue(C1, batch(1))
    expect((await outbox.pending(C1)).map(b => b.label)).toEqual(['#1', '#2'])
    expect((await outbox.characters()).sort()).toEqual([C1, C2])
    await outbox.ack(batch(1).clientBatchId)
    await outbox.drop(batch(3).clientBatchId)
    await outbox.drop('desconhecido')
    expect(await outbox.pending(C1)).toEqual([batch(2)])
    expect(await outbox.characters()).toEqual([C1])
    await outbox.clear()
    expect(await outbox.characters()).toEqual([])
  })

  it('os limites do servidor valem aqui também', async () => {
    const outbox = createPersistedOutbox(createMemoryStorage())
    await expect(outbox.enqueue(C1, batch(1, { events: [] }))).rejects.toThrow(
      'de 1 a 50'
    )
    await expect(
      outbox.enqueue(C1, {
        ...batch(1),
        events: [{ path: 'values.notes', from: null, to: 'x'.repeat(70_000) }],
      })
    ).rejects.toThrow('grande demais')
    for (let i = 0; i < MAX_PENDING_PER_CHARACTER; i++)
      await outbox.enqueue(C1, batch(1000 + i))
    await expect(outbox.enqueue(C1, batch(9999))).rejects.toThrow(
      'Aguarde sincronizar'
    )
    await expect(outbox.enqueue('nao-e-uuid', batch(1))).rejects.toThrow()
    expect(await outbox.pending('nao-e-uuid')).toEqual([])
  })

  it('enfileirar em paralelo não perde lote', async () => {
    const outbox = createPersistedOutbox(createMemoryStorage())
    await Promise.all(
      Array.from({ length: 20 }, (_, i) => outbox.enqueue(C1, batch(i + 1)))
    )
    expect((await outbox.pending(C1)).map(b => b.label)).toEqual(
      Array.from({ length: 20 }, (_, i) => `#${i + 1}`)
    )
  })
})

describe('reiniciar o app', () => {
  it('outro outbox sobre o mesmo storage vê os pendentes, na ordem', async () => {
    const storage = createMemoryStorage()
    const before = createPersistedOutbox(storage)
    await before.enqueue(C1, batch(1))
    await before.enqueue(C1, batch(2))
    const after = createPersistedOutbox(storage)
    expect(await after.characters()).toEqual([C1])
    expect((await after.pending(C1)).map(b => b.label)).toEqual(['#1', '#2'])
  })
})

describe('dado adulterado no storage é descartado', () => {
  const key = `outbox:${C1}`

  it.each([
    ['JSON quebrado', '{oi'],
    ['não é lista', JSON.stringify({ a: 1 })],
  ])('%s: a chave inteira some', async (_, text) => {
    const storage = createMemoryStorage()
    await storage.setItem(key, text)
    const outbox = createPersistedOutbox(storage)
    expect(await outbox.pending(C1)).toEqual([])
    expect(await storage.getItem(key)).toBeNull()
  })

  it('só o lote com forma errada sai; os bons ficam, na ordem', async () => {
    const storage = createMemoryStorage()
    const bad = [
      { ...batch(10), clientBatchId: 'abc' },
      { ...batch(11), events: [] },
      {
        ...batch(12),
        events: Array.from({ length: 51 }, () => batch(1).events[0]),
      },
      { ...batch(13), events: [{ path: 'values.__proto__', to: 1 }] },
      { ...batch(14), events: [{ path: 'values.blood.current', to: 1 }] },
      { ...batch(15), events: [{ path: 'values.blood', from: 1 }] },
      { ...batch(16), label: 'x'.repeat(201) },
      { ...batch(17), label: 42 },
      {
        ...batch(18),
        events: [{ path: 'values.notes', from: null, to: 'x'.repeat(70_000) }],
      },
      'texto',
      null,
      [batch(19)],
    ]
    await storage.setItem(
      key,
      JSON.stringify([batch(1), ...bad, batch(2), batch(1)])
    )
    const outbox = createPersistedOutbox(storage)
    expect((await outbox.pending(C1)).map(b => b.label)).toEqual(['#1', '#2'])
    // O disco fica igual ao que sobrou
    expect(JSON.parse((await storage.getItem(key)) ?? '[]')).toHaveLength(2)
  })

  it('chave de ficha com id estranho é apagada', async () => {
    const storage = createMemoryStorage()
    await storage.setItem('outbox:../../x', JSON.stringify([batch(1)]))
    await storage.setItem(`outbox:${C2}`, JSON.stringify([]))
    const outbox = createPersistedOutbox(storage)
    expect(await outbox.characters()).toEqual([])
    expect(await storage.getItem('outbox:../../x')).toBeNull()
  })

  it('o lote volta limpo: só path, from e to', () => {
    const parsed = parseQueuedBatch({
      ...batch(1),
      extra: 'x',
      events: [{ path: 'values.blood', to: 1, evil: true }],
    })
    expect(parsed).toEqual({
      clientBatchId: batch(1).clientBatchId,
      label: '#1',
      events: [{ path: 'values.blood', from: null, to: 1 }],
    })
  })
})
