import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'

import { api, unwrap } from '../api'

export const rollKeys = {
  feed: (chronicleId: string) => ['chronicles', chronicleId, 'rolls'] as const,
}

export interface RollFeedFilters {
  readonly characterId?: string
  readonly hidden?: 'true' | 'false'
}

export const useRollFeed = (
  chronicleId: string,
  filters: RollFeedFilters = {}
) =>
  useInfiniteQuery({
    queryKey: [...rollKeys.feed(chronicleId), filters] as const,
    staleTime: 0,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal }) =>
      unwrap(
        await api.chronicles({ id: chronicleId }).rolls.get({
          query: {
            limit: 30,
            ...filters,
            ...(pageParam ? { cursor: pageParam } : {}),
          },
          fetch: { signal },
        })
      ),
    getNextPageParam: last => last.nextCursor ?? undefined,
  })

export const useFreeRoll = (chronicleId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: {
      readonly clientRollId: string
      readonly dice: number
      readonly difficulty: number
      readonly specialty: boolean
      readonly label: string
      readonly hidden: boolean
    }) => unwrap(await api.chronicles({ id: chronicleId }).rolls.post(body)),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: rollKeys.feed(chronicleId) }),
  })
}
