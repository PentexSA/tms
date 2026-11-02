import {
  type FieldId,
  isDraftMode,
  type RoleName,
  type SheetMode,
  type SheetModel,
} from '@tms/sheet-core'
import { memo } from 'react'
import { useFieldEntry, useSheet } from './context'
import { canEditIn } from './evolve/hooks'
import { hasView, resolveView, type Variant } from './views'

/**
 * O campo vira o editor neste modo: o papel o escreve e o tipo tem editor.
 * O contador "N itens" do bloco (T-58) usa o mesmo teste: só o editor da
 * lista deixa o próprio cabeçalho para o bloco.
 */
export function drawsEditor(
  model: SheetModel,
  roles: ReadonlySet<RoleName>,
  id: FieldId,
  mode: SheetMode
): boolean {
  const type = model.fields.get(id)?.def.type
  return Boolean(
    type &&
      isDraftMode(mode) &&
      canEditIn(model, roles, id, mode) &&
      hasView(model.skin, type, 'editor')
  )
}

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
  const editing = drawsEditor(model, roles, id, mode)
  const View = resolveView(
    model.skin,
    entry.resolved.type,
    editing ? 'editor' : variant
  )
  return <View resolved={entry.resolved} sheet={entry.sheet} />
})
