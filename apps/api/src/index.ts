import { cors } from '@elysiajs/cors'
import { swagger } from '@elysiajs/swagger'
import { type DB, db as defaultDb } from '@tms/db'
import { Elysia } from 'elysia'
import type { Kysely } from 'kysely'
import { loggerMiddleware } from './middlewares/loggerMiddleware'

/**
 * Cria a aplicação Elysia (sem .listen)
 * Exportado para ser usado em testes
 *
 * @param database - Opcional. Use para injetar o banco de teste (PGLite)
 */
export const createApp = (database: Kysely<DB> = defaultDb) => {
  const db = database
  return new Elysia()
    .decorate('db', db)
    .use(loggerMiddleware)
    .use(cors())
    .use(
      swagger({
        documentation: {
          info: {
            title: 'TMS API',
            version: '1.0.0',
          },
        },
      })
    )
    .get('/health', () => ({ ok: true }))
}

// Exporta o tipo da app para Eden Treaty
export type App = ReturnType<typeof createApp>
