import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Todo } from '@tms/db'

import { api, unwrap } from '../lib/api'

export const todoKeys = {
  all: ['todos'] as const,
}

export const useTodos = () =>
  useQuery({
    queryKey: todoKeys.all,
    queryFn: async ({ signal }) =>
      unwrap(await api.todos.get({ fetch: { signal } })) as Todo[],
  })

export const useCreateTodo = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (title: string) =>
      unwrap(await api.todos.post({ title })) as Todo,
    // Retornar a Promise mantém a mutation pendente até a lista ser recarregada
    onSuccess: () => queryClient.invalidateQueries({ queryKey: todoKeys.all }),
  })
}
