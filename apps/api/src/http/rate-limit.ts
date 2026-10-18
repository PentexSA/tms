// Limite de tentativas por chave (IP, e-mail, usuário) em janela fixa. Na v0
// fica em memória, atrás desta interface, para trocar por Redis ou Postgres
// quando a API tiver mais de uma instância.

export interface RateLimiter {
  // Conta uma tentativa e diz se ela está dentro do limite.
  hit(key: string): RateDecision
  // Só consulta, sem contar.
  check(key: string): RateDecision
  reset(): void
}

export interface RateDecision {
  readonly allowed: boolean
  readonly retryAfterSeconds: number
}

export interface RateLimitOptions {
  readonly limit: number
  readonly windowMs: number
  readonly now?: () => number
  // Teto de chaves em memória (defesa contra esgotar a memória com IPs falsos).
  readonly maxKeys?: number
}

export function createRateLimiter(options: RateLimitOptions): RateLimiter {
  const { limit, windowMs, maxKeys = 10_000 } = options
  const now = options.now ?? Date.now
  const windows = new Map<string, { count: number; resetAt: number }>()

  const current = (key: string) => {
    const t = now()
    const w = windows.get(key)
    if (w && w.resetAt > t) return w
    if (windows.size >= maxKeys) {
      for (const [k, x] of windows) if (x.resetAt <= t) windows.delete(k)
      // Ainda cheio: descarta as janelas mais antigas (ordem de inserção)
      for (const k of windows.keys()) {
        if (windows.size < maxKeys) break
        windows.delete(k)
      }
    }
    const fresh = { count: 0, resetAt: t + windowMs }
    windows.set(key, fresh)
    return fresh
  }
  const decision = (w: { count: number; resetAt: number }): RateDecision => ({
    allowed: w.count <= limit,
    retryAfterSeconds: Math.max(1, Math.ceil((w.resetAt - now()) / 1000)),
  })

  return {
    hit(key) {
      const w = current(key)
      w.count++
      return decision(w)
    },
    check(key) {
      const w = current(key)
      return { ...decision({ ...w, count: w.count + 1 }) }
    },
    reset() {
      windows.clear()
    },
  }
}
