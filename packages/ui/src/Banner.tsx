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
  const urgent = tone === 'danger' || tone === 'warning'
  // Sem botão, a faixa é um elemento só (título e mensagem juntos), anunciado
  // ao aparecer. Com botão, os filhos continuam alcançáveis.
  return (
    <View
      testID={testID}
      accessible={!action}
      accessibilityLabel={
        action ? undefined : [title, message].filter(Boolean).join('. ')
      }
      accessibilityRole={urgent ? 'alert' : 'summary'}
      aria-live={urgent ? 'assertive' : 'polite'}
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
