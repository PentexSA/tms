import { StateBadge } from '@tms/ui'

import { characterState } from '../../components/chronicles/characterState'
import { useSheet } from '../context'
import { deadLabel, useLifecycle } from '../policy'
import { useCreation } from './CreationContext'
import { sheetStateRow } from './creation'

/**
 * O estado da ficha aberta (D-02, P04-D §3.5), sob o nome grande: a mesma
 * regra da lista e da Mesa, recalculada a cada resposta (a ficha montada do
 * cache acompanha a resposta nova, lição do c7c1423). Região viva: a troca
 * (o narrador pediu ajuste, concluiu) é anunciada. Sem `CreationContext`
 * (o viewer do NPC revelado, prévias), não há selo.
 */
export function SheetStateBadge() {
  const creation = useCreation()
  const { locked } = useLifecycle()
  const { model, roles } = useSheet()
  if (!creation) return null
  const state = characterState(
    sheetStateRow({
      status: creation.status,
      kind: creation.kind,
      locked,
      info: creation.info,
    }),
    { narrating: roles.has('storyteller'), deadLabel: deadLabel(model) }
  )
  if (!state) return null
  return (
    <StateBadge
      label={state.label}
      tone={state.tone}
      live
      testID="sheet-state"
    />
  )
}
