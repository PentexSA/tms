import { StyleSheet, View } from 'react-native'
import { Text } from './Text'
import { type ColorName, useTheme } from './theme'
import { tokens } from './tokens'

export type StateBadgeTone = 'neutral' | 'attention' | 'done'

export interface StateBadgeProps {
  readonly label: string
  // Padrão 'neutral'. O tom só reforça: o texto é o estado
  readonly tone?: StateBadgeTone
  // Só onde a troca deve ser anunciada (a ficha aberta): região viva educada
  readonly live?: boolean
  readonly testID?: string
}

const TONE: Readonly<Record<StateBadgeTone, ColorName>> = {
  neutral: 'inkMuted',
  // O mesmo do Banner `warning`
  attention: 'action',
  done: 'success',
}

/**
 * Selo de estado, só leitura (a "tag" do design system): pílula de borda
 * fina com o texto do estado. Usa as cores do tema do app, nunca o accent da
 * ficha, para ler igual numa lista que mistura sistemas e skins. O texto
 * quebra em vez de ser cortado. Não é interativo: para filtro, use o `Chip`.
 *
 * Não é um elemento acessível à parte: o texto é lido como texto, e dentro
 * de uma linha (que é um alvo só) entra no nome dela, sem foco próprio.
 */
export function StateBadge({
  label,
  tone = 'neutral',
  live = false,
  testID,
}: StateBadgeProps) {
  const { colors } = useTheme()
  const color = TONE[tone]
  return (
    <View
      testID={testID}
      accessibilityLiveRegion={live ? 'polite' : undefined}
      aria-live={live ? 'polite' : undefined}
      style={[
        styles.badge,
        {
          borderColor:
            tone === 'neutral' ? colors.borderControl : colors[color],
        },
      ]}
    >
      <Text variant="caption" color={color}>
        {label}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    borderWidth: tokens.borderWidth.hair,
    borderRadius: tokens.radius.pill,
    paddingHorizontal: tokens.space[2],
    paddingVertical: tokens.space['0.5'],
  },
})
