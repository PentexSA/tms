import { describe, type ResolvedRating, short } from '@tms/sheet-core'
import { type PipSegment, RatingDots, Text, tokens, useTheme } from '@tms/ui'
import { StyleSheet, View } from 'react-native'
import { FieldTarget } from './FieldTarget'
import type { FieldViewProps } from './types'

// rating (DS: FieldRow e Cell). Os pips são só visual: o número está ao lado
// e a frase acessível vem do describe() do core, que começa pelo rótulo.

/** Pips: pontos próprios, bônus de estado, inativos (acima do teto) e vazios. */
export function pipSegments(r: ResolvedRating): PipSegment[] {
  const own = Math.max(0, Math.min(r.base, r.value))
  const bonus = Math.max(0, r.value - r.base)
  const lost = Math.max(0, r.inactive)
  const off = Math.max(0, r.max - own - bonus - lost)
  return [
    { kind: 'on', n: own },
    { kind: 'bonus', n: bonus },
    { kind: 'lost', n: lost },
    { kind: 'off', n: off },
  ]
}

export function RatingRow({ resolved, sheet }: FieldViewProps) {
  const { colors } = useTheme()
  if (resolved.type !== 'rating') return null
  const specialty = sheet.specialty(resolved.id)
  return (
    <FieldTarget
      id={resolved.id}
      label={describe(resolved, sheet)}
      value={short(resolved, sheet)}
      style={[styles.row, { borderBottomColor: colors.borderSubtle }]}
    >
      <View style={styles.text}>
        <Text
          variant="fieldLabel"
          color={resolved.inactive ? 'inkMuted' : 'ink'}
        >
          {resolved.field.def.label}
        </Text>
        {specialty ? (
          <Text variant="caption" color="inkMuted" style={styles.specialty}>
            {specialty}
          </Text>
        ) : null}
      </View>
      <RatingDots segments={pipSegments(resolved)} size="sm" />
      <Text variant="number" style={styles.num}>
        {short(resolved, sheet)}
      </Text>
    </FieldTarget>
  )
}

/** Célula da grade: rótulo na 1ª linha, pips e número embaixo. */
export function RatingCell({
  resolved,
  sheet,
  pip = 'sm',
}: FieldViewProps & { readonly pip?: 'sm' | 'md' }) {
  const { colors } = useTheme()
  if (resolved.type !== 'rating') return null
  const specialty = sheet.specialty(resolved.id)
  return (
    <FieldTarget
      id={resolved.id}
      label={describe(resolved, sheet)}
      value={short(resolved, sheet)}
      style={[styles.cell, { borderColor: colors.borderSubtle }]}
    >
      <Text variant="fieldLabel" numberOfLines={1}>
        {resolved.field.def.label}
      </Text>
      <View style={styles.cellValue}>
        <RatingDots segments={pipSegments(resolved)} size={pip} />
        <Text variant="number">{short(resolved, sheet)}</Text>
      </View>
      {specialty ? (
        <Text
          variant="caption"
          color="inkMuted"
          numberOfLines={1}
          style={styles.specialty}
        >
          {specialty}
        </Text>
      ) : null}
    </FieldTarget>
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
  text: { flex: 1, gap: tokens.space['0.5'] },
  specialty: { fontStyle: 'italic' },
  num: { minWidth: 20, textAlign: 'right' },
  cell: {
    flex: 1,
    minHeight: 64,
    gap: tokens.space[1],
    padding: tokens.space[2],
    borderWidth: tokens.borderWidth.hair,
  },
  cellValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space[2],
  },
})
