import { SectionHeader, tokens } from '@tms/ui'
import { StyleSheet, View } from 'react-native'
import { FieldSlot } from '../FieldSlot'
import type { LayoutProps } from './types'

// Linhas, com o título de cada grupo quando a seção tem grupos. É também o
// fallback de todo layout que ainda não tem componente próprio (grade,
// pirâmide): um layout novo degrada, nunca quebra.
export function ListLayout({ section }: LayoutProps) {
  if (!section.groups)
    return (
      <View>
        {section.fieldIds.map(id => (
          <FieldSlot key={id} id={id} variant="row" />
        ))}
      </View>
    )
  return (
    <View>
      {section.groups.map(g => (
        <View key={g.id}>
          <View style={styles.group}>
            <SectionHeader title={g.title} level="group" />
          </View>
          {g.fieldIds.map(id => (
            <FieldSlot key={id} id={id} variant="row" />
          ))}
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  group: { paddingHorizontal: tokens.layout.gutter },
})
