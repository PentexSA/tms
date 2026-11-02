import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { Text } from './Text'
import { useTheme } from './theme'
import { tokens } from './tokens'

export type BannerTone = 'info' | 'success' | 'warning' | 'danger'

/**
 * Largura mínima do texto ao lado das ações. Sem ela, o texto encolhia até
 * ~25 px quando os botões ocupavam a linha (T-12); com menos espaço que isso,
 * as ações descem para a linha de baixo.
 */
const MIN_TEXT_WIDTH = 200

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
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  // Com largura, texto e ações numa linha; sem ela, as ações quebram para
  // baixo, alinhadas ao início, e o texto fica com a linha inteira
  banner: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    rowGap: tokens.space[2],
    columnGap: tokens.space[3],
    borderLeftWidth: 4,
    padding: tokens.space[3],
    borderRadius: tokens.radius.sm,
  },
  text: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: MIN_TEXT_WIDTH,
    minWidth: 0,
    gap: tokens.space['0.5'],
  },
  action: { flexShrink: 0, maxWidth: '100%' },
})
