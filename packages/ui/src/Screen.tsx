import React, { ReactNode } from 'react'
import {
  View,
  StyleSheet,
  ViewStyle,
  SafeAreaView,
  Platform,
} from 'react-native'

export interface ScreenProps {
  children: ReactNode
  style?: ViewStyle
  safe?: boolean
}

export function Screen({ children, style, safe = true }: ScreenProps) {
  const Container = safe ? SafeAreaView : View

  return (
    <Container
      style={[
        styles.container,
        Platform.OS === 'web' && styles.web,
        style,
      ]}
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
