import Elysia from 'elysia'
import { serializeError } from 'serialize-error'
import { logger } from '../logger'

export const loggerMiddleware = new Elysia({ name: 'logger' })
  .derive({ as: 'global' }, () => ({ startTime: performance.now() }))
  .onAfterResponse({ as: 'global' }, ctx => {
    // Elysia preenche `error` no contexto quando a requisição falha, mas não o declara no tipo
    const { request, body, path, set, startTime, headers, response, error } =
      ctx as typeof ctx & { error?: unknown }
    const responseTime = performance.now() - startTime

    const logData = {
      req: {
        headers: headers,
        body: body,
      },
      res: {
        headers: set.headers,
        body: response,
        statusCode: set.status,
      },
      ...(error ? { error: serializeError(error, { maxDepth: 1 }) } : {}),
      responseTime,
    }

    logger.info(logData, `${request.method} ${path} - ${set.status}`)
  })
