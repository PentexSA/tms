import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { Pressable } from './Pressable'
import { Text } from './Text'
import { type Colors, useTheme } from './theme'
import { tokens } from './tokens'

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'

export interface ButtonProps {
  readonly title: string
  readonly onPress: () => void
  readonly variant?: ButtonVariant
  readonly disabled?: boolean
  // Ação em andamento: anunciada como ocupada e sem novo toque.
  readonly busy?: boolean
  readonly accessibilityHint?: string
  readonly testID?: string
}

const palette = (c: Colors, variant: ButtonVariant) =>
  ({
    primary: { bg: c.action, ink: c.onAction, border: c.action },
    secondary: { bg: 'transparent', ink: c.ink, border: c.borderControl },
    danger: { bg: c.danger, ink: c.onDanger, border: c.danger },
    ghost: { bg: 'transparent', ink: c.action, border: 'transparent' },
  })[variant]

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  busy = false,
  accessibilityHint,
  testID,
}: ButtonProps) {
  const theme = useTheme()
  const p = palette(theme.colors, variant)
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={[styles.button, { backgroundColor: p.bg, borderColor: p.border }]}
    >
      <View style={styles.row}>
        {busy ? <ActivityIndicator color={p.ink} /> : null}
        <Text variant="fieldLabel" style={{ color: p.ink }}>
          {title}
        </Text>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    borderRadius: tokens.radius.md,
    borderWidth: tokens.borderWidth.control,
    paddingHorizontal: tokens.space[5],
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: tokens.space[2] },
})
