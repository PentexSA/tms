import { describe, type FieldId, short } from '@tms/sheet-core'
import { Text, tokens, useTheme } from '@tms/ui'
import { memo } from 'react'
import { StyleSheet, View } from 'react-native'
import { useFieldEntry } from '../context'
import { FieldTarget } from '../views/FieldTarget'

// Lista compacta (protótipo: rowsCard/valueChip). Com o filtro "só com
// pontos" ligado, fora do Editar, os traços viram chips "Nome N" em fluxo:
// todos à vista, com bem menos rolagem que as linhas com pips. O toque abre o
// mesmo detalhe da linha, e o nome acessível é o describe() do core, com a
// especialização e os modificadores.

export function ChipFlow({ ids }: { readonly ids: readonly FieldId[] }) {
  return (
    <View style={styles.flow}>
      {ids.map(id => (
        <ValueChip key={id} id={id} />
      ))}
    </View>
  )
}

const ValueChip = memo(function ValueChip({ id }: { readonly id: FieldId }) {
  const { colors } = useTheme()
  const entry = useFieldEntry(id)
  if (!entry) return null
  const { resolved, sheet } = entry
  const value = short(resolved, sheet)
  return (
    <FieldTarget
      id={id}
      label={describe(resolved, sheet)}
      value={value}
      style={[styles.chip, { borderColor: colors.borderSubtle }]}
    >
      <Text numberOfLines={1}>{resolved.field.def.label}</Text>
      <Text variant="number">{value}</Text>
    </FieldTarget>
  )
})

const styles = StyleSheet.create({
  flow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.space[2],
    paddingHorizontal: tokens.layout.gutter,
    paddingVertical: tokens.space[1],
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space[2],
    minHeight: tokens.size.hitSize,
    paddingHorizontal: tokens.space[3],
    borderRadius: tokens.radius.pill,
    borderWidth: tokens.borderWidth.hair,
  },
})
