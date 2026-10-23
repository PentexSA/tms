import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import { api, unwrap } from '../api'
import { chronicleKeys } from './chronicles'

export const backstageKeys = {
  sessions: (id: string) => ['chronicles', id, 'sessions'] as const,
  transfer: (id: string) => ['chronicles', id, 'transfer'] as const,
  history: (id: string) => ['chronicles', id, 'history'] as const,
}

export const useSessions = (id: string) =>
  useQuery({
    queryKey: backstageKeys.sessions(id),
    queryFn: async ({ signal }) =>
      unwrap(await api.chronicles({ id }).sessions.get({ fetch: { signal } })),
  })

export const useCreateSession = (id: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: {
      clientCommandId: string
      date: string
      title: string
      summary: string
      privateNotes: string
    }) => unwrap(await api.chronicles({ id }).sessions.post(body)),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: backstageKeys.sessions(id) }),
        queryClient.invalidateQueries({ queryKey: chronicleKeys.one(id) }),
      ]),
  })
}

export const useUpdateSession = (id: string, sessionId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: {
      clientCommandId: string
      revision: number
      date: string
      title: string
      summary: string
      privateNotes: string
    }) =>
      unwrap(await api.chronicles({ id }).sessions({ sessionId }).patch(body)),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: backstageKeys.sessions(id) }),
        queryClient.invalidateQueries({ queryKey: chronicleKeys.one(id) }),
      ]),
  })
}

export const useUpdateChronicle = (id: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: {
      clientCommandId: string
      revision: number
      name: string
      description: string
      imageUrl: string | null
      options?: Record<string, boolean | number | string>
    }) => unwrap(await api.chronicles({ id }).patch(body)),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: chronicleKeys.one(id) }),
        queryClient.invalidateQueries({ queryKey: chronicleKeys.all }),
      ]),
  })
}

export const useTransfer = (id: string, enabled = true) =>
  useQuery({
    queryKey: backstageKeys.transfer(id),
    enabled,
    retry: false,
    queryFn: async ({ signal }) =>
      unwrap(await api.chronicles({ id }).transfer.get({ fetch: { signal } })),
  })

export const useProposeTransfer = (id: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: {
      clientCommandId: string
      recipientId: string
    }) => unwrap(await api.chronicles({ id }).transfer.post(body)),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: backstageKeys.transfer(id) }),
  })
}

export const useAcceptTransfer = (id: string, transferId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (clientCommandId: string) =>
      unwrap(
        await api
          .chronicles({ id })
          .transfer({ transferId })
          .accept.post({ clientCommandId })
      ),
    onSuccess: () => {
      queryClient.clear()
    },
  })
}

const useTransferDecision = (
  id: string,
  transferId: string,
  decision: 'reject' | 'cancel'
) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (clientCommandId: string) => {
      const transfer = api.chronicles({ id }).transfer({ transferId })
      return unwrap(
        decision === 'reject'
          ? await transfer.reject.post({ clientCommandId })
          : await transfer.cancel.post({ clientCommandId })
      )
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: backstageKeys.transfer(id) }),
  })
}

export const useRejectTransfer = (id: string, transferId: string) =>
  useTransferDecision(id, transferId, 'reject')

export const useCancelTransfer = (id: string, transferId: string) =>
  useTransferDecision(id, transferId, 'cancel')

export interface ChronicleHistoryFilters {
  readonly characterId?: string
  readonly authorId?: string
  readonly from?: string
  readonly to?: string
}

export const useChronicleHistory = (
  id: string,
  enabled: boolean,
  filters: ChronicleHistoryFilters = {}
) =>
  useInfiniteQuery({
    queryKey: [...backstageKeys.history(id), filters] as const,
    enabled,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal }) =>
      unwrap(
        await api.chronicles({ id }).history.get({
          query: {
            limit: 50,
            ...filters,
            ...(pageParam ? { cursor: pageParam } : {}),
          },
          fetch: { signal },
        })
      ),
    getNextPageParam: last => last.nextCursor ?? undefined,
  })
