// Error tracking do app web (Sentry, Fase 3). O contrato é o de telemetry.ts.
// Só este arquivo importa o SDK. O evento sai pelo filtro de telemetryFilter.ts:
// lista de campos, URL sem query nem id, breadcrumbs só de navegação e HTTP e
// um limite de eventos por aba.

import {
  breadcrumbsIntegration,
  captureException,
  type ErrorEvent,
  type EventHint,
  globalHandlersIntegration,
  init,
  withScope,
} from '@sentry/react'

import { classifyError } from './errors'
import {
  type CaptureContext,
  createEventLimiter,
  type EventLike,
  scrubBreadcrumb,
  scrubWebEvent,
  toCapture,
} from './telemetryFilter'
import { APP_VERSION } from './version'

export type { CaptureContext }

let enabled = false

interface Options {
  /** Só nos testes: o transporte falso que guarda o envelope. */
  readonly transport?: NonNullable<Parameters<typeof init>[0]>['transport']
  readonly dsn?: string
  readonly maxEvents?: number
}

// O Expo só embute a variável lida pelo nome completo
const BUILD_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN
const SMOKE = process.env.EXPO_PUBLIC_SENTRY_SMOKE === 'true'

export function initTelemetry(options: Options = {}): void {
  const dsn = options.dsn ?? BUILD_DSN
  if (!dsn || enabled) return
  const allow = createEventLimiter(options.maxEvents)
  init({
    dsn,
    release: APP_VERSION,
    // No SDK 11 o sendDefaultPii virou dataCollection: tudo desligado (o
    // scrubWebEvent já ignora esses campos; os dois cintos valem juntos)
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
    },
    // Só erros: sem traces, replay, feedback nem integração além das duas
    // abaixo. Sem console nem clique nos breadcrumbs (podem ter texto da tela)
    defaultIntegrations: false,
    integrations: [
      globalHandlersIntegration(),
      breadcrumbsIntegration({
        dom: false,
        fetch: true,
        history: true,
        xhr: true,
        sentry: false,
      }),
    ],
    beforeBreadcrumb: crumb => scrubBreadcrumb(crumb) as typeof crumb | null,
    beforeSend(event: ErrorEvent, hint: EventHint) {
      // Erro que chegou pelos handlers globais sem passar por captureError
      if (classifyError(hint.originalException) === 'ignore') return null
      if (!allow()) return null
      return scrubWebEvent(event as EventLike) as ErrorEvent
    },
    ...(options.transport ? { transport: options.transport } : {}),
  })
  enabled = true
  // EXPO_PUBLIC_SENTRY_SMOKE: um erro de teste ao abrir, para ver o caminho
  if (SMOKE && !options.dsn)
    captureError(new Error('sentry smoke'), { source: 'boundary' })
}

export function captureError(error: unknown, context: CaptureContext): void {
  if (!enabled) return
  try {
    const capture = toCapture(error, context)
    if (!capture) return
    withScope(scope => {
      scope.setTags(capture.tags)
      if (capture.fingerprint) scope.setFingerprint(capture.fingerprint)
      captureException(capture.error)
    })
  } catch {
    // O error tracking nunca derruba o app
  }
}
