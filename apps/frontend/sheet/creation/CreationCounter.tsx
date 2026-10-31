import type { FieldId, PriorityBudget } from '@tms/sheet-core'
import { Text, tokens } from '@tms/ui'
import { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import { useSheet, useSheetSelector } from '../context'
import { useCreation } from './CreationContext'
import { counterSpoken, counterText, findGroup, groupFor } from './creation'
import { RadioChips } from './RadioChips'
import { usePriorityChoice } from './usePriorityChoice'

/**
 * O contador do grupo da conta no cabeçalho de um bloco da ficha ("Físicos
 * 5/7"), só no modo de criação. Vem do `checkCreation` do store, a mesma
 * conta do servidor; nada é calculado aqui. Num grupo de prioridades, a
 * escolha (7 · 5 · 3) fica ao lado, no próprio bloco que ela distribui.
 * `line`: fora de um cabeçalho, quando a aba já diz qual é o grupo.
 */
export function CreationCounter({
  fieldIds,
  line = false,
}: {
  readonly fieldIds: readonly FieldId[]
  readonly line?: boolean
}) {
  const { model, mode } = useSheet()
  const creation = useCreation()
  const where = useMemo(() => groupFor(model, fieldIds), [model, fieldIds])
  const group = useSheetSelector(s => findGroup(s.check, where))
  const budget = useMemo(
    () =>
      (model.template.creation?.budgets ?? []).find(
        (b): b is PriorityBudget =>
          b.id === where?.budget && b.rule === 'priority-budget'
      ) ?? null,
    [model, where]
  )
  // Escolher só em `creating`; depois, a prioridade fica fixa
  const pickable =
    Boolean(budget && creation?.info) && creation?.status === 'creating'
  if (mode !== 'create' || !creation?.active || !group) return null
  const over = group.budget !== null && group.extra > 0
  const counter =
    pickable && group.budget === null ? (
      <Text variant="caption" color="action">
        Prioridade
      </Text>
    ) : (
      <Text
        variant="caption"
        color={group.budget === null || over ? 'action' : 'inkMuted'}
        accessibilityLabel={counterSpoken(group)}
        testID={`counter-${group.id}`}
      >
        {counterText(group)}
      </Text>
    )
  if (!pickable && !line) return counter
  return (
    <View
      style={[styles.row, line && styles.line]}
      testID={line ? `creation-line-${group.id}` : undefined}
    >
      {counter}
      {pickable && budget ? (
        <PriorityPicker budget={budget} group={group.id} label={group.label} />
      ) : null}
    </View>
  )
}

/** Os chips 7 · 5 · 3; a escolha vai para o servidor (`creation.patch`). */
function PriorityPicker({
  budget,
  group,
  label,
}: {
  readonly budget: PriorityBudget
  readonly group: string
  readonly label: string
}) {
  const choice = usePriorityChoice(budget, group)
  if (!choice) return null
  return (
    <RadioChips
      label={`Prioridade de ${label}`}
      options={choice.options}
      value={choice.rank < 0 ? null : String(choice.rank)}
      onChange={id => choice.choose(Number(id))}
      disabled={choice.busy}
      testID={`priority-${budget.id}-${group}`}
    />
  )
}

const styles = StyleSheet.create({
  row: {
    flexShrink: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: tokens.space[2],
  },
  line: {
    justifyContent: 'space-between',
    paddingHorizontal: tokens.layout.gutter,
    paddingVertical: tokens.space[1],
  },
})
