import type { FieldId } from '@tms/sheet-core'
import { Text } from '@tms/ui'
import { useMemo } from 'react'
import { useSheet, useSheetSelector } from '../context'
import { useCreation } from './CreationContext'
import { counterSpoken, counterText, findGroup, groupFor } from './creation'

/**
 * O contador do grupo da conta no cabeçalho de um bloco da ficha ("Físicos
 * 5/7"), só no modo de criação. Vem do `checkCreation` do store, a mesma
 * conta do servidor; nada é calculado aqui.
 */
export function CreationCounter({
  fieldIds,
}: {
  readonly fieldIds: readonly FieldId[]
}) {
  const { model, mode } = useSheet()
  const creation = useCreation()
  const where = useMemo(() => groupFor(model, fieldIds), [model, fieldIds])
  const group = useSheetSelector(s => findGroup(s.check, where))
  if (mode !== 'create' || !creation?.active || !group) return null
  const over = group.budget !== null && group.extra > 0
  return (
    <Text
      variant="caption"
      color={group.budget === null || over ? 'action' : 'inkMuted'}
      accessibilityLabel={counterSpoken(group)}
      testID={`counter-${group.id}`}
    >
      {counterText(group)}
    </Text>
  )
}
