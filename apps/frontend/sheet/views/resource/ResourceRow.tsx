import { describe, type ResolvedResource, short } from '@tms/sheet-core'
import { Pressable, Text, tokens, useTheme } from '@tms/ui'
import { StyleSheet, View } from 'react-native'
import { useOpenField } from '../../play/sheetContext'
import type { FieldViewProps } from '../types'
import { ResourceVisual } from './ResourceVisual'

// Linha de um recurso (Sangue, FdV, PV, SAN): rótulo, "9/15" e as caixas. O
// toque abre o sheet com o stepper e as ações; o nome acessível é a frase do
// core ("Pontos de Sangue, 9 de 15").
export function ResourceRow({ resolved, sheet }: FieldViewProps) {
  const { colors } = useTheme()
  const open = useOpenField(resolved.id)
  const r = resolved as ResolvedResource
  const def = r.field.def
  const content = (
    <>
      <View style={styles.head}>
        <Text variant="fieldLabel" style={styles.label}>
          {def.label}
        </Text>
        <Text variant="number">{short(r, sheet)}</Text>
      </View>
      <ResourceVisual r={r} />
    </>
  )
  const style = [styles.row, { borderBottomColor: colors.borderSubtle }]
  if (!open)
    return (
      <View accessible accessibilityLabel={describe(r, sheet)} style={style}>
        {content}
      </View>
    )
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={describe(r, sheet)}
      accessibilityHint="Abre o recurso"
      onPress={open}
      style={style}
    >
      {content}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: {
    gap: tokens.space[2],
    minHeight: tokens.size.rowMin,
    paddingVertical: tokens.space[2],
    paddingHorizontal: tokens.layout.gutter,
    borderBottomWidth: tokens.borderWidth.hair,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: tokens.space[3] },
  label: { flex: 1 },
})
