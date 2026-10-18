import type {
  FieldId,
  ResolvedField,
  ResolvedSheet,
  RoleName,
  SheetMode,
  SheetModel,
} from '@tms/sheet-core'
import { createContext, type ReactNode, useContext, useMemo } from 'react'
import { useStore } from 'zustand'
import { useStoreWithEqualityFn } from 'zustand/traditional'
import type {
  FieldEntry,
  SheetActions,
  SheetState,
  SheetStore,
} from './store/sheetStore'

// O que toda a árvore da ficha lê. O modelo e os papéis não mudam durante a
// vida do store; os valores vêm do store com assinatura por campo
// (doc/arquitetura §6.5): gastar Sangue re-renderiza só quem assina o Sangue.

interface SheetContextValue {
  readonly store: SheetStore
  readonly model: SheetModel
  readonly roles: ReadonlySet<RoleName>
}

const SheetContext = createContext<SheetContextValue | null>(null)

export function SheetProvider({
  store,
  children,
}: {
  readonly store: SheetStore
  readonly children: ReactNode
}) {
  const value = useMemo(() => {
    const { model, roles } = store.getState()
    return { store, model, roles: new Set(roles) }
  }, [store])
  return <SheetContext.Provider value={value}>{children}</SheetContext.Provider>
}

function useSheetContext(): SheetContextValue {
  const value = useContext(SheetContext)
  if (!value) throw new Error('useSheet precisa de um SheetProvider')
  return value
}

/** Modelo, papéis, store e modo (trocar de modo re-renderiza a ficha toda). */
export function useSheet(): SheetContextValue & { readonly mode: SheetMode } {
  const context = useSheetContext()
  const mode = useStore(context.store, s => s.mode)
  return { ...context, mode }
}

/** Um pedaço do estado; re-renderiza só quando `equal` diz que mudou. */
export function useSheetSelector<T>(
  selector: (state: SheetState & SheetActions) => T,
  equal: (a: T, b: T) => boolean = Object.is
): T {
  return useStoreWithEqualityFn(useSheetContext().store, selector, equal)
}

/** A entrada do campo: a mesma referência enquanto o campo não muda. */
export const useFieldEntry = (id: FieldId): FieldEntry | undefined =>
  useSheetSelector(s => s.entries.get(id))

export const useResolvedField = (id: FieldId): ResolvedField | undefined =>
  useFieldEntry(id)?.resolved

/** A ficha resolvida inteira: re-renderiza a cada mudança. Prefira os acima. */
export const useResolvedSheet = (): ResolvedSheet =>
  useSheetSelector(s => s.resolved)

/** O store da ficha, para ações (commit, desfazer) sem assinar nada. */
export const useSheetStore = (): SheetStore => useSheetContext().store
