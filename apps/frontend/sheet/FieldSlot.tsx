import type { FieldId } from '@tms/sheet-core'
import { useResolvedField, useSheet } from './context'
import { resolveView, type Variant } from './views'

/** Um campo na variante pedida pelo layout; o registry escolhe o componente. */
export function FieldSlot({
  id,
  variant,
}: {
  readonly id: FieldId
  readonly variant: Variant
}) {
  const { model, resolved: sheet } = useSheet()
  const resolved = useResolvedField(id)
  if (!resolved) return null
  const View = resolveView(model.skin, resolved.type, variant)
  return <View resolved={resolved} sheet={sheet} />
}
