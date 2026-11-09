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
      {right != null ? <View style={styles.right}>{right}</View> : null}
    </View>
  )
}

// P17 (N-06): o título nunca é espremido pelo `right` (o contador da conta,
// que cresce com ela). A base do título é o tamanho dele: a linha só leva
// título e contador juntos se os dois couberem inteiros; senão o contador
// desce para a linha de baixo, à direita. O título só encolhe quando ele,
// sozinho, passa da coluna, e aí quebra entre palavras. Sem largura mínima
// fixa: ela quebraria com fonte ampliada e com título longo.
const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: tokens.space[3],
    paddingVertical: tokens.space[2],
  },
  text: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto' },
  right: { marginLeft: 'auto', maxWidth: '100%' },
})
