import {
  describe,
  modifierNote,
  type ResolvedRating,
  short,
} from '@tms/sheet-core'
import { type PipSegment, RatingDots, Text, tokens, useTheme } from '@tms/ui'
import { StyleSheet, View } from 'react-native'
import { FieldTarget } from './FieldTarget'
import type { FieldViewProps } from './types'

// rating (DS: FieldRow e Cell). Os pips são só visual: o número está ao lado
// e a frase acessível vem do describe() do core, que começa pelo rótulo.

/**
 * Pips: pontos próprios, bônus de estado, pontos que não valem agora (acima
 * do teto, ou tirados por um estado: Manipulação em Crinos) e vazios. Nunca
 * mais pips que a escala: Força 7 numa escala de 5 são 5 pips, e o número
 * ao lado diz o resto.
 */
export function pipSegments(r: ResolvedRating): PipSegment[] {
  const fit = (n: number, used: number) =>
    Math.max(0, Math.min(n, r.max - used))
  const own = fit(Math.min(r.base, r.value), 0)
  const bonus = fit(r.value - r.base, own)
  const lost = fit(Math.max(r.inactive, r.base - r.value), own + bonus)
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
        <ModifierNote r={resolved} />
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
      <ModifierNote r={resolved} />
    </FieldTarget>
  )
}

/** A origem do valor efetivo ("3 + 4 Crinos"); o describe já a anuncia. */
function ModifierNote({ r }: { readonly r: ResolvedRating }) {
  const note = modifierNote(r)
  if (!note) return null
  return (
    <Text variant="caption" color="action" numberOfLines={1}>
      {note}
    </Text>
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
