export const REQUEST_TIMEOUT_MS = 10_000

/**
 * fetch com timeout: aborta a requisição após REQUEST_TIMEOUT_MS
 * ou quando o signal recebido (ex: do TanStack Query) for abortado
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

  return fetch(input, { ...init, signal: controller.signal }).finally(() =>
    clearTimeout(timeout)
  )
}

export interface AuthFetchSession {
  headers(): Record<string, string>
  readonly credentials: 'include' | 'omit' | 'same-origin'
  refresh(): Promise<boolean>
}

const isAuthPath = (input: RequestInfo | URL) => {
  const url = typeof input === 'string' ? input : input.toString()
  return /\/auth\//.test(new URL(url, 'http://x').pathname)
}

/**
 * fetch com a sessão: põe o token de acesso e, num 401, renova a sessão uma
 * vez (single-flight) e repete a requisição. As rotas /auth/* não repetem.
 */
export function createAuthFetch(
  session: AuthFetchSession,
  base: typeof fetchWithTimeout = fetchWithTimeout
) {
  const withSession = (init: RequestInit): RequestInit => {
    const headers = new Headers(init.headers)
    for (const [k, v] of Object.entries(session.headers())) headers.set(k, v)
    return { ...init, headers, credentials: session.credentials }
  }
  return async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const first = await base(input, withSession(init))
    if (first.status !== 401 || isAuthPath(input)) return first
    if (!(await session.refresh())) return first
    return base(input, withSession(init))
  }
}
