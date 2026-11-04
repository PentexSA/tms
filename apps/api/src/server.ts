import { config } from '@tms/config/env'
import { createApp } from './index'
import { logger } from './logger'
import { initTelemetry, sendSmokeError } from './telemetry'

// Error tracking só aqui: o index.ts (createApp) não envia nada nos testes
if (initTelemetry()) {
  logger.info('Error tracking ligado (Sentry)')
  if (config.SENTRY_SMOKE) void sendSmokeError()
}

// Ponto de entrada do servidor; o index.ts só monta a app (testes e Eden)
const app = createApp().listen(config.API_PORT)

logger.info(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
)

// De onde vem o IP do rate limit (T-86). Nunca o valor de um header
if (config.TEST_CLIENT_IP)
  logger.warn(
    'IP do cliente: header de teste x-tms-test-client-ip (TEST_CLIENT_IP, só para o E2E)'
  )
else
  logger.info(
    config.TRUST_PROXY
      ? 'IP do cliente: último hop do X-Forwarded-For (TRUST_PROXY)'
      : 'IP do cliente: a conexão (sem proxy confiável)'
  )
