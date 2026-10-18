import type { SheetEvent } from '@tms/sheet-core'
import { useToast } from '@tms/ui'
import { useCallback } from 'react'
import { useSheetStore } from './context'
import type { CommitResult } from './store/sheetStore'

// Toda alteração da tela passa por aqui: aplica na hora (otimista), enfileira
// e mostra o aviso com Desfazer (doc/arquitetura §6.6, passo 3).

export function commitMessage(result: CommitResult): string {
  if (result.ok) return result.batch.label
  const first = result.issues[0]?.message
  if (result.kind === 'forbidden') return 'Você não pode alterar este campo.'
  if (result.kind === 'conflict')
    return 'O valor mudou enquanto você editava. Confira e tente de novo.'
  return first ? `Não foi possível: ${first}.` : 'Não foi possível alterar.'
}

export function useCommit() {
  const store = useSheetStore()
  const toast = useToast()
  return useCallback(
    (events: readonly SheetEvent[], label: string): CommitResult => {
      const result = store.getState().commit(events, label)
      if (!result.ok) {
        toast.show({ message: commitMessage(result) })
        return result
      }
      const id = result.batch.clientBatchId
      toast.show({
        message: label,
        action: {
          label: 'Desfazer',
          onPress: () => {
            const undone = store.getState().undo(id)
            if (undone && !undone.ok)
              toast.show({
                message: 'Não dá para desfazer: o valor mudou depois.',
              })
          },
        },
      })
      return result
    },
    [store, toast]
  )
}
