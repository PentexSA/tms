import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { Text } from './Text'
import { useTheme } from './theme'
import { tokens } from './tokens'

export type BannerTone = 'info' | 'success' | 'warning' | 'danger'

export interface BannerProps {
  readonly tone?: BannerTone
  readonly title?: string
  readonly message: string
  readonly action?: ReactNode
  readonly testID?: string
}

/** Faixa de estado (offline, conflito, erro). Perigo e aviso são `alert`. */
export function Banner({
  tone = 'info',
  title,
  message,
  action,
  testID,
}: BannerProps) {
  const { colors } = useTheme()
  const edge =
    tone === 'danger'
      ? colors.danger
      : tone === 'success'
        ? colors.success
        : tone === 'warning'
          ? colors.action
          : colors.borderControl
  return (
    <View
      testID={testID}
      accessibilityRole={
        tone === 'danger' || tone === 'warning' ? 'alert' : 'summary'
      }
      style={[
        styles.banner,
        { borderLeftColor: edge, backgroundColor: colors.surface },
      ]}
    >
      <View style={styles.text}>
        {title ? <Text variant="fieldLabel">{title}</Text> : null}
        <Text variant="caption" color="inkMuted">
          {message}
        </Text>
      </View>
      {action}
    </View>
  )
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space[3],
    borderLeftWidth: 4,
    padding: tokens.space[3],
    borderRadius: tokens.radius.sm,
  },
  text: { flex: 1, gap: tokens.space['0.5'] },
})
