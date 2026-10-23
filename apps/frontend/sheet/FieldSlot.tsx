import { type FieldId, isDraftMode } from '@tms/sheet-core'
import { memo } from 'react'
import { useFieldEntry, useSheet } from './context'
import { canEditIn } from './evolve/hooks'
import { hasView, resolveView, type Variant } from './views'

/**
 * Um campo na variante pedida pelo layout; o registry escolhe o componente.
 * Assina só o próprio campo: re-renderiza quando ele muda, não a ficha. Em
 * Evoluir, o campo que o papel escreve pede a variante `editor`; tipo sem
 * editor fica na variante do layout.
 */
export const FieldSlot = memo(function FieldSlot({
  id,
  variant,
}: {
  readonly id: FieldId
  readonly variant: Variant
}) {
  const { model, roles, mode } = useSheet()
  const entry = useFieldEntry(id)
  if (!entry) return null
  const { type } = entry.resolved
  const editing =
    isDraftMode(mode) &&
    canEditIn(model, roles, id, mode) &&
    hasView(model.skin, type, 'editor')
  const View = resolveView(model.skin, type, editing ? 'editor' : variant)
  return <View resolved={entry.resolved} sheet={entry.sheet} />
})
