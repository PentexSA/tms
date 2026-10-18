import {
  describe,
  describeBatch,
  fmtPenalty,
  planDamage,
  plural,
  type ResolvedBoxes,
  type ResolvedStacking,
  type ResolvedTrack,
  short,
  stored,
} from '@tms/sheet-core'
import {
  Banner,
  BoxTrack,
  Pressable,
  Stepper,
  Text,
  tokens,
  useTheme,
  useToast,
} from '@tms/ui'
import { StyleSheet, View } from 'react-native'
import { useSheet, useSheetStore } from '../../context'
import { eventTo, useEditable } from '../../play/editable'
import { haptics } from '../../play/haptics'
import { useCommit } from '../../useCommit'
import type { FieldViewProps } from '../types'
import { stackingBoxes } from './boxes'

// O sheet de uma trilha (design system: Track). Com `wod-stacking`, a
// penalidade grande e uma linha por tipo de dano com stepper: + aplica e −
// cura aquele tipo, pelo damage/heal do core, e o aviso diz o que a regra fez
// ("contusivo a mais virou letal"). Com `boxes` (Fate, D&D), cada caixa
// alterna.
export function TrackSheet(props: FieldViewProps) {
  const r = props.resolved as ResolvedTrack
  return r.rule === 'wod-stacking' ? (
    <StackingSheet {...props} r={r} />
  ) : (
    <BoxesSheet {...props} r={r} />
  )
}

function StackingSheet({
  r,
  sheet,
}: FieldViewProps & { readonly r: ResolvedStacking }) {
  const { model } = useSheet()
  const store = useSheetStore()
  const commit = useCommit()
  const toast = useToast()
  const { editable, reason } = useEditable(r.id)
  const def = r.field.def
  const name = def.shortLabel ?? def.label
  const types = def.types ?? []

  const apply = (type: string, delta: number) => {
    const plan = planDamage(model, store.getState().values, r.id, type, delta)
    // Trilha cheia de dano igual ou mais grave: nada muda e o aviso explica
    if (!plan.ok) return toast.show({ message: `${name} · ${plan.reason}` })
    const result = commit(plan.events, `${name} · ${plan.label}`)
    if (!result.ok) return
    // O tipo mais grave (agravado) pede um aviso mais forte
    if (delta > 0 && type === types[0]?.id) haptics.severe()
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
        <Text variant="numberLg">
          {r.incapacitated
            ? '—'
            : r.penalty === 0
              ? '0'
              : fmtPenalty(r.penalty)}
        </Text>
        <Text color="inkMuted">{r.level?.label ?? 'Sem ferimentos'}</Text>
      </View>
      <BoxTrack boxes={stackingBoxes(r)} />
      {r.incapacitated ? (
        <Banner
          tone="danger"
          title="Incapacitado"
          message="Não pode agir. A parada de dados fica bloqueada até curar."
        />
      ) : null}
      {types.map(t => {
        const count = r.counts[t.id] ?? 0
        return (
          <View key={t.id} style={styles.type}>
            <View style={styles.glyph} aria-hidden accessible={false}>
              <BoxTrack boxes={[{ glyph: t.glyph, tone: 'filled' }]} />
            </View>
            <Text variant="fieldLabel" style={styles.grow}>
              {t.label}
            </Text>
            {editable ? (
              <Stepper
                label={`Dano ${t.label.toLowerCase()}`}
                value={count}
                min={0}
                // Com a trilha cheia o + continua valendo: a regra troca uma
                // caixa menos grave (ou explica por que nada muda)
                max={r.levels + 1}
                valueText={n =>
                  `${plural(n, 'nível', 'níveis')} de dano ${t.label.toLowerCase()}`
                }
                onChange={n => apply(t.id, n - count)}
                testID={`damage-${t.id}`}
              />
            ) : (
              <Text variant="number">{String(count)}</Text>
            )}
          </View>
        )
      })}
      {reason ? (
        <Text variant="caption" color="inkMuted">
          {reason}
        </Text>
      ) : null}
    </View>
  )
}

function BoxesSheet({
  r,
  sheet,
}: FieldViewProps & { readonly r: ResolvedBoxes }) {
  const { model } = useSheet()
  const store = useSheetStore()
  const commit = useCommit()
  const { colors, accent } = useTheme()
  const { editable, reason } = useEditable(r.id)
  const toggle = (rowId: string, index: number) => {
    const current = stored(r, sheet) as Record<string, boolean[]>
    const marks = [...(current[rowId] ?? [])]
    marks[index] = !marks[index]
    const events = [
      eventTo(store.getState().values, r.id, { ...current, [rowId]: marks }),
    ]
    if (commit(events, describeBatch(model, events)).ok) haptics.selection()
  }
  return (
    <View style={styles.box}>
      <View
        accessible
        accessibilityLabel={describe(r, sheet)}
        accessibilityValue={{ text: short(r, sheet) }}
      >
        <Text variant="numberLg">{`${r.marked}/${r.total}`}</Text>
      </View>
      {r.rows.map(row => (
        <View key={row.id} style={styles.boxRow}>
          <Text variant="fieldLabel">{row.label}</Text>
          <View style={styles.marks}>
            {row.marks.map((marked, i) => {
              const worth = row.boxValues?.[i]
              const label = `${row.label}, caixa ${i + 1}${
                worth !== undefined ? ` (vale ${worth})` : ''
              }`
              return (
                <Pressable
                  // A posição da caixa é a identidade dela
                  key={`${row.id}-${i + 1}`}
                  accessibilityRole="checkbox"
                  accessibilityLabel={label}
                  aria-checked={marked}
                  disabled={!editable}
                  onPress={() => toggle(row.id, i)}
                  style={[
                    styles.hitBox,
                    {
                      borderColor: marked ? accent.fill : colors.borderControl,
                      backgroundColor: marked ? accent.fill : 'transparent',
                    },
                  ]}
                >
                  <Text style={{ color: marked ? accent.on : colors.ink }}>
                    {worth !== undefined ? String(worth) : ''}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </View>
      ))}
      {reason ? (
        <Text variant="caption" color="inkMuted">
          {reason}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  box: { gap: tokens.space[3], paddingVertical: tokens.space[2] },
  head: { flexDirection: 'row', alignItems: 'baseline', gap: tokens.space[3] },
  type: { flexDirection: 'row', alignItems: 'center', gap: tokens.space[3] },
  glyph: { width: tokens.size.boxSize },
  grow: { flex: 1 },
  boxRow: { gap: tokens.space[2] },
  marks: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space[2] },
  hitBox: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: tokens.borderWidth.control,
    borderRadius: tokens.radius.sm,
  },
})
