import type { FieldId } from '@tms/sheet-core'
import { BottomSheet } from '@tms/ui'
import { type ReactNode, useMemo, useState } from 'react'
import { useFieldEntry, useSheet } from '../context'
import { resolveView } from '../views'
import { ActionsMenu } from './ActionsMenu'
import { AllResources } from './AllResources'
import { FieldSheetContext, type SheetTarget } from './sheetContext'

// Um BottomSheet por ficha (design system: BottomSheet e CombatDock): o
// detalhe de um campo, "Todos os recursos" ou as ações da ficha. Linhas e
// chips do dock só pedem para abrir; o corpo vem do registry (variante
// `sheet`), então um tipo novo traz o próprio sheet sem mexer aqui.

export function FieldSheetProvider({
  children,
}: {
  readonly children: ReactNode
}) {
  const { mode } = useSheet()
  const [target, setTarget] = useState<SheetTarget | null>(null)
  const api = useMemo(
    () => ({ mode, open: setTarget, close: () => setTarget(null) }),
    [mode]
  )
  return (
    <FieldSheetContext.Provider value={api}>
      {children}
      {target ? <PlaySheet target={target} onClose={api.close} /> : null}
    </FieldSheetContext.Provider>
  )
}

function PlaySheet({
  target,
  onClose,
}: {
  readonly target: SheetTarget
  readonly onClose: () => void
}) {
  const { model } = useSheet()
  const title =
    target.kind === 'field'
      ? (model.fields.get(target.id)?.def.label ?? '')
      : target.kind === 'all'
        ? 'Todos os recursos'
        : 'Ações da ficha'
  return (
    <BottomSheet visible title={title} onClose={onClose} testID="play-sheet">
      {target.kind === 'field' ? <FieldSheetBody id={target.id} /> : null}
      {target.kind === 'all' ? <AllResources /> : null}
      {target.kind === 'actions' ? <ActionsMenu /> : null}
    </BottomSheet>
  )
}

function FieldSheetBody({ id }: { readonly id: FieldId }) {
  const { model } = useSheet()
  const entry = useFieldEntry(id)
  if (!entry) return null
  const View = resolveView(model.skin, entry.resolved.type, 'sheet')
  return <View resolved={entry.resolved} sheet={entry.sheet} />
}
