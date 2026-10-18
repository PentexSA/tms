import { type ResolvedResource, short } from '@tms/sheet-core'
import { Text } from '@tms/ui'
import { View } from 'react-native'
import { chipStyles } from '../GenericChip'
import type { FieldViewProps } from '../types'
import { ResourceVisual } from './ResourceVisual'

// Chip do dock: "Sangue", "9/15" e um medidor fino. Só visual (o DockChip
// tem o nome acessível e o toque longo).
export function ResourceChip({ resolved, sheet }: FieldViewProps) {
  const r = resolved as ResolvedResource
  const def = r.field.def
  return (
    <View style={chipStyles.chip}>
      <Text variant="caption" color="inkMuted" numberOfLines={1}>
        {def.shortLabel ?? def.label}
      </Text>
      <Text variant="number" numberOfLines={1}>
        {short(r, sheet)}
      </Text>
      <ResourceVisual r={r} compact />
    </View>
  )
}
