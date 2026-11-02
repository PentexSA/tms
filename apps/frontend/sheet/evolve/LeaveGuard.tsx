import { useStore } from 'zustand'
import { UnsavedChangesGuard } from '../../components/UnsavedChangesGuard'
import type { SheetStore } from '../store/sheetStore'
import { changesLabel } from './ModeBar'

// Sair da ficha com rascunho de Criação/Editar pede confirmação. A guarda é
// a genérica (UnsavedChangesGuard, T-56), com a contagem do rascunho.

export function LeaveGuard({ store }: { readonly store: SheetStore }) {
  const count = useStore(store, s => s.draft?.size ?? 0)
  return (
    <UnsavedChangesGuard
      when={count > 0}
      message={
        count === 1
          ? '1 alteração da edição ainda não foi salva e será descartada.'
          : `${changesLabel(count)} da edição ainda não foram salvas e serão descartadas.`
      }
      onDiscard={() => store.getState().discardDraft()}
    />
  )
}
