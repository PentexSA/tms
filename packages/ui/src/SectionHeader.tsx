import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { Text } from './Text'
import { tokens } from './tokens'

export interface SectionHeaderProps {
  readonly title: string
  readonly subtitle?: string
  readonly right?: ReactNode
  // Título de seção (display da skin) ou de grupo (title).
  readonly level?: 'section' | 'group'
}

export function SectionHeader({
  title,
  subtitle,
  right,
  level = 'section',
}: SectionHeaderProps) {
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <Text
          variant={level === 'section' ? 'displayLg' : 'title'}
          accessibilityRole="header"
          aria-level={level === 'section' ? 2 : 3}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" color="inkMuted">
            {subtitle}
          </Text>
        ) : null}
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
