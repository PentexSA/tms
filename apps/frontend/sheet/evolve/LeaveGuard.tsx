import type { SheetModel } from '@tms/sheet-core'
import { useToast } from '@tms/ui'
import { useStore } from 'zustand'
import { UnsavedChangesGuard } from '../../components/UnsavedChangesGuard'
import type { SheetStore } from '../store/sheetStore'
import { changesLabel } from './ModeBar'
import { saveDraftNow } from './saveDraft'

// Sair da ficha com rascunho de Criação/Editar pede confirmação. A guarda é
// a genérica (UnsavedChangesGuard, T-56), com a contagem do rascunho e o
// "Salvar e sair" (D-01): o mesmo lote do "Salvar" da barra.

export function LeaveGuard({
  store,
  model,
}: {
  readonly store: SheetStore
  readonly model: SheetModel
}) {
  const count = useStore(store, s => s.draft?.size ?? 0)
  const toast = useToast()
  return (
    <UnsavedChangesGuard
      when={count > 0}
      message={
        count === 1
          ? '1 alteração da edição ainda não foi salva e será descartada.'
          : `${changesLabel(count)} da edição ainda não foram salvas e serão descartadas.`
      }
      onDiscard={() => store.getState().discardDraft()}
      onSave={() => {
        const result = saveDraftNow(model, store)
        // Sem "Desfazer": o store da ficha sai com a tela; ele fica no
        // Histórico. O lote já está no outbox do aparelho
        if (result.ok && result.batchId !== null)
          toast.show({ message: `Salvo: ${result.label}` })
        return result
      }}
    />
  )
}
