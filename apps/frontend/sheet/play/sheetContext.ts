import type { FieldId, SheetMode } from '@tms/sheet-core'
import { createContext, useContext } from 'react'

// O pedido de abrir um sheet, separado do host (FieldSheet.tsx) para as views
// importarem sem puxar o registry de volta (sem ciclo de import).

export type SheetTarget =
  | { readonly kind: 'field'; readonly id: FieldId }
  | { readonly kind: 'all' }
  | { readonly kind: 'actions' }

export interface FieldSheetApi {
  readonly mode: SheetMode
  open(target: SheetTarget): void
  close(): void
}

export const FieldSheetContext = createContext<FieldSheetApi | null>(null)

export const useFieldSheet = (): FieldSheetApi | null =>
  useContext(FieldSheetContext)

/**
 * Abrir o detalhe do campo, ou null quando a linha não abre nada: fora de uma
 * ficha montada ou em Evoluir (lá a linha é o editor).
 */
export function useOpenField(id: FieldId): (() => void) | null {
  const api = useFieldSheet()
  if (!api || api.mode === 'evolve') return null
  return () => api.open({ kind: 'field', id })
}
