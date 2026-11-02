import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { Pressable } from './Pressable'
import { Text } from './Text'
import { useTheme } from './theme'
import { tokens } from './tokens'

export interface BackLinkProps {
  // Para onde volta ("Crônica da Liberdade"): vai no rótulo (DS C-20).
  readonly label: string
  readonly onPress: () => void
}

export function BackLink({ label, onPress }: BackLinkProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Voltar para ${label}`}
      onPress={onPress}
      style={styles.back}
    >
      <Text variant="title" color="action">
        {'‹'}
      </Text>
      <Text
        variant="caption"
        color="action"
        numberOfLines={1}
        style={styles.backLabel}
      >
        {label}
      </Text>
    </Pressable>
  )
}

export interface AppBarProps {
  readonly title: string
  readonly back?: BackLinkProps
  readonly actions?: ReactNode
}

// A safe area de cima é do `Screen` (T-37): a barra fica sempre dentro de
// um, que já soma o inset. Somar aqui de novo deixava uma faixa vazia de
// 47 a 59 pt acima do cabeçalho no iPhone e no Android edge-to-edge.
export function AppBar({ title, back, actions }: AppBarProps) {
  const { colors } = useTheme()
  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colors.bg,
          borderBottomColor: colors.borderSubtle,
        },
      ]}
    >
      {back ? <BackLink {...back} /> : null}
      <Text
        variant="displaySm"
        accessibilityRole="header"
        aria-level={1}
        numberOfLines={1}
        style={styles.title}
      >
        {title}
      </Text>
      {actions}
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space[2],
    minHeight: tokens.size.headerHeight,
    paddingHorizontal: tokens.space[2],
    borderBottomWidth: tokens.borderWidth.hair,
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space[1],
    maxWidth: 160,
  },
  backLabel: { flexShrink: 1 },
  title: { flex: 1 },
})
