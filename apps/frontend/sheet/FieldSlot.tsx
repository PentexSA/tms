import type { FieldId } from '@tms/sheet-core'
import { memo } from 'react'
import { useFieldEntry, useSheet } from './context'
import { resolveView, type Variant } from './views'

/**
 * Um campo na variante pedida pelo layout; o registry escolhe o componente.
 * Assina só o próprio campo: re-renderiza quando ele muda, não a ficha.
 */
export const FieldSlot = memo(function FieldSlot({
  id,
  variant,
}: {
  readonly id: FieldId
  readonly variant: Variant
}) {
  const { model } = useSheet()
  const entry = useFieldEntry(id)
  if (!entry) return null
  const View = resolveView(model.skin, entry.resolved.type, variant)
  return <View resolved={entry.resolved} sheet={entry.sheet} />
})
