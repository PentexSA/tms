import { cors } from '@elysiajs/cors'
import { swagger } from '@elysiajs/swagger'
import { config } from '@tms/config/env'
import { db as defaultDb } from '@tms/db'
import { Elysia, t } from 'elysia'

/**
 * Cria a aplicação Elysia (sem .listen)
 * Exportado para ser usado em testes
 *
 * @param database - Opcional. Use para injetar um banco mock nos testes
 */
export const createApp = (database?: any) => {
  // biome-ignore lint/suspicious/noExplicitAny: Test helper needs flexibility for Kysely injection
  const db = database || defaultDb
  return new Elysia()
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
    .get('/todos', async () => {
      const todos = await db
        .selectFrom('todos')
        .selectAll()
        .orderBy('created_at', 'desc')
        .execute()
      return todos
    })
    .post(
      '/todos',
      async ({ body }) => {
        const { title } = body as { title: string }

        const [todo] = await db
          .insertInto('todos')
          .values({ title })
          .returningAll()
          .execute()

        return todo
      },
      {
        body: t.Object({
          title: t.String(),
        }),
      }
    )
}

// Exporta o tipo da app para Eden Treaty
export type App = ReturnType<typeof createApp>

// Inicia o servidor apenas quando executado diretamente
// (não em testes)
// Verifica se não estamos em ambiente de teste (Jest)
if (process.env.NODE_ENV !== 'test') {
  const app = createApp().listen(config.API_PORT)

  console.log(
    `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
  )
}
