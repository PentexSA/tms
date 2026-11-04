import { config } from '@tms/config/env'
import pino, { LoggerOptions } from 'pino'

const LEVEL = {
  production: 'info',
  development: 'debug',
  // Testes em silêncio: quem precisa do log usa spyOn no método
  test: 'silent',
} as const

// A imagem final não tem package.json: o `bun build` do deploy
// (deploy/render/Dockerfile) troca esta leitura pela versão da raiz, com
// --define. Por isso a leitura é direta, sem passar pelo config.
const release = process.env.TMS_RELEASE || 'dev'

export const createLogger = (loggerConfig: LoggerOptions) =>
  pino({
    transport:
      config.NODE_ENV === 'development'
        ? {
            target: 'pino-pretty',
            options: {
              translateTime: false,
            },
          }
        : undefined,
    timestamp: pino.stdTimeFunctions.isoTime,
    // O `name` de cada logger diz o componente (api, db)
    base: { service: 'tms-api', release },
    level: LEVEL[config.NODE_ENV] ?? 'info',
    ...loggerConfig,
  })
