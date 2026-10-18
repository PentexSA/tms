import Elysia from 'elysia'
import { logger } from '../logger'

// Log de acesso sem conteúdo: nunca headers (Authorization, cookies), corpo da
// requisição (senhas) nem corpo da resposta (tokens, fichas). A mensagem do erro
// também fica de fora, porque o erro de validação repete o valor recebido.
export const loggerMiddleware = new Elysia({ name: 'logger' })
  .derive({ as: 'global' }, () => ({
    startTime: performance.now(),
    requestId: crypto.randomUUID(),
  }))
  .onAfterHandle({ as: 'global' }, ({ set, requestId }) => {
    set.headers['x-request-id'] = requestId
  })
  .onAfterResponse({ as: 'global' }, ctx => {
    // Elysia preenche `error` no contexto quando a requisição falha, mas não o declara no tipo
    const { request, path, set, startTime, requestId, error } =
      ctx as typeof ctx & { error?: unknown }

    logger.info(
      {
        requestId,
        method: request.method,
        path,
        status: set.status,
        responseTime: Math.round(performance.now() - startTime),
        ...(error ? { error: errorKind(error) } : {}),
      },
      `${request.method} ${path} - ${set.status}`
    )
  })

export function errorKind(error: unknown): string {
  if (error && typeof error === 'object') {
    const code = (error as { code?: unknown }).code
    if (typeof code === 'string' || typeof code === 'number')
      return String(code)
    return error.constructor?.name ?? 'Error'
  }
  return typeof error
}
