// Mensagem para a pessoa a partir do erro do Eden ({ status, value }). A API
// já responde com mensagens genéricas em pt-BR; sem resposta, é a conexão.

const OFFLINE = 'Não foi possível falar com o servidor. Verifique a conexão.'

/**
 * Sem resposta HTTP (rede, timeout, CORS). O Eden não lança: devolve status
 * 503 com o erro do fetch em `value`, e um 503 de verdade traz o corpo da
 * API. Sem essa distinção, cair a rede pareceria erro do servidor.
 */
export function isNetworkError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const { status, value } = error as { status?: unknown; value?: unknown }
  return status === undefined || status === 0 || value instanceof Error
}

export function messageOf(
  error: unknown,
  fallback = 'Algo deu errado'
): string {
  if (error && typeof error === 'object') {
    if (isNetworkError(error)) return OFFLINE
    const value = (error as { value?: unknown }).value
    if (value && typeof value === 'object') {
      const message = (value as { error?: unknown }).error
      if (typeof message === 'string' && message) return message
    }
  }
  return fallback
}

/** O status HTTP da resposta; sem resposta (rede), undefined. */
export function statusOf(error: unknown): number | undefined {
  if (isNetworkError(error)) return undefined
  const status =
    error && typeof error === 'object'
      ? (error as { status?: unknown }).status
      : undefined
  return typeof status === 'number' ? status : undefined
}
