import { createMemoryOutbox, type Outbox, type QueuedBatch } from '../outbox'
import { createSender, isRetryable, type PostOutcome } from '../sender'

// Etapa 16: o envio da fila (doc/arquitetura §6.6, tabela de respostas), com
// timers falsos.

const batch = (n: number, label = `#${n}`): QueuedBatch => ({
  clientBatchId: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  events: [
    { path: 'values.blood', from: { current: n }, to: { current: n - 1 } },
  ],
  label,
})

interface Deferred {
  resolve(v: PostOutcome): void
  reject(e: unknown): void
}

function setup(outbox: Outbox = createMemoryOutbox()) {
  const inflight: Deferred[] = []
  const post = jest.fn(
    (_id: string, _b: QueuedBatch) =>
      new Promise<PostOutcome>((resolve, reject) =>
        inflight.push({ resolve, reject })
      )
  )
  const events = {
    confirmed: jest.fn(),
    conflicted: jest.fn(),
    rejected: jest.fn(),
    retrying: jest.fn(),
  }
  const sender = createSender({
    outbox,
    post,
    events,
    random: () => 0,
    baseDelayMs: 1000,
    maxDelayMs: 8000,
  })
  /** Responde o envio mais antigo em voo e deixa as promessas andarem. */
  const answer = async (outcome: PostOutcome | Error) => {
    const next = inflight.shift()
    if (!next) throw new Error('nada em voo')
    if (outcome instanceof Error) next.reject(outcome)
    else next.resolve(outcome)
    await flushPromises()
  }
  return { outbox, sender, post, events, answer, inflight }
}

const flushPromises = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve()
}

const ok = (sheetVersion = 1): PostOutcome => ({
  status: 200,
  body: { sheetVersion, sheet: { values: {} } },
})

beforeEach(() => {
  jest.useFakeTimers()
})
afterEach(() => {
  jest.useRealTimers()
})

describe('FIFO por ficha', () => {
  it('um lote em voo por vez, na ordem da fila', async () => {
    const { outbox, sender, post, events, answer } = setup()
    await outbox.enqueue('a', batch(1))
    await outbox.enqueue('a', batch(2))
    void sender.kick('a')
    await flushPromises()
    expect(post).toHaveBeenCalledTimes(1)
    expect(post.mock.calls[0]?.[1].label).toBe('#1')
    // Outro kick enquanto o primeiro voa não manda o segundo junto
    void sender.kick('a')
    await flushPromises()
    expect(post).toHaveBeenCalledTimes(1)

    await answer(ok(1))
    expect(events.confirmed).toHaveBeenCalledWith('a', batch(1), ok(1).body)
    expect(post).toHaveBeenCalledTimes(2)
    expect(post.mock.calls[1]?.[1].label).toBe('#2')
    await answer(ok(2))
    expect(await outbox.pending('a')).toEqual([])
  })

  it('fichas diferentes andam em paralelo', async () => {
    const { outbox, sender, post } = setup()
    await outbox.enqueue('a', batch(1))
    await outbox.enqueue('b', batch(2))
    void sender.kick('a')
    void sender.kick('b')
    await flushPromises()
    expect(post.mock.calls.map(c => c[0])).toEqual(['a', 'b'])
  })

  it('lote que chega enquanto o laço termina também sai', async () => {
    const { outbox, sender, post, answer } = setup()
    await outbox.enqueue('a', batch(1))
    void sender.kick('a')
    await flushPromises()
    await outbox.enqueue('a', batch(2))
    void sender.kick('a')
    await answer(ok())
    expect(post).toHaveBeenCalledTimes(2)
  })
})

