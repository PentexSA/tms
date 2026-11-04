import { createLogger } from '@tms/logger'
import type { LogEvent } from 'kysely'

export const logger = createLogger({ name: 'db' })

/** A partir daqui a query sai em `warn`, inclusive em produção. */
export const SLOW_QUERY_MS = 500

// Log de query sem dados: nunca os parâmetros (e-mails, hashes, texto da
// ficha) nem a mensagem de erro do Postgres, que repete valores ("Key
// (email)=(...) already exists"). Fica o SQL com placeholders, a duração e o
// código SQLSTATE.
const formatEvent = (event: LogEvent) => ({
  query: event.query.sql,
  duration: Math.round(event.queryDurationMillis),
})

export function errorCode(error: unknown): string {
  if (error && typeof error === 'object') {
    const code = (error as { code?: unknown }).code
    if (typeof code === 'string') return code
    return error.constructor?.name ?? 'Error'
  }
  return typeof error
}

export const kyselyLogger = (event: LogEvent) => {
  if (event.level === 'error')
    logger.error(
      { ...formatEvent(event), error: errorCode(event.error) },
      'query falhou'
    )
  else if (event.queryDurationMillis > SLOW_QUERY_MS)
    logger.warn(formatEvent(event), 'query lenta')
  else logger.debug(formatEvent(event), 'query')
}
