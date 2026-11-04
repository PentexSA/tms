import { appendFileSync } from 'node:fs'
import * as Sentry from '@sentry/bun'
import { createLogger } from '@tms/logger'
import { logger } from '../logger'
import { initTelemetry } from '../telemetry'

// Entrada do bundle de telemetry-bundle.test.ts: o caminho real (createLogger e
// initTelemetry) num `bun build` como o do Dockerfile, com transporte falso. O
// envelope vai para um arquivo, para o stdout continuar só com o do Pino.

const envelopeFile = process.env.ENVELOPE_FILE as string

const transport = () => ({
  send: async (envelope: unknown) => {
    appendFileSync(envelopeFile, `${JSON.stringify(envelope)}\n`)
    return {}
  },
  flush: async () => true,
})

initTelemetry({ dsn: process.env.BUNDLE_DSN ?? '', transport })

const db = createLogger({ name: 'db' })
logger.info({ requestId: 'id-do-bundle', path: '/caminho-marcado' }, 'do api')
db.warn({ query: 'select $1', duration: 600 }, 'do db')
logger.debug('debug nao sai')

await Sentry.flush(2000)
