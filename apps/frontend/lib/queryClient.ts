import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'

import { statusOf } from './errors'
import { captureError } from './telemetry'

// 4xx é resposta definitiva (sem acesso, inválido): repetir só atrasa a tela.
// Rede e 5xx tentam de novo, até 2 vezes.
export const shouldRetry = (failureCount: number, error: unknown) => {
  const status = statusOf(error)
  if (status !== undefined && status >= 400 && status < 500) return false
  return failureCount < 2
}

export const createQueryClient = () =>
  new QueryClient({
    // Falha definitiva (depois das tentativas). O que não é defeito (4xx, rede,
    // 5xx sem id) o telemetry descarta: captureError só envia o que
    // classifyError aceita
    queryCache: new QueryCache({
      onError: (error, query) =>
        captureError(error, { source: 'query', queryKey: query.queryKey }),
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _result, mutation) =>
        captureError(error, {
          source: 'mutation',
          queryKey: mutation.options.mutationKey,
        }),
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: shouldRetry,
      },
      mutations: {
        // POST não é idempotente: nunca repetir automaticamente
        retry: false,
      },
    },
  })
