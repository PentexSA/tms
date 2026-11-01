import { useEffect, useState } from 'react'
import { Platform, StyleSheet, View } from 'react-native'
import { Text } from './Text'
import { useTheme } from './theme'
import { tokens } from './tokens'

export interface SkeletonProps {
  readonly lines?: number
  readonly label?: string
  readonly testID?: string
}

/**
 * Carregando: um só elemento para o leitor de tela, ocupado.
 *
 * No web, o `accessible` não existe e um `aria-label` num `div` sem papel
 * não é exposto (a árvore ficava vazia): o contêiner vira `role="status"`
 * com o rótulo num texto visualmente oculto, e as linhas ficam
 * `aria-hidden` (design system, Skeleton). A região de status não leva
 * `aria-busy`: ocupada, ela nunca seria anunciada (o Skeleton some antes de
 * deixar de estar ocupado). O texto entra depois da montagem, para ser uma
 * mudança dentro de uma região viva que já existe, que é o que o leitor de
 * tela anuncia.
 */
export function Skeleton({
  lines = 3,
  label = 'Carregando',
  testID,
}: SkeletonProps) {
  const { colors } = useTheme()
  const web = Platform.OS === 'web'
  const [said, setSaid] = useState(false)
  useEffect(() => setSaid(true), [])
  const bars = Array.from({ length: lines }, (_, i) => (
    <View
      key={i}
      testID="skeleton-line"
      {...(web ? { 'aria-hidden': true } : {})}
      style={[
        styles.line,
        { backgroundColor: colors.surfaceRaised },
        i === lines - 1 && styles.last,
      ]}
    />
  ))
  if (web)
    return (
      <View testID={testID} role="status" style={styles.root}>
        {said ? <Text style={styles.hidden}>{label}</Text> : null}
        {bars}
      </View>
    )
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={label}
      aria-busy
      style={styles.root}
    >
      {bars}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { gap: tokens.space[3], padding: tokens.layout.gutter },
  line: { height: tokens.size.rowMin - 16, borderRadius: tokens.radius.sm },
  last: { width: '60%' },
  // Fora da vista, mas lido pelo leitor de tela (o "sr-only" do web)
  hidden: {
    position: 'absolute',
    width: 1,
    height: 1,
    overflow: 'hidden',
    opacity: 0,
  },
})
