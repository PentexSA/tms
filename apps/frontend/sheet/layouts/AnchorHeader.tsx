import { Text, tokens } from '@tms/ui'
import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import type { AnchorTarget } from './anchor'

// O título de uma âncora do "ir ao grupo" (P05-D): o mesmo desenho do
// `SectionHeader` do @tms/ui (título e um `right`), com o alvo do foco no
// próprio texto do título. No app, o leitor de tela só vai a um elemento de
// acessibilidade, e o contêiner do `SectionHeader` não é um; o @tms/ui não
// expõe a ref do título, e este pacote não o muda.

export function AnchorHeader({
  title,
  level = 'section',
  right,
  target,
}: {
  readonly title: string
  readonly level?: 'section' | 'group'
  readonly right?: ReactNode
  readonly target: AnchorTarget
}) {
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <Text
          variant={level === 'section' ? 'displayLg' : 'title'}
          accessibilityRole="header"
          aria-level={level === 'section' ? 2 : 3}
          {...(target as object)}
        >
          {title}
        </Text>
      </View>
      {right}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space[3],
    paddingVertical: tokens.space[2],
  },
  text: { flex: 1 },
})
