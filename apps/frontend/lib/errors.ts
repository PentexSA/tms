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

const REQUEST_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Num 5xx da API, acrescenta o código que a pessoa cita ao relatar o erro: os
 * 8 primeiros caracteres do `requestId`, que bastam para achar a linha com
 * busca por substring no log. Sem id válido (502 do proxy), a mensagem fica como está.
 */
export function withErrorCode(
  message: string,
  status: unknown,
  body: unknown
): string {
  if (typeof status !== 'number' || status < 500) return message
  const id = requestIdOf(body)
  if (!id) return message
  return `${message} (código do erro: ${id.slice(0, 8)})`
}

/** O `requestId` do corpo de um 5xx da API, se for um UUID; senão, undefined. */
export function requestIdOf(body: unknown): string | undefined {
  const id =
    body && typeof body === 'object'
      ? (body as { requestId?: unknown }).requestId
      : undefined
  return typeof id === 'string' && REQUEST_ID.test(id) ? id : undefined
}

export function messageOf(
  error: unknown,
  fallback = 'Algo deu errado'
): string {
  if (error && typeof error === 'object') {
    if (isNetworkError(error)) return OFFLINE
    const { status, value } = error as { status?: unknown; value?: unknown }
    if (value && typeof value === 'object') {
      const message = (value as { error?: unknown }).error
      if (typeof message === 'string' && message)
        return withErrorCode(message, status, value)
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

export type ErrorKind = 'ignore' | 'http' | 'bug'

const isAbort = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  (error as { name?: unknown }).name === 'AbortError'

// fetch que não chegou ao servidor, fora do Eden (os POST de sessão): cada
// navegador tem a sua mensagem
const FETCH_FAILURE =
  /^(failed to fetch|load failed|networkerror|network request failed)/i

/**
 * O que fazer com um erro para o error tracking. O app funciona offline e a
 * cota é pequena, então só o que é defeito sai:
 * - `ignore`: 4xx (resposta definitiva), falha de rede, AbortError e 5xx sem
 *   `requestId` válido (o 502 do proxy, que não veio da API);
 * - `http`: 5xx da API, que traz o id para achar a linha do log;
 * - `bug`: o resto.
 */
export function classifyError(error: unknown): ErrorKind {
  if (isAbort(error)) return 'ignore'
  if (
    error &&
    typeof error === 'object' &&
    'status' in error &&
    'value' in error
  ) {
    const { status, value } = error as { status?: unknown; value?: unknown }
    if (isNetworkError(error)) return 'ignore'
    if (typeof status !== 'number' || status < 500) return 'ignore'
    return requestIdOf(value) ? 'http' : 'ignore'
  }
  if (error instanceof TypeError && FETCH_FAILURE.test(error.message))
    return 'ignore'
  return 'bug'
}
