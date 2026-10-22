import { onlineManager } from '@tanstack/react-query'
import { useToast } from '@tms/ui'
import { randomUUID } from 'expo-crypto'
import { useRef } from 'react'
import { useRunOperation } from '../../lib/queries/operations'
import { type OperationCharacter, operationError } from './operationErrors'

export function useRevertOperation(
  chronicleId: string,
  characters: ReadonlyMap<string, OperationCharacter>
) {
  const run = useRunOperation(chronicleId)
  const toast = useToast()
  const keys = useRef(new Map<string, string>())
  const revert = async (target: {
    revertsOperationId?: string
    revertsBatchId?: string
  }) => {
    if (!onlineManager.isOnline()) {
      toast.show({ message: 'Conecte-se para desfazer uma operação.' })
      return
    }
    const id = target.revertsOperationId ?? (target.revertsBatchId as string)
    const key = keys.current.get(id) ?? randomUUID()
    keys.current.set(id, key)
    try {
      await run.mutateAsync({
        clientOperationId: key,
        kind: 'revert',
        ...target,
      })
      toast.show({ message: 'Alteração desfeita.' })
    } catch (error) {
      toast.show({ message: operationError(error, characters) })
    }
  }
  return { revert, pending: run.isPending }
}