describe('tabela de respostas', () => {
  it.each([
    ['sem rede', new Error('Network request failed')],
    ['timeout (sem resposta)', { status: 0, body: null }],
    ['500', { status: 500, body: { error: 'erro interno' } }],
    ['503', { status: 503, body: null }],
    ['408', { status: 408, body: null }],
    ['429', { status: 429, body: null }],
    // O fetch da sessão já tentou renovar; se acabou, o logout limpa a fila
    ['401', { status: 401, body: null }],
  ] as const)(
    '%s: fica na fila e tenta de novo com backoff',
    async (_, outcome) => {
      const { outbox, sender, post, events, answer } = setup()
      await outbox.enqueue('a', batch(1))
      void sender.kick('a')
      await flushPromises()
      await answer(outcome instanceof Error ? outcome : { ...outcome })
      expect(await outbox.pending('a')).toHaveLength(1)
      expect(events.retrying).toHaveBeenCalledWith('a', 1, 500)
      // kick durante o backoff não fura a espera
      void sender.kick('a')
      await flushPromises()
      expect(post).toHaveBeenCalledTimes(1)
      jest.advanceTimersByTime(499)
      await flushPromises()
      expect(post).toHaveBeenCalledTimes(1)
      jest.advanceTimersByTime(1)
      await flushPromises()
      expect(post).toHaveBeenCalledTimes(2)
      await answer(ok())
      expect(events.confirmed).toHaveBeenCalledTimes(1)
      expect(await outbox.pending('a')).toEqual([])
    }
  )

  it('o backoff dobra até o teto, e o Retry-After é o mínimo', async () => {
    const { outbox, sender, events, answer } = setup()
    await outbox.enqueue('a', batch(1))
    void sender.kick('a')
    await flushPromises()
    const delays: number[] = []
    for (let i = 0; i < 5; i++) {
      await answer({ status: 503, body: null })
      const last = events.retrying.mock.calls.at(-1)?.[2] as number
      delays.push(last)
      jest.advanceTimersByTime(last)
      await flushPromises()
    }
    // random() = 0: metade do atraso (1s, 2s, 4s, 8s, teto 8s)
    expect(delays).toEqual([500, 1000, 2000, 4000, 4000])
    await answer({ status: 429, body: null, retryAfterMs: 60_000 })
    expect(events.retrying.mock.calls.at(-1)?.[2]).toBe(60_000)
  })

  it('jitter: o atraso fica entre a metade e o total', async () => {
    const first: number[] = []
    for (const r of [0, 0.5, 1]) {
      const outbox = createMemoryOutbox()
      const retrying = jest.fn()
      const sender = createSender({
        outbox,
        post: async () => ({ status: 500, body: null }),
        events: {
          confirmed: jest.fn(),
          conflicted: jest.fn(),
          rejected: jest.fn(),
          retrying,
        },
        random: () => r,
      })
      await outbox.enqueue('a', batch(1))
      await sender.kick('a')
      first.push(retrying.mock.calls[0]?.[2])
      sender.reset()
    }
    expect(first).toEqual([500, 750, 1000])
  })

  it('409: sai da fila, avisa o conflito e segue com o próximo', async () => {
    const { outbox, sender, post, events, answer } = setup()
    await outbox.enqueue('a', batch(1))
    await outbox.enqueue('a', batch(2))
    void sender.kick('a')
    await flushPromises()
    const body = { error: 'conflito', current: {}, sheetVersion: 4 }
    await answer({ status: 409, body })
    expect(events.conflicted).toHaveBeenCalledWith('a', batch(1), body)
    expect(post).toHaveBeenCalledTimes(2)
    expect(await outbox.pending('a')).toEqual([batch(2)])
  })

  it.each([400, 403, 404, 413, 422])(
    '%i: sai da fila sem tentar de novo e avisa a rejeição',
    async status => {
      const { outbox, sender, post, events, answer } = setup()
      await outbox.enqueue('a', batch(1))
      void sender.kick('a')
      await flushPromises()
      await answer({ status, body: { error: 'x' } })
      expect(events.rejected).toHaveBeenCalledWith('a', batch(1), status, {
        error: 'x',
      })
      expect(events.retrying).not.toHaveBeenCalled()
      expect(await outbox.pending('a')).toEqual([])
      jest.advanceTimersByTime(60_000)
      await flushPromises()
      expect(post).toHaveBeenCalledTimes(1)
    }
  )

  it('classificação', () => {
    expect([0, 401, 408, 429, 500, 502].every(isRetryable)).toBe(true)
    expect([200, 400, 403, 404, 409, 413, 422].some(isRetryable)).toBe(false)
  })
})

describe('reconexão e logout', () => {
  it('flush manda já o que esperava o backoff', async () => {
    const { outbox, sender, post, answer } = setup()
    await outbox.enqueue('a', batch(1))
    void sender.kick('a')
    await flushPromises()
    await answer(new Error('offline'))
    expect(post).toHaveBeenCalledTimes(1)
    // flush resolve quando o envio que ele disparou termina
    const flushed = sender.flush()
    await flushPromises()
    expect(post).toHaveBeenCalledTimes(2)
    await answer(ok())
    await flushed
    expect(await outbox.pending('a')).toEqual([])
  })

  it('reset: a resposta que chega depois do logout é ignorada', async () => {
    const { outbox, sender, events, answer } = setup()
    await outbox.enqueue('a', batch(1))
    void sender.kick('a')
    await flushPromises()
    sender.reset()
    await answer(ok())
    expect(events.confirmed).not.toHaveBeenCalled()
    // O lote continua lá: quem limpa a fila no logout é o sync
    expect(await outbox.pending('a')).toHaveLength(1)
  })

  it('reset cancela o backoff', async () => {
    const { outbox, sender, post, answer } = setup()
    await outbox.enqueue('a', batch(1))
    void sender.kick('a')
    await flushPromises()
    await answer({ status: 503, body: null })
    sender.reset()
    jest.advanceTimersByTime(60_000)
    await flushPromises()
    expect(post).toHaveBeenCalledTimes(1)
  })

  it('falha do storage da fila tenta de novo com backoff', async () => {
    const real = createMemoryOutbox()
    let broken = true
    const outbox: Outbox = {
      ...real,
      pending: async id => {
        if (broken) throw new Error('disco cheio')
        return real.pending(id)
      },
    }
    const { sender, post, events } = setup(outbox)
    await real.enqueue('a', batch(1))
    await sender.kick('a')
    expect(events.retrying).toHaveBeenCalledWith('a', 1, 500)
    broken = false
    jest.advanceTimersByTime(500)
    await flushPromises()
    expect(post).toHaveBeenCalledTimes(1)
  })

  it('fila vazia: nada a fazer', async () => {
    const { sender, post } = setup()
    await sender.kick('a')
    await sender.flush()
    expect(post).not.toHaveBeenCalled()
  })
})
