import { treaty } from '@elysiajs/eden'
import type { App } from '../../api/src/index'
import { API_URL } from './env'
import { createAuthFetch } from './http'
import { session } from './session'

export { fetchWithTimeout, REQUEST_TIMEOUT_MS } from './http'

export const api = treaty<App>(API_URL, {
  fetcher: createAuthFetch(session) as typeof fetch,
})

/**
 * Eden não lança erro em respostas HTTP de erro (retorna { data, error }).
 * O TanStack Query precisa de uma Promise rejeitada para marcar a query como erro.
 */
export const unwrap = <T>({ data, error }: { data: T; error: unknown }) => {
  if (error) throw error
  return data as NonNullable<T>
}
