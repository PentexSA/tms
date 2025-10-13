import { cors } from '@elysiajs/cors'
import { swagger } from '@elysiajs/swagger'
import { config } from '@tms/config/env'
import { db } from '@tms/db'
import { Elysia } from 'elysia'
import { logger } from './logger'
import { loggerMiddleware } from './middlewares/loggerMiddleware'

const app = new Elysia()
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
  .get('/todos', async () => {
    const todos = await db
      .selectFrom('todos')
      .selectAll()
      .orderBy('created_at', 'desc')
      .execute()
    return todos
  })
  .post('/todos', async ({ body }) => {
    const { title } = body as { title: string }

    const [todo] = await db
      .insertInto('todos')
      .values({ title })
      .returningAll()
      .execute()

    return todo
  })
  .listen(config.API_PORT)

logger.info(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
)
