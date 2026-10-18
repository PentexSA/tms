import { describe, plain, short } from '@tms/sheet-core'
import { Text, tokens, useTheme } from '@tms/ui'
import { StyleSheet, View } from 'react-native'
import type { FieldViewProps } from './types'

// A view que serve a qualquer tipo (doc/arquitetura §6.2): rótulo e texto
// curto, com a frase do describe() como nome acessível. É o que faz qualquer
// template aparecer inteiro desde o primeiro dia.
export function GenericRow({ resolved, sheet }: FieldViewProps) {
  const { colors } = useTheme()
  const value = short(resolved, sheet)
  const long = resolved.type === 'longText' || value.length > 40
  return (
    <View
      accessible
      accessibilityLabel={describe(resolved, sheet)}
      style={[
        styles.row,
        long && styles.stacked,
        { borderBottomColor: colors.borderSubtle },
      ]}
    >
      <Text variant="fieldLabel" style={!long && styles.label}>
        {resolved.field.def.label}
      </Text>
      <Text
        variant={long ? 'body' : 'number'}
        color={value ? 'ink' : 'inkMuted'}
        style={!long && styles.value}
      >
        {value || '—'}
      </Text>
    </View>
  )
}

/** Termo e valor (layout facts e identidade): "Natureza · Arquiteta". */
export function GenericFact({ resolved, sheet }: FieldViewProps) {
  const value = plain(resolved, sheet)
  return (
    <View
      accessible
      accessibilityLabel={describe(resolved, sheet)}
      style={styles.fact}
    >
      <Text variant="caption" color="inkMuted">
        {resolved.field.def.label}
      </Text>
      <Text>{value || '—'}</Text>
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
  stacked: { flexDirection: 'column', alignItems: 'flex-start' },
  label: { flex: 1 },
  value: { textAlign: 'right' },
  fact: { gap: tokens.space['0.5'], paddingVertical: tokens.space[1] },
})
