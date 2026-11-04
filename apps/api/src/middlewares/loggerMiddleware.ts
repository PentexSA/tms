import Elysia, { StatusMap } from 'elysia'
import { safeError } from '../http/safe-error'
import { logger } from '../logger'

// Log de acesso sem conteúdo: nunca headers (Authorization, cookies), corpo da
// requisição (senhas) nem corpo da resposta (tokens, fichas). De um erro sai só
// o tipo (errorKind). O detalhe de um 500 vai numa linha própria do onError,
// depois do filtro de safeError (http/on-error.ts), com o mesmo requestId.

interface RequestTrace {
  readonly requestId: string
  readonly startTime: number
}

// Por Request, e não no contexto: o onRequest é o único hook que roda em toda
// requisição (o derive não roda em rota inexistente, e o onAfterHandle não roda
// em erro), e o contexto dele não chega aos outros hooks em todos os caminhos
const traces = new WeakMap<Request, RequestTrace>()

/** O id da requisição, para quem precisa citá-lo (onError). */
export const requestIdOf = (request: Request): string | undefined =>
  traces.get(request)?.requestId

const CLIENT_VERSION = /^\d{1,4}\.\d{1,4}\.\d{1,4}$/

/**
 * A versão do app, para observar: não libera nem bloqueia nada. O header é
 * dado não confiável, e o formato fechado limita a cardinalidade e impede
 * texto livre no log.
 */
export const parseClientVersion = (value: string | null): string =>
  value !== null && CLIENT_VERSION.test(value) ? value : 'unknown'

/** `set.status` também aceita o nome do status ("Not Found"). */
export const numericStatus = (status: unknown): number | null => {
  if (typeof status === 'number') return status
  if (typeof status === 'string' && Object.hasOwn(StatusMap, status))
    return StatusMap[status as keyof typeof StatusMap]
  return null
}

export const accessLevel = (
  status: number | null
): 'error' | 'warn' | 'info' => {
  if (status !== null && status >= 500) return 'error'
  return status === 429 ? 'warn' : 'info'
}

export const loggerMiddleware = new Elysia({ name: 'logger' })
  // onRequest é sempre global no Elysia
  .onRequest(({ request, set }) => {
    const requestId = crypto.randomUUID()
    traces.set(request, { requestId, startTime: performance.now() })
    set.headers['x-request-id'] = requestId
  })
  .onAfterResponse({ as: 'global' }, ctx => {
    // Elysia preenche `error` no contexto quando a requisição falha, mas não o declara no tipo
    const { request, path, route, set, error } = ctx as typeof ctx & {
      error?: unknown
    }
    // O health check do Render e o monitor só gerariam ruído
    if (route === '/health') return

    const trace = traces.get(request)
    const status = numericStatus(set.status)

    logger[accessLevel(status)](
      {
        requestId: trace?.requestId ?? null,
        method: request.method,
        path,
        route: route || null,
        status,
        responseTime: trace
          ? Math.round(performance.now() - trace.startTime)
          : null,
        clientVersion: parseClientVersion(
          request.headers.get('x-tms-client-version')
        ),
        ...(error ? { error: errorKind(error) } : {}),
      },
      `${request.method} ${path} - ${status ?? 'status desconhecido'}`
    )
  })

/** O tipo do erro: código curto ou nome da classe, nunca a mensagem. */
export function errorKind(error: unknown): string {
  const { code, name } = safeError(error)
  return code ?? name
}
