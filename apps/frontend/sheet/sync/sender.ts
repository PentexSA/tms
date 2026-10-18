import type { Outbox, QueuedBatch } from './outbox'

// Envia o outbox (doc/arquitetura §6.6 e §7.3): FIFO por ficha, um lote em voo
// por ficha (o `from` de um lote depende do anterior) e backoff com jitter.
// Fichas diferentes andam em paralelo. Não conhece React nem a API: recebe
// `post` e avisa o resultado por `events`.

/** Resposta de um envio. `status` 0: sem resposta (rede, timeout). */
export interface PostOutcome {
  readonly status: number
  readonly body: unknown
  readonly retryAfterMs?: number
}

export interface SenderEvents {
  confirmed(characterId: string, batch: QueuedBatch, body: unknown): void
  /** 409: o `from` não bate; o lote saiu da fila. */
  conflicted(characterId: string, batch: QueuedBatch, body: unknown): void
  /** 4xx definitivo (400, 403, 404, 413, 422): o lote saiu da fila. */
  rejected(
    characterId: string,
    batch: QueuedBatch,
    status: number,
    body: unknown
  ): void
  /** Vai tentar de novo em `delayMs` (indicador de sincronização). */
  retrying?(characterId: string, attempt: number, delayMs: number): void
}

export interface SenderDeps {
  readonly outbox: Outbox
  readonly post: (
    characterId: string,
    batch: QueuedBatch
  ) => Promise<PostOutcome>
  readonly events: SenderEvents
  readonly random?: () => number
  readonly baseDelayMs?: number
  readonly maxDelayMs?: number
}

export interface Sender {
  /** Envia o que houver na fila da ficha (sem efeito se já está enviando). */
  kick(characterId: string): Promise<void>
  /** Reconectou: tenta já tudo o que está esperando o backoff. */
  flush(): Promise<void>
  /** Logout: para tudo; respostas que chegarem depois são ignoradas. */
  reset(): void
}

/**
 * Sem rede, 5xx, 408 e 429 tentam de novo. O 401 também: o fetch da sessão já
 * tentou renovar; se a sessão acabou, o logout chama reset() e limpa a fila.
 */
export const isRetryable = (status: number): boolean =>
  status === 0 ||
  status === 401 ||
  status === 408 ||
  status === 429 ||
  status >= 500

export function createSender(deps: SenderDeps): Sender {
  const random = deps.random ?? Math.random
  const base = deps.baseDelayMs ?? 1000
  const max = deps.maxDelayMs ?? 30_000
  let epoch = 0
  const running = new Map<string, Promise<void>>()
  const dirty = new Set<string>()
  const timers = new Map<string, ReturnType<typeof setTimeout>>()
  const attempts = new Map<string, number>()

  // "Equal jitter": metade fixa e metade aleatória, para os aparelhos que
  // perderam a rede juntos não voltarem juntos. O Retry-After do servidor
  // é o mínimo.
  const delayFor = (attempt: number, retryAfterMs = 0) => {
    const d = Math.min(max, base * 2 ** attempt)
    return Math.max(Math.round(d / 2 + random() * (d / 2)), retryAfterMs)
  }

  const retryLater = (characterId: string, retryAfterMs?: number) => {
    const attempt = attempts.get(characterId) ?? 0
    attempts.set(characterId, attempt + 1)
    const ms = delayFor(attempt, retryAfterMs)
    deps.events.retrying?.(characterId, attempt + 1, ms)
    timers.set(
      characterId,
      setTimeout(() => {
        timers.delete(characterId)
        void kick(characterId)
      }, ms)
    )
  }

  async function drain(characterId: string, mine: number): Promise<void> {
    while (mine === epoch) {
      const [batch] = await deps.outbox.pending(characterId)
      if (!batch || mine !== epoch) return
      let res: PostOutcome
      try {
        res = await deps.post(characterId, batch)
      } catch {
        res = { status: 0, body: null }
      }
      if (mine !== epoch) return
      if (res.status >= 200 && res.status < 300) {
        attempts.delete(characterId)
        await deps.outbox.ack(batch.clientBatchId)
        deps.events.confirmed(characterId, batch, res.body)
        continue
      }
      if (isRetryable(res.status)) {
        retryLater(characterId, res.retryAfterMs)
        return
      }
      attempts.delete(characterId)
      await deps.outbox.drop(batch.clientBatchId)
      if (res.status === 409)
        deps.events.conflicted(characterId, batch, res.body)
      else deps.events.rejected(characterId, batch, res.status, res.body)
    }
  }

  function kick(characterId: string): Promise<void> {
    const current = running.get(characterId)
    if (current) {
      // Chegou lote novo enquanto o laço terminava: roda de novo no fim
      dirty.add(characterId)
      return current
    }
    if (timers.has(characterId)) return Promise.resolve()
    const mine = epoch
    const run = drain(characterId, mine)
      .catch(() => {
        // Falha do storage do outbox: tenta de novo com backoff
        if (mine === epoch) retryLater(characterId)
      })
      .finally(() => {
        if (running.get(characterId) === run) running.delete(characterId)
        if (dirty.delete(characterId) && mine === epoch) void kick(characterId)
      })
    running.set(characterId, run)
    return run
  }

  return {
    kick,
    async flush() {
      for (const timer of timers.values()) clearTimeout(timer)
      timers.clear()
      attempts.clear()
      const ids = await deps.outbox.characters()
      await Promise.all(ids.map(kick))
    },
    reset() {
      epoch++
      for (const timer of timers.values()) clearTimeout(timer)
      timers.clear()
      attempts.clear()
      running.clear()
      dirty.clear()
    },
  }
}
