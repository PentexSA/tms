import { describe, type ResolvedTrack, short } from '@tms/sheet-core'
import { BoxTrack, Pressable, Text, tokens, useTheme } from '@tms/ui'
import { StyleSheet, View } from 'react-native'
import { useOpenField } from '../../play/sheetContext'
import type { FieldViewProps } from '../types'
import { stackingBoxes } from './boxes'

// Linha de uma trilha (Vitalidade, Estresse): rótulo, o nível e a penalidade
// ("Machucado −1") e as caixas. O toque abre o sheet de dano; o nome
// acessível é o resumo do core, com o tipo por extenso (o glifo nunca é a
// única pista).
export function TrackRow({ resolved, sheet }: FieldViewProps) {
  const { colors } = useTheme()
  const open = useOpenField(resolved.id)
  const r = resolved as ResolvedTrack
  const content = (
    <>
      <View style={styles.head}>
        <Text variant="fieldLabel" style={styles.label}>
          {r.field.def.label}
        </Text>
        <Text variant="number">{short(r, sheet)}</Text>
      </View>
      {r.rule === 'wod-stacking' ? (
        <BoxTrack boxes={stackingBoxes(r)} />
      ) : (
        r.rows.map(row => (
          <BoxTrack
            key={row.id}
            boxes={row.marks.map(m => ({ tone: m ? 'severe' : 'empty' }))}
          />
        ))
      )}
    </>
  )
  const style = [styles.row, { borderBottomColor: colors.borderSubtle }]
  if (!open)
    return (
      <View
        accessible
        accessibilityLabel={describe(r, sheet)}
        accessibilityValue={{ text: short(r, sheet) }}
        style={style}
      >
        {content}
      </View>
    )
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={describe(r, sheet)}
      accessibilityValue={{ text: short(r, sheet) }}
      accessibilityHint="Abre a trilha"
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
