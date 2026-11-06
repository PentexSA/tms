import { cors } from '@elysiajs/cors'
import { swagger } from '@elysiajs/swagger'
import { type DB, db as defaultDb } from '@tms/db'
import { Elysia } from 'elysia'
import type { Kysely } from 'kysely'
import { accountRoutes } from './account/routes'
import { authGuard } from './auth/guard'
import { authRoutes, meRoutes } from './auth/routes'
import { backstageRoutes } from './chronicles/backstage'
import { operationRoutes } from './chronicles/operations'
import { chronicleRoutes } from './chronicles/routes'
import { tableRoutes } from './chronicles/table'
import { onError } from './http/on-error'
import { securityHeaders, TEST_CLIENT_IP_HEADER } from './http/security'
import { loggerMiddleware } from './middlewares/loggerMiddleware'
import { type AppOptions, resolveOptions } from './options'
import { rollRoutes } from './rolls/routes'
import { creationRoutes } from './sheets/creation'
import { eventRoutes } from './sheets/events'
import { revealRoutes } from './sheets/reveal'
import { sheetRoutes } from './sheets/routes'
import { statusRoutes } from './sheets/status'
import { ledgerRoutes } from './xp/ledger'
import { requestRoutes } from './xp/requests'

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
            'x-tms-client-version',
            // Nunca o x-forwarded-for: quem o acrescenta é o proxy, não o
            // navegador. No E2E, o navegador representa clientes distintos
            // pelo header de teste, que o config recusa em produção (T-86)
            ...(options.testClientIp ? [TEST_CLIENT_IP_HEADER] : []),
          ],
          // O web em outra origem só lê o que estiver listado aqui
          exposeHeaders: ['x-request-id'],
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
      .use(backstageRoutes(db, options, guard))
      .use(sheetRoutes(db, guard))
      .use(revealRoutes(db, guard))
      .use(eventRoutes(db, options, guard))
      .use(statusRoutes(db, options, guard))
      .use(creationRoutes(db, options, guard))
      .use(tableRoutes(db, guard))
      .use(operationRoutes(db, options, guard))
      .use(rollRoutes(db, options, guard))
      .use(ledgerRoutes(db, options, guard))
      .use(requestRoutes(db, options, guard))
  )
}

// Exporta o tipo da app para Eden Treaty
export type App = ReturnType<typeof createApp>
