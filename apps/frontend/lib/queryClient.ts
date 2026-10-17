import { QueryClient } from '@tanstack/react-query'

export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 2,
      },
      mutations: {
        // POST não é idempotente: nunca repetir automaticamente
        retry: false,
      },
    },
  })
