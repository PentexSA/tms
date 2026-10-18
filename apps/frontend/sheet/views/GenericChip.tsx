import { short } from '@tms/sheet-core'
import { Text, tokens } from '@tms/ui'
import { StyleSheet, View } from 'react-native'
import type { FieldViewProps } from './types'

// O chip do dock para qualquer tipo sem chip próprio (CA do D&D, Forma do
// Lobisomem, a roda do Mago): rótulo curto e o texto curto do core. Só
// visual: o nome acessível é do DockChip, que sabe o que o toque longo faz.
export function GenericChip({ resolved, sheet }: FieldViewProps) {
  const def = resolved.field.def
  return (
    <View style={chipStyles.chip}>
      <Text variant="caption" color="inkMuted" numberOfLines={1}>
        {def.shortLabel ?? def.label}
      </Text>
      <Text variant="number" numberOfLines={1}>
        {short(resolved, sheet) || '—'}
      </Text>
    </View>
  )
}

/** O miolo de todo chip do dock: rótulo em cima, valor embaixo. */
export const chipStyles = StyleSheet.create({
  chip: { alignItems: 'center', gap: tokens.space['0.5'] },
})
