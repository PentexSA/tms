import { config } from '@tms/config/env'
import { createApp } from './index'
import { logger } from './logger'

// Ponto de entrada do servidor; o index.ts só monta a app (testes e Eden)
const app = createApp().listen(config.API_PORT)

logger.info(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
)
