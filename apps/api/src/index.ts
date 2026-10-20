import { cors } from '@elysiajs/cors'
import { swagger } from '@elysiajs/swagger'
import { type DB, db as defaultDb } from '@tms/db'
import { Elysia } from 'elysia'
import type { Kysely } from 'kysely'
import { accountRoutes } from './account/routes'
import { authGuard } from './auth/guard'
import { authRoutes, meRoutes } from './auth/routes'
import { chronicleRoutes } from './chronicles/routes'
import { tableRoutes } from './chronicles/table'
import { onError } from './http/on-error'
import { securityHeaders } from './http/security'
import { loggerMiddleware } from './middlewares/loggerMiddleware'
import { type AppOptions, resolveOptions } from './options'
import { rollRoutes } from './rolls/routes'
import { eventRoutes } from './sheets/events'
import { sheetRoutes } from './sheets/routes'

/**
 * Cria a aplicação Elysia (sem .listen)
 * Exportado para ser usado em testes
 *
 * @param database - Opcional. Use para injetar o banco de teste (PGLite)
 * @param overrides - Opcional. Relógio, limites e segredo para os testes
 */
export const createApp = (
  database: Kysely<DB> = defaultDb,
  overrides: Partial<AppOptions> = {}
) => {
  const db = database
  const options = resolveOptions(overrides)
  const guard = authGuard(options.tokens, options)
  return (
    new Elysia()
      .decorate('db', db)
      .use(securityHeaders(options))
      .use(loggerMiddleware)
      .onError({ as: 'global' }, onError)
      .use(
        cors({
          // Allowlist explícita (nunca "*"): o cookie do refresh exige credenciais
          origin: [...options.corsOrigins],
          credentials: true,
          methods: ['GET', 'POST', 'PATCH', 'DELETE'],
          allowedHeaders: [
            'content-type',
            'authorization',
            'x-tms-client',
            // No E2E, o navegador representa clientes distintos sem um proxy
            // real. Em produção, o proxy confiável acrescenta este cabeçalho.
            ...(options.trustProxy ? ['x-forwarded-for'] : []),
          ],
          maxAge: 600,
        })
      )
      // Documentação só fora de produção
      .use(
        options.swagger
          ? swagger({
              documentation: { info: { title: 'TMS API', version: '1.0.0' } },
            })
          : new Elysia({ name: 'no-swagger' })
      )
      .use(guard)
      .get('/health', () => ({ ok: true }))
      .use(authRoutes(db, options, guard))
      .use(meRoutes(db, guard))
      .use(accountRoutes(db, options, guard))
      .use(chronicleRoutes(db, options, guard))
      .use(sheetRoutes(db, guard))
      .use(eventRoutes(db, options, guard))
      .use(tableRoutes(db, guard))
      .use(rollRoutes(db, options, guard))
  )
}

// Exporta o tipo da app para Eden Treaty
export type App = ReturnType<typeof createApp>
