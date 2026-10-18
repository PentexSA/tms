import type { ReactNode } from 'react'
import { StyleSheet, View, type ViewStyle } from 'react-native'
import { useInsets } from './insets'
import { useTheme } from './theme'
import { tokens } from './tokens'

export interface ScreenProps {
  readonly children: ReactNode
  readonly style?: ViewStyle
  // Respeita a safe area de cima e de baixo (react-native-safe-area-context).
  readonly safe?: boolean
  readonly testID?: string
}

export function Screen({ children, style, safe = true, testID }: ScreenProps) {
  const { colors } = useTheme()
  const insets = useInsets()
  return (
    <View
      testID={testID}
      style={[
        styles.screen,
        { backgroundColor: colors.bg },
        safe && { paddingTop: insets.top, paddingBottom: insets.bottom },
        style,
      ]}
    >
      <View style={styles.content}>{children}</View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: tokens.layout.contentMaxExpanded,
    alignSelf: 'center',
  },
})
