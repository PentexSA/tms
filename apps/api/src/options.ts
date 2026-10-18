import { config } from '@tms/config/env'
import type { SessionConfig } from './auth/sessions'
import type { TokenConfig } from './auth/tokens'
import { createRateLimiter, type RateLimiter } from './http/rate-limit'
import { logger } from './logger'

// Opções da app, lidas do config uma vez. Os testes trocam relógio, limites e
// segredo por aqui, sem mexer em variável de ambiente.

export interface Limits {
  // Por IP: login, cadastro e refresh.
  readonly login: RateLimiter
  readonly register: RateLimiter
  readonly refresh: RateLimiter
  // Por e-mail: só as tentativas que falham contam.
  readonly loginFailures: RateLimiter
}

export interface AppOptions {
  readonly now: () => Date
  readonly tokens: TokenConfig
  readonly sessions: SessionConfig
  readonly corsOrigins: readonly string[]
  readonly trustProxy: boolean
  readonly swagger: boolean
  readonly secureCookies: boolean
  readonly limits: Limits
}

const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE

export function defaultLimits(now: () => Date): Limits {
  const clock = () => now().getTime()
  return {
    login: createRateLimiter({ limit: 20, windowMs: MINUTE, now: clock }),
    register: createRateLimiter({
      limit: 5,
      windowMs: 60 * MINUTE,
      now: clock,
    }),
    refresh: createRateLimiter({ limit: 60, windowMs: MINUTE, now: clock }),
    loginFailures: createRateLimiter({
      limit: 10,
      windowMs: 15 * MINUTE,
      now: clock,
    }),
  }
}

function jwtSecret(): Uint8Array {
  if (config.JWT_SECRET) return new TextEncoder().encode(config.JWT_SECRET)
  // Só fora de produção (o config recusa produção sem segredo): um segredo
  // aleatório por processo, nunca um valor fixo conhecido.
  if (config.NODE_ENV === 'development')
    logger.warn(
      'JWT_SECRET ausente: usando um segredo aleatório deste processo'
    )
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return bytes
}

export function resolveOptions(
  overrides: Partial<AppOptions> = {}
): AppOptions {
  const now = overrides.now ?? (() => new Date())
  const production = config.NODE_ENV === 'production'
  return {
    now,
    tokens: overrides.tokens ?? {
      secret: jwtSecret(),
      issuer: config.JWT_ISSUER,
      audience: config.JWT_AUDIENCE,
      ttlSeconds: 15 * 60,
      now,
    },
    sessions: overrides.sessions ?? {
      now,
      refreshTtlMs: 30 * DAY,
      familyTtlMs: 90 * DAY,
    },
    corsOrigins: overrides.corsOrigins ?? config.CORS_ORIGINS,
    trustProxy: overrides.trustProxy ?? config.TRUST_PROXY,
    swagger: overrides.swagger ?? !production,
    secureCookies: overrides.secureCookies ?? production,
    limits: overrides.limits ?? defaultLimits(now),
  }
}
