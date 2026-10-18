import { QueryClient } from '@tanstack/react-query'

import { statusOf } from './errors'

// 4xx é resposta definitiva (sem acesso, inválido): repetir só atrasa a tela.
// Rede e 5xx tentam de novo, até 2 vezes.
export const shouldRetry = (failureCount: number, error: unknown) => {
  const status = statusOf(error)
  if (status !== undefined && status >= 400 && status < 500) return false
  return failureCount < 2
}

export const createQueryClient = () =>
  new QueryClient({
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
