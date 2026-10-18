import { useInfiniteQuery } from '@tanstack/react-query'

import { api, unwrap } from '../api'

// Histórico de alterações da ficha (Etapa 15 na API, Etapa 19 na tela),
// paginado pelo cursor `next`. A chave fica embaixo da ficha
// (['characters', id]): rebuscar a ficha também rebusca o histórico.

export const historyKeys = {
  of: (characterId: string) => ['characters', characterId, 'history'] as const,
}

export const useCharacterHistory = (characterId: string, enabled: boolean) =>
  useInfiniteQuery({
    queryKey: historyKeys.of(characterId),
    enabled,
    staleTime: 0,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal }) =>
      unwrap(
        await api.characters({ id: characterId }).history.get({
          query: pageParam ? { before: pageParam } : {},
          fetch: { signal },
        })
      ),
    getNextPageParam: last => last.next ?? undefined,
  })
