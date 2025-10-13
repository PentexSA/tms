import { config } from '@tms/config/env'
import pino, { LoggerOptions } from 'pino'

export const createLogger = (loggerConfig: LoggerOptions) =>
  pino({
    transport:
      config.NODE_ENV !== 'production'
        ? {
            target: 'pino-pretty',
            options: {
              translateTime: false,
            },
          }
        : undefined,
    timestamp: () => `,"time":"${new Date().toLocaleString('pt-BR')}"`,
    base: { pid: false },
    level: 'debug',
    ...loggerConfig,
  })
