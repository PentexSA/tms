import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api, unwrap } from '../api'

// Crônicas e convites (Etapa 11). As chaves ficam aqui para a invalidação
// depois de criar, entrar ou revogar.

export const chronicleKeys = {
  systems: ['systems'] as const,
  all: ['chronicles'] as const,
  one: (id: string) => ['chronicles', id] as const,
  invites: (id: string) => ['chronicles', id, 'invites'] as const,
  characters: (id: string) => ['chronicles', id, 'characters'] as const,
}

export const useSystems = () =>
  useQuery({
    queryKey: chronicleKeys.systems,
    queryFn: async ({ signal }) =>
      unwrap(await api.systems.get({ fetch: { signal } })),
    staleTime: 10 * 60_000,
  })

export const useChronicles = () =>
  useQuery({
    queryKey: chronicleKeys.all,
    queryFn: async ({ signal }) =>
      unwrap(await api.chronicles.get({ fetch: { signal } })),
  })

export const useChronicle = (id: string) =>
  useQuery({
    queryKey: chronicleKeys.one(id),
    queryFn: async ({ signal }) =>
      unwrap(await api.chronicles({ id }).get({ fetch: { signal } })),
  })

export const useCreateChronicle = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: { name: string; systemCode: string }) =>
      unwrap(await api.chronicles.post(body)),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: chronicleKeys.all }),
  })
}

export const useInvites = (id: string, enabled: boolean) =>
  useQuery({
    queryKey: chronicleKeys.invites(id),
    queryFn: async ({ signal }) =>
      unwrap(await api.chronicles({ id }).invites.get({ fetch: { signal } })),
    enabled,
  })

export const useCreateInvite = (id: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () =>
      unwrap(await api.chronicles({ id }).invites.post({})),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: chronicleKeys.invites(id) }),
  })
}

export const useRevokeInvite = (id: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (inviteId: string) =>
      unwrap(await api.chronicles({ id }).invites({ inviteId }).delete()),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: chronicleKeys.invites(id) }),
  })
}

export const useAcceptInvite = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (code: string) =>
      unwrap(await api.invites.accept.post({ code })),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: chronicleKeys.all }),
  })
}

/** "ABCD EFGH ..." para ler e ditar; a API aceita com ou sem espaços. */
export const formatInviteCode = (code: string) =>
  code.replace(/(.{4})(?=.)/g, '$1 ')

export const useChronicleCharacters = (id: string) =>
  useQuery({
    queryKey: chronicleKeys.characters(id),
    queryFn: async ({ signal }) =>
      unwrap(
        await api.chronicles({ id }).characters.get({ fetch: { signal } })
      ),
  })

export const useCreateCharacter = (id: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: Record<string, unknown>) =>
      unwrap(await api.chronicles({ id }).characters.post({ values })),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: chronicleKeys.characters(id),
        }),
        queryClient.invalidateQueries({ queryKey: chronicleKeys.all }),
      ]),
  })
}
