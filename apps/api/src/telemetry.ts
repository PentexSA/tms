import * as Sentry from '@sentry/bun'
import { config } from '@tms/config/env'
import { redact, type SafeError, safeError } from './http/safe-error'

// Error tracking (Sentry, doc/plano-observabilidade.md Fase 3). Um erro leva
// dado de usuário (o Postgres repete valores, o JSON.parse repete a entrada), e
// o que sai do processo passa por um filtro só, por lista de campos permitidos:
// o evento do SDK é descartado e remontado a partir do `safeError`, o mesmo
// filtro do log. Nada de cookies, headers, corpo, query, variáveis de frame nem
// linhas de código.
//
// Só o server.ts chama `initTelemetry`: createApp é usado nos testes e Eden e
// não pode enviar nada. Sem init, `captureServerError` não faz nada.

export interface ServerErrorTags {
  /** Vem de parseClientVersion: semver curto ou `unknown`. */
  readonly clientVersion: string
  /** O template da rota, nunca o caminho com ids. */
  readonly route: string | null
  readonly requestId: string | undefined
}

const MAX_FRAMES = 50
const MAX_TEXT = 300
const MAX_TAG = 100

let enabled = false

const text = (value: unknown, max = MAX_TEXT): string | undefined =>
  typeof value === 'string' && value ? redact(value).slice(0, max) : undefined

const num = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined

type Frame = NonNullable<
  NonNullable<Sentry.Exception['stacktrace']>['frames']
>[number]

/** Do frame do SDK, só onde está o código. Sem vars, linhas de código e abs_path. */
function frameOf(frame: Frame): Frame {
  return {
    ...(text(frame.filename) ? { filename: text(frame.filename) } : {}),
    ...(text(frame.function) ? { function: text(frame.function) } : {}),
    ...(num(frame.lineno) !== undefined ? { lineno: frame.lineno } : {}),
    ...(num(frame.colno) !== undefined ? { colno: frame.colno } : {}),
    ...(typeof frame.in_app === 'boolean' ? { in_app: frame.in_app } : {}),
  }
}

const framesOf = (event: Sentry.Event): Frame[] | undefined => {
  const values = event.exception?.values ?? []
  const frames = values[values.length - 1]?.stacktrace?.frames
  return Array.isArray(frames)
    ? frames.slice(-MAX_FRAMES).map(frameOf)
    : undefined
}

// Do mais interno ao mais externo, como o Sentry espera: o último é o erro
// capturado, e é o único com stack (o do SDK; os de cause só levam tipo e texto)
function exceptionOf(
  safe: SafeError,
  frames: Frame[] | undefined
): Sentry.Exception[] {
  const chain: SafeError[] = []
  for (let e: SafeError | undefined = safe; e; e = e.cause) chain.push(e)
  return chain.reverse().map((e, i, all) => ({
    type: e.name,
    ...((e.message ?? e.code) ? { value: e.message ?? e.code } : {}),
    ...(i === all.length - 1 && frames ? { stacktrace: { frames } } : {}),
  }))
}

const ALLOWED_TAGS = ['client.version', 'route', 'request_id'] as const

/**
 * O evento final: só os campos da lista abaixo. Pura. O que o SDK trouxe e não
 * está aqui (request, user, contexts, extra, breadcrumbs, modules, message…)
 * não sai.
 */
export function scrubEvent(
  event: Sentry.ErrorEvent,
  hint: Sentry.EventHint
): Sentry.ErrorEvent {
  const safe = safeError(hint.originalException)
  const tags: Record<string, string> = {}
  for (const key of ALLOWED_TAGS) {
    const value = text(event.tags?.[key], MAX_TAG)
    if (value) tags[key] = value
  }
  return {
    type: undefined,
    ...(event.event_id ? { event_id: event.event_id } : {}),
    ...(event.timestamp !== undefined ? { timestamp: event.timestamp } : {}),
    platform: event.platform,
    level: event.level,
    ...(event.release ? { release: text(event.release, MAX_TAG) } : {}),
    ...(event.environment
      ? { environment: text(event.environment, MAX_TAG) }
      : {}),
    server_name: 'tms-api',
    ...(event.sdk ? { sdk: event.sdk } : {}),
    tags,
    exception: { values: exceptionOf(safe, framesOf(event)) },
  }
}

export interface TelemetryOptions {
  /** Só nos testes: o transporte falso que guarda o envelope. */
  readonly transport?: Sentry.BunOptions['transport']
  readonly dsn?: string
}

/** Liga o error tracking. Sem DSN, não liga e devolve false. */
export function initTelemetry(options: TelemetryOptions = {}): boolean {
  const dsn = options.dsn ?? config.SENTRY_DSN
  if (!dsn) return false
  Sentry.init({
    dsn,
    release: process.env.TMS_RELEASE || 'dev',
    environment: config.NODE_ENV,
    serverName: 'tms-api',
    // No SDK 11 o sendDefaultPii virou dataCollection: tudo desligado (o
    // scrubEvent já ignora esses campos, e as integrações que os preencheriam
    // nem estão ligadas; os dois cintos valem juntos)
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      databaseQueryData: false,
      queues: false,
      stackFrameVariables: false,
      frameContextLines: 0,
    },
    maxBreadcrumbs: 0,
    beforeBreadcrumb: () => null,
    // Só erros: sem traces (Fase 6) e sem integração de requisição, de
    // variáveis locais, de linhas de código nem de console
    defaultIntegrations: false,
    integrations: [
      // Saída do processo preservada (o start.sh depende dela para o Render
      // reiniciar): sem a Sentry, `strict` trata a rejeição como exceção não
      // tratada, e o processo sai com 1 do mesmo jeito
      Sentry.onUncaughtExceptionIntegration(),
      Sentry.onUnhandledRejectionIntegration({ mode: 'strict' }),
    ],
    beforeSend: scrubEvent,
    ...(options.transport ? { transport: options.transport } : {}),
  })
  enabled = true
  return true
}

/**
 * Envia um erro 5xx. Chamado só pelo `default` do onError: o ApiError (4xx) e
 * os erros de validação, de corpo e de rota inexistente nunca passam por aqui.
 */
export function captureServerError(
  error: unknown,
  { clientVersion, route, requestId }: ServerErrorTags
): void {
  if (!enabled) return
  try {
    Sentry.withScope(scope => {
      scope.setTags({
        'client.version': clientVersion,
        ...(route ? { route } : {}),
        ...(requestId ? { request_id: requestId } : {}),
      })
      Sentry.captureException(error)
    })
  } catch {
    // O error tracking nunca derruba a resposta
  }
}

/** SENTRY_SMOKE: um erro de teste ao subir, para ver o caminho até o Sentry. */
export async function sendSmokeError(): Promise<void> {
  captureServerError(new Error('sentry smoke'), {
    clientVersion: 'unknown',
    route: 'smoke',
    requestId: undefined,
  })
  await Sentry.flush(2000)
}

/** Só nos testes: desliga o SDK e volta ao estado sem init. */
export async function resetTelemetry(): Promise<void> {
  enabled = false
  await Sentry.close(500)
}
