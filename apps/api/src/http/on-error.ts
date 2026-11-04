import { logger } from '../logger'
import {
  parseClientVersion,
  requestIdOf,
} from '../middlewares/loggerMiddleware'
import { captureServerError } from '../telemetry'
import { ApiError } from './errors'
import { safeError } from './safe-error'

// Toda resposta de erro é genérica: sem stack trace, sem mensagem interna e
// sem o valor recebido (o erro de validação do Elysia repete o corpo, que pode
// ter senha). De um erro de validação só saem os caminhos dos campos.
//
// O 500 é o único registrado aqui e o único com o id no corpo: o header sai em
// toda resposta, mas o `unwrap` do app descarta a resposta antes de `messageOf`
// montar a mensagem, e a pessoa precisa do código para relatar o erro.

interface ErrorContext {
  readonly code: string | number
  readonly error: unknown
  readonly request: Request
  /** O template da rota (`/chronicles/:id`); vazio em rota inexistente. */
  readonly route?: string
  readonly set: { status?: number | string; headers: Record<string, unknown> }
}

const fieldsOf = (error: unknown): string[] => {
  const all = (error as { all?: { path?: unknown }[] }).all
  if (!Array.isArray(all)) return []
  return [
    ...new Set(
      all.map(e => (typeof e.path === 'string' ? e.path : '')).filter(Boolean)
    ),
  ]
}

export function onError({ code, error, request, route, set }: ErrorContext) {
  if (error instanceof ApiError) {
    set.status = error.status
    return { error: error.message, ...(error.details ?? {}) }
  }
  switch (code) {
    case 'VALIDATION':
      set.status = 400
      return { error: 'dados inválidos', fields: fieldsOf(error) }
    case 'PARSE':
      set.status = 400
      return { error: 'corpo inválido' }
    case 'NOT_FOUND':
      set.status = 404
      return { error: 'não encontrado' }
    default: {
      set.status = 500
      const requestId = requestIdOf(request)
      // Nunca o erro cru, nem na chave `err`: o serializer do Pino incluiria a
      // mensagem e o stack originais
      logger.error({ requestId, error: safeError(error) }, 'erro interno')
      // Único ponto de captura: o ApiError (4xx) e os demais casos já
      // retornaram acima
      captureServerError(error, {
        clientVersion: parseClientVersion(
          request.headers.get('x-tms-client-version')
        ),
        route: route || null,
        requestId,
      })
      return { error: 'erro interno', requestId }
    }
  }
}
