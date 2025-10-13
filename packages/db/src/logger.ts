import { createLogger } from '@tms/logger'
import { LogEvent } from 'kysely'

export const logger = createLogger({ name: 'db' })

const formatEvent = (query: LogEvent) => ({
  parameters: query.query.parameters,
  query: query.query.sql,
  duration: query.queryDurationMillis,
})

export const kyselyLogger = (event: LogEvent) => {
  if (event.level === 'error') {
    logger.error({ ...formatEvent(event), error: event.error })
  } else {
    logger.info(formatEvent(event))
  }
}
