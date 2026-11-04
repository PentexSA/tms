import { NO_STORE_HEADERS } from './noStore'
import { APP_VERSION } from './version'

export const REQUEST_TIMEOUT_MS = 10_000

// Só para observar qual versão gerou cada log. Não é o x-tms-client, cujo valor
// `native` decide o transporte do refresh token.
const CLIENT_VERSION_HEADER = 'x-tms-client-version'

const withClientVersion = (
  input: RequestInfo | URL,
  init: RequestInit
): Headers => {
  // O `headers` do init substitui os do Request: sem ele, os do Request valem
  const isRequest = typeof Request !== 'undefined' && input instanceof Request
  const headers = new Headers(
    init.headers ?? (isRequest ? input.headers : undefined)
  )
  headers.set(CLIENT_VERSION_HEADER, APP_VERSION)
  return headers
}

/**
 * fetch com timeout: aborta a requisição após REQUEST_TIMEOUT_MS
 * ou quando o signal recebido (ex: do TanStack Query) for abortado. Todo pedido
 * do app à API passa por aqui (Eden e POST de sessão) e leva a versão do app.
 */
export const fetchWithTimeout = (
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  const { signal } = init

  if (signal?.aborted) controller.abort()
  signal?.addEventListener('abort', () => controller.abort(), { once: true })

  return fetch(input, {
    ...init,
    headers: withClientVersion(input, init),
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout))
}

export interface AuthFetchSession {
  headers(): Record<string, string>
  readonly credentials: 'include' | 'omit' | 'same-origin'
  refresh(): Promise<boolean>
}

const pathOf = (input: RequestInfo | URL) => {
  const url = typeof input === 'string' ? input : input.toString()
  return new URL(url, 'http://x').pathname
}

/**
 * Onde o 401 não é sessão vencida: as rotas /auth/* e a exclusão de conta,
 * em que o 401 é a resposta à senha. Renovar e repetir mandaria a senha de
 * novo e gastaria duas tentativas do limite (quem chama renova antes).
 */
const noRenew = (input: RequestInfo | URL, init: RequestInit) => {
  const path = pathOf(input)
  return (
    /\/auth\//.test(path) ||
    (path.endsWith('/me') && init.method?.toUpperCase() === 'DELETE')
  )
}

/**
 * fetch com a sessão: põe o token de acesso e, num 401, renova a sessão uma
 * vez (single-flight) e repete a requisição. As rotas /auth/* (e a exclusão
 * de conta) não repetem.
 */
export function createAuthFetch(
  session: AuthFetchSession,
  base: typeof fetchWithTimeout = fetchWithTimeout
) {
  const withSession = (init: RequestInit): RequestInit => {
    const headers = new Headers(init.headers)
    for (const [k, v] of Object.entries(session.headers())) headers.set(k, v)
    // Só no nativo (noStore.native.ts): nada da API vai para o cache HTTP
    for (const [k, v] of Object.entries(NO_STORE_HEADERS)) headers.set(k, v)
    return { ...init, headers, credentials: session.credentials }
  }
  return async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const first = await base(input, withSession(init))
    if (first.status !== 401 || noRenew(input, init)) return first
    if (!(await session.refresh())) return first
    return base(input, withSession(init))
  }
}
