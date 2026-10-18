import { ApiError } from './errors'

// Toda resposta de erro é genérica: sem stack trace, sem mensagem interna e
// sem o valor recebido (o erro de validação do Elysia repete o corpo, que pode
// ter senha). De um erro de validação só saem os caminhos dos campos.

interface ErrorContext {
  readonly code: string | number
  readonly error: unknown
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

export function onError({ code, error, set }: ErrorContext) {
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
    default:
      set.status = 500
      return { error: 'erro interno' }
  }
}
