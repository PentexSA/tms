// O filtro do que o app envia ao error tracking (Sentry, Fase 3). Sem importar
// o SDK: roda no Jest e no tsc, e o telemetry.web.ts só liga as pontas. Um erro
// do app pode carregar texto da tela (nota, nome de personagem) e a URL pode
// carregar id e código de convite, então o evento é remontado por lista de
// campos permitidos, e o que o SDK trouxe fora dela não sai.

import { classifyError, requestIdOf } from './errors'

// O alfabeto do código (apps/api/src/chronicles/invite-code.ts) em qualquer
// caixa, sem o U, mais O, I e L, que o aceite normaliza. Cru (26 seguidos) ou
// formatado (4 × 6 + 2).
const INVITE_CHAR = '[0-9A-TV-Za-tv-z]'
const INVITE_CODE = new RegExp(
  `(^|[^0-9A-Za-z])(?:${INVITE_CHAR}{26}|${INVITE_CHAR}{4}(?:[ -]${INVITE_CHAR}{4}){5}[ -]${INVITE_CHAR}{2})(?![0-9A-Za-z])`,
  'g'
)
// O fragmento de uma URL ou de um caminho ("/join#…"); o "#" de um método
// privado no stack ("at Foo.#bar") não vem depois de "/"
const INVITE_FRAGMENT =
  /((?:[a-z][a-z0-9+.-]*:\/\/|\/)[^\s'"<>#]*)#[^\s'"<>]+/gi

// Copiado de apps/api/src/http/safe-error.ts (são poucas linhas; um pacote
// novo custaria mais). Mudou lá, mude aqui.
export function redact(text: string): string {
  return (
    text
      .replace(/([a-z][a-z0-9+.-]*:\/\/)[^\s'"<>]*@/gi, '$1[credencial]@')
      .replace(/\beyJ[\w-]+\.[\w-]+(?:\.[\w-]*)?/g, '[jwt]')
      .replace(/\bBearer\s+[^\s,;'"]+/gi, 'Bearer [token]')
      .replace(
        /[^\s@'"<>(),:;=/[\]]+@([\p{L}\p{N}.-]+)/gu,
        (match, domain: string) => (/^[\d.]+$/.test(domain) ? match : '[email]')
      )
      // O código de convite (P12): 26 caracteres do base32 Crockford, cru ou
      // no formato da tela (grupos de 4), e o fragmento de URL que o link leva.
      // Toda sequência do alfabeto conta: um falso positivo só apaga texto de
      // diagnóstico. Sem lookbehind, que nem todo motor de regex do app tem
      .replace(INVITE_FRAGMENT, '$1#[convite]')
      .replace(INVITE_CODE, '$1[convite]')
  )
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi

/**
 * Só origem e caminho: sem query nem hash (o código de convite, por exemplo) e
 * com o UUID trocado por `:id`.
 */
export function scrubUrl(raw: unknown): string | undefined {
  if (typeof raw !== 'string' || !raw) return undefined
  const absolute = /^[a-z][a-z0-9+.-]*:/i.test(raw)
  let url: URL
  try {
    url = new URL(raw, 'http://relativa.invalid')
  } catch {
    return undefined
  }
  const path = url.pathname.replace(UUID, ':id')
  return absolute ? `${url.origin}${path}` : path
}

// Tipos mínimos do evento: só o que o filtro lê. O do SDK é compatível.
export interface FrameLike {
  filename?: string
  function?: string
  lineno?: number
  colno?: number
  in_app?: boolean
}
export interface EventLike {
  event_id?: string
  timestamp?: number
  platform?: string
  level?: string
  release?: string
  environment?: string
  tags?: Record<string, unknown>
  fingerprint?: string[]
  exception?: {
    values?: {
      type?: string
      value?: string
      mechanism?: { type?: string; handled?: boolean }
      stacktrace?: { frames?: FrameLike[] }
    }[]
  }
  breadcrumbs?: BreadcrumbLike[]
  debug_meta?: {
    images?: { type?: string; code_file?: string; debug_id?: string }[]
  }
}
export interface BreadcrumbLike {
  type?: string
  category?: string
  timestamp?: number
  level?: string
  data?: Record<string, unknown>
}

const MAX_TEXT = 300
const MAX_FRAMES = 50
const MAX_BREADCRUMBS = 20
const SAFE_NAME = /^[A-Za-z_$][\w$.]{0,63}$/
const SAFE_TAG = /^[\w.:-]{1,64}$/

const DEBUG_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Os debug ids dos bundles (type `sourcemap`): é por eles que o Sentry casa o
 * stack com os source maps enviados no build. Sem isto o stack chega minificado.
 */
function debugImages(event: EventLike) {
  const images = (event.debug_meta?.images ?? [])
    .filter(
      i =>
        i.type === 'sourcemap' &&
        typeof i.debug_id === 'string' &&
        DEBUG_ID.test(i.debug_id) &&
        scrubUrl(i.code_file)
    )
    .map(i => ({
      type: 'sourcemap',
      code_file: scrubUrl(i.code_file),
      debug_id: i.debug_id,
    }))
  return images.length ? { debug_meta: { images } } : {}
}

const TAGS = ['source', 'request_id', 'status', 'events'] as const

const text = (value: unknown, max = MAX_TEXT): string | undefined =>
  typeof value === 'string' && value ? redact(value).slice(0, max) : undefined

const finite = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined

/** Só navegação e HTTP, com a URL sem query nem id. Os demais saem. */
export function scrubBreadcrumb(crumb: BreadcrumbLike): BreadcrumbLike | null {
  const data = crumb.data ?? {}
  const base = {
    ...(finite(crumb.timestamp) !== undefined
      ? { timestamp: crumb.timestamp }
      : {}),
  }
  if (crumb.category === 'navigation')
    return {
      ...base,
      category: 'navigation',
      data: { from: scrubUrl(data.from), to: scrubUrl(data.to) },
    }
  if (crumb.category === 'fetch' || crumb.category === 'xhr')
    return {
      ...base,
      type: 'http',
      category: crumb.category,
      data: {
        ...(typeof data.method === 'string' && /^[A-Z]{3,7}$/.test(data.method)
          ? { method: data.method }
          : {}),
        url: scrubUrl(data.url),
        ...(finite(data.status_code) !== undefined
          ? { status_code: data.status_code }
          : {}),
      },
    }
  return null
}

const frameOf = (frame: FrameLike): FrameLike => ({
  ...(scrubUrl(frame.filename) ? { filename: scrubUrl(frame.filename) } : {}),
  ...(text(frame.function) ? { function: text(frame.function) } : {}),
  ...(finite(frame.lineno) !== undefined ? { lineno: frame.lineno } : {}),
  ...(finite(frame.colno) !== undefined ? { colno: frame.colno } : {}),
  ...(typeof frame.in_app === 'boolean' ? { in_app: frame.in_app } : {}),
})

/**
 * O evento final, só com os campos da lista. Pura. A mensagem do JSON.parse
 * (que repete a entrada) não sai, e as demais passam pela redação.
 */
export function scrubWebEvent<T extends EventLike>(event: T): EventLike {
  const tags: Record<string, string> = {}
  for (const key of TAGS) {
    const value = event.tags?.[key]
    if (typeof value === 'string' && SAFE_TAG.test(value)) tags[key] = value
  }
  const breadcrumbs = (event.breadcrumbs ?? [])
    .map(scrubBreadcrumb)
    .filter((c): c is BreadcrumbLike => c !== null)
    .slice(-MAX_BREADCRUMBS)
  return {
    ...(event.event_id ? { event_id: event.event_id } : {}),
    ...(finite(event.timestamp) !== undefined
      ? { timestamp: event.timestamp }
      : {}),
    platform: event.platform,
    level: event.level,
    ...(event.release ? { release: text(event.release, 64) } : {}),
    ...(event.environment ? { environment: text(event.environment, 64) } : {}),
    tags,
    ...(Array.isArray(event.fingerprint)
      ? {
          fingerprint: event.fingerprint
            .filter(f => typeof f === 'string')
            .map(f => f.slice(0, 64)),
        }
      : {}),
    exception: {
      values: (event.exception?.values ?? []).map(v => {
        const type =
          typeof v.type === 'string' && SAFE_NAME.test(v.type)
            ? v.type
            : 'Error'
        return {
          type,
          ...(type !== 'SyntaxError' && text(v.value)
            ? { value: text(v.value) }
            : {}),
          ...(v.mechanism
            ? {
                mechanism: {
                  type: SAFE_NAME.test(v.mechanism.type ?? '')
                    ? v.mechanism.type
                    : 'generic',
                  handled: v.mechanism.handled === true,
                },
              }
            : {}),
          ...(v.stacktrace?.frames
            ? {
                stacktrace: {
                  frames: v.stacktrace.frames.slice(-MAX_FRAMES).map(frameOf),
                },
              }
            : {}),
        }
      }),
    },
    ...(breadcrumbs.length ? { breadcrumbs } : {}),
    ...debugImages(event),
  }
}

/** Limite de eventos por aba: um erro em loop não gasta a cota. */
export function createEventLimiter(max = 20): () => boolean {
  let sent = 0
  return () => sent++ < max
}

export interface CaptureContext {
  /** De onde veio: `query`, `mutation`, `boundary` ou `sync`. */
  readonly source: 'query' | 'mutation' | 'boundary' | 'sync'
  readonly queryKey?: readonly unknown[]
  readonly tags?: Readonly<Record<string, string>>
  readonly fingerprint?: readonly string[]
}

export interface Capture {
  readonly error: Error
  readonly tags: Record<string, string>
  readonly fingerprint?: string[]
}

const keyPart = (queryKey: readonly unknown[] | undefined): string => {
  const first = queryKey?.[0]
  return typeof first === 'string' && /^[\w-]{1,40}$/.test(first)
    ? first
    : 'unknown'
}

/**
 * O que enviar para um erro, ou null se não é defeito (ver classifyError). O
 * erro do Eden carrega o corpo da resposta e nunca vai cru: vira
 * `Error('HTTP 500')`, agrupado por status e pela primeira parte da queryKey,
 * com o requestId como tag.
 */
export function toCapture(
  error: unknown,
  context: CaptureContext
): Capture | null {
  const kind = classifyError(error)
  if (kind === 'ignore') return null
  const tags: Record<string, string> = {
    source: context.source,
    ...context.tags,
  }
  if (kind === 'http') {
    const { status, value } = error as { status: number; value: unknown }
    const requestId = requestIdOf(value)
    if (requestId) tags.request_id = requestId
    const safe = new Error(`HTTP ${status}`)
    safe.name = 'HttpError'
    return {
      error: safe,
      tags,
      fingerprint: ['http', String(status), keyPart(context.queryKey)],
    }
  }
  return {
    error:
      error instanceof Error
        ? error
        : new Error(`valor lançado: ${typeof error}`),
    tags,
    ...(context.fingerprint ? { fingerprint: [...context.fingerprint] } : {}),
  }
}
