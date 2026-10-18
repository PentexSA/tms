import type { ReactNode } from 'react'
import {
  Platform,
  SafeAreaView,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native'

export interface ScreenProps {
  children: ReactNode
  style?: ViewStyle
  safe?: boolean
  testID?: string
}

export function Screen({ children, style, safe = true, testID }: ScreenProps) {
  const Container = safe ? SafeAreaView : View

  return (
    <Container
      testID={testID}
      style={[styles.container, Platform.OS === 'web' && styles.web, style]}
    >
      {children}
    </Container>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  web: {
    maxWidth: 1200,
    marginHorizontal: 'auto',
    width: '100%',
  },
})
