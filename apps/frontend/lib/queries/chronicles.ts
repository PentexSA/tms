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
  table: (id: string) => ['chronicles', id, 'table'] as const,
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

/** Só o narrador. Com fichas de outros jogadores, a API exige o nome digitado. */
export const useDeleteChronicle = (id: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (confirm: string) =>
      unwrap(await api.chronicles({ id }).delete({ confirm })),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: chronicleKeys.one(id) })
      return queryClient.invalidateQueries({ queryKey: chronicleKeys.all })
    },
  })
}

/**
 * Tira um jogador da crônica (só o narrador; v3, Etapa 7): as fichas dele vão
 * para arquivadas e, por padrão, os convites ativos são revogados.
 */
export const useRemoveMember = (id: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (args: {
      readonly userId: string
      readonly revokeInvites: boolean
    }) =>
      unwrap(
        await api
          .chronicles({ id })
          .members({ userId: args.userId })
          .delete({ revokeInvites: args.revokeInvites })
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: chronicleKeys.one(id) }),
  })
}

/** Sair da crônica (o próprio jogador): as fichas ficam, só leitura. */
export const useLeaveChronicle = (id: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () =>
      unwrap(await api.chronicles({ id }).members.me.delete()),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: chronicleKeys.all }),
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
    mutationFn: async (
      input:
        | Record<string, unknown>
        | {
            readonly values: Record<string, unknown>
            readonly kind: 'npc'
            readonly clientCommandId: string
          }
    ) => {
      const npc =
        'values' in input &&
        input.kind === 'npc' &&
        typeof input.clientCommandId === 'string'
      const body = npc
        ? {
            values: input.values as Record<string, unknown>,
            kind: 'npc' as const,
            clientCommandId: input.clientCommandId as string,
          }
        : { values: input as Record<string, unknown> }
      return unwrap(await api.chronicles({ id }).characters.post(body))
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: chronicleKeys.characters(id),
        }),
        queryClient.invalidateQueries({ queryKey: chronicleKeys.all }),
      ]),
  })
}

export const useSetNpcVisibility = (
  chronicleId: string,
  characterId: string
) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      readonly visibility: 'hidden' | 'identity' | 'full'
      readonly revision: number
      readonly clientCommandId: string
    }) =>
      unwrap(await api.characters({ id: characterId }).visibility.post(input)),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['characters', characterId],
        }),
        queryClient.invalidateQueries({
          queryKey: chronicleKeys.characters(chronicleId),
        }),
        queryClient.invalidateQueries({
          queryKey: chronicleKeys.all,
        }),
      ]),
  })
}

export const useSetNpcPresentation = (
  chronicleId: string,
  characterId: string
) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      readonly portraitUrl: string | null
      readonly revision: number
      readonly clientCommandId: string
    }) =>
      unwrap(
        await api.characters({ id: characterId }).presentation.patch(input)
      ),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['characters', characterId],
        }),
        queryClient.invalidateQueries({
          queryKey: chronicleKeys.characters(chronicleId),
        }),
        queryClient.invalidateQueries({ queryKey: chronicleKeys.all }),
      ]),
  })
}

/**
 * A Mesa do narrador (Etapa 19): todas as fichas da crônica numa requisição.
 * A API responde 404 para quem não narra; a tela nem pede.
 */
/**
 * O que a Mesa mostra: em jogo (creating, pending e active) ou fora
 * (archived e dead). Pending precisa aparecer para o narrador avaliar a ficha.
 */
export type TableScope = 'playing' | 'out'

const SCOPE_STATUS: Readonly<Record<TableScope, string>> = {
  playing: 'creating,pending,active',
  out: 'archived,dead',
}

export const useChronicleTable = (
  id: string,
  enabled: boolean,
  scope: TableScope = 'playing'
) =>
  useQuery({
    queryKey: [...chronicleKeys.table(id), scope] as const,
    enabled,
    // Sem tempo real: toda volta à Mesa rebusca
    staleTime: 0,
    // O filtro é no servidor: a resposta não leva o que a tela esconde
    queryFn: async ({ signal }) =>
      unwrap(
        await api.chronicles({ id }).table.get({
          query: { status: SCOPE_STATUS[scope] },
          fetch: { signal },
        })
      ),
  })
