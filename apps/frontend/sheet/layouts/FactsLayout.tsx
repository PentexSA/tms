import { tokens } from '@tms/ui'
import { StyleSheet, View } from 'react-native'
import { FieldSlot } from '../FieldSlot'
import type { LayoutProps } from './types'

/** Termos e valores (identidade, foco do Mago). */
export function FactsLayout({ section }: LayoutProps) {
  return (
    <View style={styles.facts}>
      {section.fieldIds.map(id => (
        <FieldSlot key={id} id={id} variant="fact" />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  facts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: tokens.space[6],
    rowGap: tokens.space[2],
    paddingHorizontal: tokens.layout.gutter,
  },
})
