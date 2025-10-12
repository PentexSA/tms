import { cors } from '@elysiajs/cors'
import { swagger } from '@elysiajs/swagger'
import { config } from '@tms/config/env'
import { db } from '@tms/db'
import { Elysia, t } from 'elysia'

const app = new Elysia()
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
  .listen(config.API_PORT)

export type App = typeof app

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
)
