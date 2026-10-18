import { fmtPenalty, type ResolvedTrack } from '@tms/sheet-core'
import { Text, tokens, useTheme } from '@tms/ui'
import { StyleSheet, View } from 'react-native'
import { chipStyles } from '../GenericChip'
import type { FieldViewProps } from '../types'
import { stackingBoxes } from './boxes'

// Chip do dock: mini-trilha (uma barrinha por nível; o tipo mais grave em
// tinta forte) e a penalidade. Trilha de caixas: "2/6". Só visual.
export function TrackChip({ resolved }: FieldViewProps) {
  const { colors, accent } = useTheme()
  const r = resolved as ResolvedTrack
  const def = r.field.def
  const label = def.shortLabel ?? def.label
  if (r.rule !== 'wod-stacking')
    return (
      <View style={chipStyles.chip}>
        <Text variant="caption" color="inkMuted" numberOfLines={1}>
          {label}
        </Text>
        <Text variant="number">{`${r.marked}/${r.total}`}</Text>
      </View>
    )
  return (
    <View style={chipStyles.chip}>
      <Text variant="caption" color="inkMuted" numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.mini}>
        {stackingBoxes(r).map((b, i) => (
          <View
            key={i}
            style={[
              styles.level,
              {
                borderColor:
                  b.tone === 'empty' ? colors.borderControl : accent.fill,
                backgroundColor:
                  b.tone === 'severe'
                    ? colors.ink
                    : b.tone === 'filled'
                      ? accent.fill
                      : 'transparent',
              },
            ]}
          />
        ))}
      </View>
      <Text variant="numberSm">
        {r.incapacitated
          ? 'Incapacitado'
          : r.penalty === 0
            ? '0'
            : fmtPenalty(r.penalty)}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  mini: { flexDirection: 'row', gap: 2 },
  level: {
    width: 8,
    height: 12,
    borderWidth: tokens.borderWidth.hair,
    borderRadius: 2,
  },
})
