import { treaty } from '@elysiajs/eden'
import { config } from '@tms/config/env'

import type { App } from '../../api/src/index'

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

export const api = treaty<App>(config.EXPO_PUBLIC_API_URL, {
  fetcher: fetchWithTimeout as typeof fetch,
})

/**
 * Eden não lança erro em respostas HTTP de erro (retorna { data, error }).
 * O TanStack Query precisa de uma Promise rejeitada para marcar a query como erro.
 */
export const unwrap = <T>({ data, error }: { data: T; error: unknown }) => {
  if (error) throw error
  return data as NonNullable<T>
}
