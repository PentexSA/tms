import {
  onlineManager,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { api, unwrap } from '../api'
import { chronicleKeys } from './chronicles'

export interface OperationTarget {
  readonly characterId: string
  readonly field?: string
}

export interface DamageRequest {
  readonly kind: 'damage' | 'heal'
  readonly amount: number
  readonly type?: string
  readonly targets: readonly OperationTarget[]
}

export interface OperationPreview {
  readonly characterId: string
  readonly name: string
  readonly sheetVersion: number
  readonly ok: boolean
  readonly reason?: string
  readonly changes?: readonly {
    readonly label: string
    readonly change: string
  }[]
}

export const previewOperation = async (id: string, body: DamageRequest) =>
  unwrap(
    await api.chronicles({ id }).operations.preview.post({
      ...body,
      targets: [...body.targets],
    })
  ).characters as OperationPreview[]

export interface OperationRequest {
  readonly clientOperationId: string
  readonly kind: 'damage' | 'heal' | 'revert'
  readonly amount?: number
  readonly type?: string
  readonly targets?: readonly (OperationTarget & {
    readonly sheetVersion: number
  })[]
  readonly revertsOperationId?: string
  readonly revertsBatchId?: string
}

/** Escrita imediata, sem fila offline e sem retentativa automática. A tela
 * conserva a chave em caso de resposta perdida. */
export function useRunOperation(chronicleId: string) {
  const client = useQueryClient()
  return useMutation({
    networkMode: 'always',
    retry: false,
    mutationFn: async (body: OperationRequest) => {
      if (!onlineManager.isOnline()) throw new Error('offline')
      return unwrap(
        await api.chronicles({ id: chronicleId }).operations.post({
          ...body,
          targets: body.targets ? [...body.targets] : undefined,
        })
      )
    },
    onSuccess: async result => {
      await Promise.all([
        client.invalidateQueries({ queryKey: chronicleKeys.one(chronicleId) }),
        ...result.characters.map(c =>
          client.invalidateQueries({
            queryKey: ['characters', c.characterId],
          })
        ),
      ])
    },
  })
}
