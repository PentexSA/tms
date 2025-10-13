import Elysia from 'elysia'
import { serializeError } from 'serialize-error'
import { logger } from '../logger'

export const loggerMiddleware = new Elysia({ name: 'logger' })
  .derive({ as: 'global' }, () => ({ startTime: performance.now() }))
  .onAfterResponse(
    { as: 'global' },
    ({ request, body, path, set, startTime, headers, response, error }) => {
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
    }
  )
