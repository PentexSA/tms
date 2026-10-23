import { useMutation, useQueryClient } from '@tanstack/react-query'
import { randomUUID } from 'expo-crypto'
import { useRef } from 'react'

import { sheetKeys } from '../../sheet/data'
import { api, unwrap } from '../api'
import { isNetworkError } from '../errors'
import { chronicleKeys } from './chronicles'

// Comandos da criação por pontos (doc/plano-v4.md, Etapas 4 e 5). Exigem rede
// nesta versão. Cada intenção leva uma chave (`clientCommandId`): depois de
// um timeout ou resposta perdida, a nova tentativa reusa a mesma chave e o
// servidor devolve o resultado gravado, sem aplicar duas vezes. A chave só
// muda quando a intenção termina (sucesso ou recusa com resposta).

/** Uma chave por intenção, mantida enquanto o resultado é desconhecido. */
function useCommandKey() {
  const key = useRef<string | null>(null)
  return {
    current: () => {
      key.current ??= randomUUID()
      return key.current
    },
    settle: (error: unknown) => {
      // Sem resposta: a próxima tentativa é a mesma intenção
      if (!error || !isNetworkError(error)) key.current = null
    },
  }
}

const useRefresh = (characterId: string, chronicleId?: string) => {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: sheetKeys.character(characterId),
      }),
      ...(chronicleId
        ? [
            queryClient.invalidateQueries({
              queryKey: chronicleKeys.table(chronicleId),
            }),
          ]
        : []),
    ])
}

export interface CreationPatch {
  readonly revision: number
  readonly choices?: Record<string, unknown>
  readonly config?: Record<string, unknown> | null
}

/** Salvar prioridades (dono) ou ajustar o orçamento (narrador). */
export function useSaveCreation(characterId: string) {
  const key = useCommandKey()
  const refresh = useRefresh(characterId)
  return useMutation({
    mutationFn: async (patch: CreationPatch) =>
      unwrap(
        await api.characters({ id: characterId }).creation.patch({
          ...patch,
          clientCommandId: key.current(),
        })
      ),
    onSettled: (_data, error) => {
      key.settle(error)
      return refresh()
    },
  })
}

export interface CompleteRequest {
  readonly revision: number
  readonly sheetVersion: number
}

export function useCompleteCreation(characterId: string, chronicleId: string) {
  const key = useCommandKey()
  const refresh = useRefresh(characterId, chronicleId)
  return useMutation({
    mutationFn: async (request: CompleteRequest) =>
      unwrap(
        await api.characters({ id: characterId }).creation.complete.post({
          ...request,
          clientCommandId: key.current(),
        })
      ),
    onSettled: (_data, error) => {
      key.settle(error)
      return refresh()
    },
  })
}

export function useApproveCreation(characterId: string, chronicleId: string) {
  const key = useCommandKey()
  const refresh = useRefresh(characterId, chronicleId)
  return useMutation({
    mutationFn: async () =>
      unwrap(
        await api.characters({ id: characterId }).creation.approve.post({
          clientCommandId: key.current(),
        })
      ),
    onSettled: (_data, error) => {
      key.settle(error)
      return refresh()
    },
  })
}

export function useReturnCreation(characterId: string, chronicleId: string) {
  const key = useCommandKey()
  const refresh = useRefresh(characterId, chronicleId)
  return useMutation({
    mutationFn: async (reason: string) =>
      unwrap(
        await api.characters({ id: characterId }).creation.return.post({
          reason,
          clientCommandId: key.current(),
        })
      ),
    onSettled: (_data, error) => {
      key.settle(error)
      return refresh()
    },
  })
}

export interface ChronicleCreationSettings {
  readonly revision: number
  readonly approval?: boolean
  readonly defaults?: Record<string, unknown>
}

/** Aprovação de ficha nova e orçamento padrão da crônica (narrador). */
export function useChronicleCreationSettings(chronicleId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (settings: ChronicleCreationSettings) =>
      unwrap(
        await api
          .chronicles({ id: chronicleId })
          ['creation-settings'].patch(settings)
      ),
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: chronicleKeys.one(chronicleId),
      }),
  })
}
