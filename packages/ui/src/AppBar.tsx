import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { Pressable } from './Pressable'
import { Text } from './Text'
import { useLayout, useTheme } from './theme'
import { tokens } from './tokens'

export interface BackLinkProps {
  // Para onde volta ("Crônica da Liberdade"): vai no rótulo (DS C-20).
  readonly label: string
  readonly onPress: () => void
}

export function BackLink({ label, onPress }: BackLinkProps) {
  // T-11: no celular o voltar cede espaço ao título; o nome acessível
  // continua com o destino inteiro
  const compact = useLayout().breakpoint === 'compact'
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Voltar para ${label}`}
      onPress={onPress}
      style={[styles.back, { maxWidth: compact ? 96 : 160 }]}
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
  /**
   * Uma linha sob o título, na mesma coluna (o lugar do estado da ficha,
   * D-02). O título (24) e a legenda (18) cabem nos 48 da barra.
   */
  readonly subtitle?: ReactNode
}

// A safe area de cima é do `Screen` (T-37): a barra fica sempre dentro de
// um, que já soma o inset. Somar aqui de novo deixava uma faixa vazia de
// 47 a 59 pt acima do cabeçalho no iPhone e no Android edge-to-edge.
export function AppBar({ title, back, actions, subtitle }: AppBarProps) {
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
      {/* O título encolhe até caber (T-11): as ações não passam da tela */}
      <View style={styles.titleColumn}>
        <Text
          variant="displaySm"
          accessibilityRole="header"
          aria-level={1}
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle ? (
          <View style={styles.subtitle} testID="app-bar-subtitle">
            {subtitle}
          </View>
        ) : null}
      </View>
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
  },
  backLabel: { flexShrink: 1 },
  titleColumn: { flex: 1, minWidth: 0 },
  subtitle: { flexDirection: 'row', overflow: 'hidden' },
})
