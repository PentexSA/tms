import {
  clockRules,
  describe,
  planClock,
  plural,
  type ResolvedClock,
  short,
} from '@tms/sheet-core'
import {
  Clock,
  type ClockFill,
  Pressable,
  Stepper,
  Text,
  tokens,
  useTheme,
  useToast,
} from '@tms/ui'
import { StyleSheet, View } from 'react-native'
import { useSheet, useSheetStore } from '../../context'
import { planLabel, useEditable } from '../../play/editable'
import { haptics } from '../../play/haptics'
import { useOpenField } from '../../play/sheetContext'
import { useCommit } from '../../useCommit'
import { chipStyles } from '../GenericChip'
import type { FieldViewProps } from '../types'

// Roda de casas (design system: Clock). A linha e o chip mostram a roda e a
// legenda; o sheet tem um Stepper por preenchimento, e cada passo passa pela
// regra do template (planClock do core). Nada aqui sabe que a roda é de
// Quintessência e Paradoxo: os nomes e as cores vêm do template.

const fillsOf = (r: ResolvedClock): ClockFill[] =>
  r.fills.map(f => ({ id: f.id, n: f.n, from: f.from, tone: f.colorRole }))

// "Quintessência 6 · Paradoxo 2 · 12 livres"
const legend = (r: ResolvedClock, sheet: FieldViewProps['sheet']) =>
  `${short(r, sheet)} · ${plural(r.free, 'livre', 'livres')}`

export function ClockRow({ resolved, sheet }: FieldViewProps) {
  const { colors } = useTheme()
  const open = useOpenField(resolved.id)
  const r = resolved as ResolvedClock
  const content = (
    <>
      <Clock
        segments={r.field.def.segments}
        fills={fillsOf(r)}
        size={tokens.size.hitSize}
      />
      <View style={styles.grow}>
        <Text variant="fieldLabel">{r.field.def.label}</Text>
        <Text variant="caption" color="inkMuted">
          {legend(r, sheet)}
        </Text>
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
      accessibilityHint="Abre a roda"
      onPress={open}
      style={style}
    >
      {content}
    </Pressable>
  )
}

// Chip do dock e da mesa: mini roda e o primeiro número de cada preenchimento
// ("6 · 2"). Só visual: o nome acessível é do DockChip.
export function ClockChip({ resolved }: FieldViewProps) {
  const r = resolved as ResolvedClock
  const def = r.field.def
  return (
    <View style={chipStyles.chip}>
      <Text variant="caption" color="inkMuted" numberOfLines={1}>
        {def.shortLabel ?? def.label}
      </Text>
      <View style={styles.chipBody}>
        <Clock segments={def.segments} fills={fillsOf(r)} size={20} />
        <Text variant="numberSm" numberOfLines={1}>
          {r.fills.map(f => String(f.n)).join(' · ')}
        </Text>
      </View>
    </View>
  )
}

export function ClockSheet({ resolved, sheet }: FieldViewProps) {
  const { model } = useSheet()
  const store = useSheetStore()
  const commit = useCommit()
  const toast = useToast()
  const { editable, reason } = useEditable(resolved.id)
  const r = resolved as ResolvedClock
  const def = r.field.def
  const ruled = clockRules.isImplementedClockRule(def.rule)
  const current = Object.fromEntries(r.fills.map(f => [f.id, f.n]))

  const apply = (fill: string, delta: number) => {
    const plan = planClock(model, store.getState().values, r.id, fill, delta)
    if (!plan.ok) return toast.show({ message: plan.reason })
    // A regra mexeu nos dois preenchimentos: a nota dela explica o que houve
    const [only] = plan.preview
    const both = only?.label === def.label
    const result = commit(plan.events, both ? plan.label : planLabel(plan))
    if (!result.ok) return
    if (both) haptics.severe()
    else haptics.selection()
  }

  return (
    <View style={styles.box}>
      <View
        accessible
        accessibilityLabel={describe(r, sheet)}
        accessibilityValue={{ text: short(r, sheet) }}
        style={styles.head}
      >
        <Clock segments={def.segments} fills={fillsOf(r)} />
        <Text color="inkMuted" style={styles.legend}>
          {legend(r, sheet)}
        </Text>
      </View>
      {r.fills.map(f => {
        // O + some quando a regra não deixa entrar mais nada neste
        // preenchimento; o porquê fica escrito embaixo
        const blocked = clockRules.gain(def, current, f.id)
        const max = blocked.changed ? def.segments : f.n
        return (
          <View key={f.id} style={styles.fill}>
            <View style={styles.fillRow}>
              <Text variant="fieldLabel" style={styles.grow}>
                {f.label}
              </Text>
              {editable && ruled ? (
                <Stepper
                  label={f.label}
                  value={f.n}
                  min={0}
                  max={max}
                  valueText={n => `${n} de ${def.segments} casas`}
                  onChange={n => apply(f.id, n - f.n)}
                  testID={`clock-${f.id}`}
                />
              ) : (
                <Text variant="number">{String(f.n)}</Text>
              )}
            </View>
            {editable && ruled && !blocked.changed ? (
              <Text variant="caption" color="inkMuted">
                {blocked.note}
              </Text>
            ) : null}
          </View>
        )
      })}
      {reason ? (
        <Text variant="caption" color="inkMuted">
          {reason}
        </Text>
      ) : editable && !ruled ? (
        <Text variant="caption" color="inkMuted">
          Esta versão do app não conhece a regra desta roda.
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
  chipBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space[1],
  },
  box: { gap: tokens.space[3], paddingVertical: tokens.space[2] },
  head: { alignItems: 'center', gap: tokens.space[2] },
  legend: { textAlign: 'center' },
  fill: { gap: tokens.space[1] },
  fillRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.space[3] },
})
