// Mensagem para a pessoa a partir do erro do Eden ({ status, value }). A API
// já responde com mensagens genéricas em pt-BR; sem resposta, é a conexão.

const OFFLINE = 'Não foi possível falar com o servidor. Verifique a conexão.'

export function messageOf(
  error: unknown,
  fallback = 'Algo deu errado'
): string {
  if (error && typeof error === 'object') {
    const value = (error as { value?: unknown }).value
    if (value && typeof value === 'object') {
      const message = (value as { error?: unknown }).error
      if (typeof message === 'string' && message) return message
    }
    const status = (error as { status?: unknown }).status
    if (status === undefined || status === 0) return OFFLINE
  }
  return fallback
}

export function statusOf(error: unknown): number | undefined {
  const status =
    error && typeof error === 'object'
      ? (error as { status?: unknown }).status
      : undefined
  return typeof status === 'number' ? status : undefined
}
