import { config } from '@tms/config/env'
import pino, { LoggerOptions } from 'pino'

const LEVEL = {
  production: 'info',
  development: 'debug',
  // Testes em silêncio: quem precisa do log usa spyOn no método
  test: 'silent',
} as const

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
    timestamp: () => `,"time":"${new Date().toLocaleString('pt-BR')}"`,
    base: { pid: false },
    level: LEVEL[config.NODE_ENV] ?? 'info',
    ...loggerConfig,
  })
