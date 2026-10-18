import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { Text } from './Text'
import { tokens } from './tokens'

export interface EmptyStateProps {
  readonly title: string
  readonly message?: string
  readonly actions?: ReactNode
  readonly testID?: string
}

export function EmptyState({
  title,
  message,
  actions,
  testID,
}: EmptyStateProps) {
  return (
    <View testID={testID} style={styles.root}>
      <Text
        variant="title"
        accessibilityRole="header"
        aria-level={2}
        style={styles.center}
      >
        {title}
      </Text>
      {message ? (
        <Text color="inkMuted" style={styles.center}>
          {message}
        </Text>
      ) : null}
      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    gap: tokens.space[3],
    paddingVertical: tokens.space[10],
    paddingHorizontal: tokens.layout.gutter,
  },
  center: { textAlign: 'center' },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: tokens.space[3],
  },
})
