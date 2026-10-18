import {
  type FieldId,
  type ResolvedField,
  type ResolvedSheet,
  type RoleName,
  resolve,
  type SheetData,
  type SheetMode,
  type SheetModel,
} from '@tms/sheet-core'
import { createContext, type ReactNode, useContext, useMemo } from 'react'

// O que toda a árvore da ficha lê: modelo compilado, valores resolvidos,
// papéis (do servidor) e modo. Os componentes usam só os hooks abaixo, para a
// Etapa 16 trocar a fonte (store com assinatura por campo) sem mexer neles.

interface SheetContextValue {
  readonly model: SheetModel
  readonly resolved: ResolvedSheet
  readonly roles: ReadonlySet<RoleName>
  readonly mode: SheetMode
}

const SheetContext = createContext<SheetContextValue | null>(null)

export function SheetProvider({
  model,
  sheet,
  roles,
  mode = 'read',
  children,
}: {
  readonly model: SheetModel
  readonly sheet: SheetData
  readonly roles: readonly RoleName[]
  readonly mode?: SheetMode
  readonly children: ReactNode
}) {
  const resolved = useMemo(() => resolve(model, sheet), [model, sheet])
  const roleSet = useMemo(() => new Set(roles), [roles])
  const value = useMemo(
    () => ({ model, resolved, roles: roleSet, mode }),
    [model, resolved, roleSet, mode]
  )
  return <SheetContext.Provider value={value}>{children}</SheetContext.Provider>
}

export function useSheet(): SheetContextValue {
  const value = useContext(SheetContext)
  if (!value) throw new Error('useSheet precisa de um SheetProvider')
  return value
}

export function useResolvedField(id: FieldId): ResolvedField | undefined {
  return useSheet().resolved.get(id)
}
