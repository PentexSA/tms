import { StyleSheet, View } from 'react-native'
import { useTheme } from './theme'
import { tokens } from './tokens'

export interface SkeletonProps {
  readonly lines?: number
  readonly label?: string
  readonly testID?: string
}

/** Carregando: um só elemento para o leitor de tela, ocupado. */
export function Skeleton({
  lines = 3,
  label = 'Carregando',
  testID,
}: SkeletonProps) {
  const { colors } = useTheme()
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}
      style={styles.root}
    >
      {Array.from({ length: lines }, (_, i) => (
        <View
          // biome-ignore lint/suspicious/noArrayIndexKey: linhas fixas
          key={i}
          style={[
            styles.line,
            { backgroundColor: colors.surfaceRaised },
            i === lines - 1 && styles.last,
          ]}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { gap: tokens.space[3], padding: tokens.layout.gutter },
  line: { height: tokens.size.rowMin - 16, borderRadius: tokens.radius.sm },
  last: { width: '60%' },
})
