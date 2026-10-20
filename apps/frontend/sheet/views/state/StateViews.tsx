import {
  describe,
  planState,
  type ResolvedState,
  short,
  statePreview,
} from '@tms/sheet-core'
import {
  Choice,
  type ChoiceOption,
  Pressable,
  Text,
  tokens,
  useTheme,
} from '@tms/ui'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useSheet, useSheetSelector, useSheetStore } from '../../context'
import { planLabel, useEditable } from '../../play/editable'
import { haptics } from '../../play/haptics'
import { useOpenField } from '../../play/sheetContext'
import { useCommit } from '../../useCommit'
import type { FieldViewProps } from '../types'

// Estado com opções que mudam outros campos (design system: StateChoice). A
// linha mostra a opção e o hint; o sheet lista as opções com os valores
// efetivos de cada uma (statePreview do core) e, se o template declara
// `cost`, a alternância de pagar a troca. Nada aqui sabe que são as Formas
// do Garou: rótulos, hints, notas e custo vêm do template. O chip do dock é o
// GenericChip ("Forma · Crinos").

export function StateRow({ resolved, sheet }: FieldViewProps) {
  const { colors } = useTheme()
  const open = useOpenField(resolved.id)
  const r = resolved as ResolvedState
  const content = (
    <>
      <Text variant="fieldLabel" style={styles.grow}>
        {r.field.def.label}
      </Text>
      <View style={styles.value}>
        <Text variant="number">{r.option.label}</Text>
        {r.option.hint ? (
          <Text variant="caption" color="inkMuted">
            {r.option.hint}
          </Text>
        ) : null}
      </View>
    </>
  )
  const style = [styles.row, { borderBottomColor: colors.borderSubtle }]
  const a11y = {
    accessibilityLabel: describe(r, sheet),
    accessibilityValue: { text: short(r, sheet) },
  }
  if (!open)
    return (
      <View accessible {...a11y} style={style}>
        {content}
      </View>
    )
  return (
    <Pressable
      accessibilityRole="button"
      {...a11y}
      accessibilityHint="Abre as opções"
      onPress={open}
      style={style}
    >
      {content}
    </Pressable>
  )
}

export function StateSheet({ resolved, sheet }: FieldViewProps) {
  const { colors } = useTheme()
  const { model } = useSheet()
  const store = useSheetStore()
  const commit = useCommit()
  const { editable, reason } = useEditable(resolved.id)
  const [pay, setPay] = useState(false)
  const r = resolved as ResolvedState
  const def = r.field.def
  const cost = def.cost
  // A ficha inteira: a prévia de cada opção e o custo dependem de outros
  // campos (os atributos, a Fúria). O sheet fica aberto pouco tempo
  const values = useSheetSelector(s => s.values)
  const preview = statePreview(model, values, r.id)
  const label = (id: string) => model.fields.get(id)?.def.label ?? id
  const options: ChoiceOption[] = preview.map(o => ({
    id: o.id,
    label: o.label,
    meta: [o.hint, o.summary].filter(Boolean).join(' · ') || undefined,
    // Por extenso para o leitor de tela: "Crinos, lobisomem, Força 7, ..."
    spoken: [
      o.label,
      o.hint,
      ...o.effects.map(e => `${label(e.field)} ${e.value}`),
    ]
      .filter(Boolean)
      .join(', '),
  }))
  // Dá para pagar? A resposta do core para qualquer outra opção vale para
  // todas: o custo é o mesmo
  const other = def.options.find(o => o.id !== r.option.id)
  const payable =
    cost?.optional && other
      ? planState(model, values, r.id, other.id, { payCost: true })
      : null
  const blocked = payable && !payable.ok ? payable.reason : null
  const paying = cost ? (cost.optional ? pay && !blocked : true) : false

  const choose = (id: string) => {
    const plan = planState(model, store.getState().values, r.id, id, {
      payCost: paying,
    })
    if (!plan.ok) return
    const result = commit(plan.events, planLabel(plan))
    if (!result.ok) return
    if (plan.events.length > 1) haptics.severe()
    else haptics.selection()
  }

  return (
    <View style={styles.box}>
      {editable ? (
        <>
          {cost?.optional ? (
            <Pressable
              accessibilityRole="switch"
              accessibilityLabel={cost.label}
              accessibilityHint={blocked ?? undefined}
              aria-checked={paying}
              aria-disabled={blocked !== null}
              disabled={blocked !== null}
              onPress={() => setPay(p => !p)}
              testID={`state-cost-${r.id}`}
              style={[
                styles.toggle,
                {
                  borderColor: paying ? colors.action : colors.borderControl,
                  backgroundColor: paying
                    ? colors.surfaceRaised
                    : 'transparent',
                },
              ]}
            >
              <Text
                color={blocked ? 'inkMuted' : paying ? 'action' : 'ink'}
                style={styles.grow}
              >
                {cost.label}
              </Text>
              <Text variant="caption" color={paying ? 'action' : 'inkMuted'}>
                {paying ? 'Ligado' : 'Desligado'}
              </Text>
            </Pressable>
          ) : cost ? (
            <Text variant="caption" color="inkMuted">
              {cost.label}
            </Text>
          ) : null}
          {blocked ? (
            <Text variant="caption" color="inkMuted">
              {blocked}
            </Text>
          ) : null}
          <Choice
            label={def.label}
            options={options}
            value={r.option.id}
            onChange={choose}
            columns={1}
            testID={`state-${r.id}`}
          />
        </>
      ) : (
        <View
          accessible
          accessibilityLabel={describe(r, sheet)}
          accessibilityValue={{ text: short(r, sheet) }}
          style={styles.current}
        >
          <Text variant="number">{r.option.label}</Text>
          {preview.find(o => o.id === r.option.id)?.summary ? (
            <Text color="inkMuted">
              {preview.find(o => o.id === r.option.id)?.summary}
            </Text>
          ) : null}
        </View>
      )}
      {r.option.note ? <Text>{r.option.note}</Text> : null}
      {reason ? (
        <Text variant="caption" color="inkMuted">
          {reason}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space[3],
    minHeight: tokens.size.rowMin,
    paddingVertical: tokens.space[2],
    paddingHorizontal: tokens.layout.gutter,
    borderBottomWidth: tokens.borderWidth.hair,
  },
  grow: { flex: 1 },
  value: { alignItems: 'flex-end' },
  box: { gap: tokens.space[3], paddingVertical: tokens.space[2] },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space[3],
    minHeight: tokens.size.hitSize,
    paddingHorizontal: tokens.space[3],
    borderRadius: tokens.radius.md,
    borderWidth: tokens.borderWidth.control,
  },
  current: { gap: tokens.space[1] },
})
