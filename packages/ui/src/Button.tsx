import {
  type ComponentRef,
  type Ref,
  useCallback,
  useEffect,
  useRef,
} from 'react'
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native'
import { Pressable } from './Pressable'
import { markSoftDisabled } from './Stepper'
import { Text } from './Text'
import { type Colors, useTheme } from './theme'
import { tokens } from './tokens'

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'

export interface ButtonProps {
  readonly title: string
  readonly onPress: () => void
  readonly variant?: ButtonVariant
  readonly disabled?: boolean
  /**
   * Bloqueado pela previsão (o servidor recusaria): a cara de indisponível
   * (opacidade e `aria-disabled`), mas **continua tocável**, e o toque chega
   * ao `onPress`, que explica o motivo e não envia. Nunca vira `disabled`: o
   * react-native-web faria do <button> um elemento morto, sem foco nem toque
   * (o mesmo contrato do "+" do Stepper, `markSoftDisabled`).
   */
  readonly blocked?: boolean
  /** No web, o id do texto do motivo (`aria-describedby`). */
  readonly hintID?: string
  // Ação em andamento: anunciada como ocupada e sem novo toque.
  readonly busy?: boolean
  readonly accessibilityHint?: string
  // Nome acessível quando o título repete o de outro botão na tela
  // ("Escolher da lista: Natureza"). Padrão: o título. Comece pelo título
  // inteiro (WCAG 2.5.3).
  readonly accessibilityLabel?: string
  readonly testID?: string
  // Com o React 19 o ref é prop: para mover o foco por programa (a
  // confirmação de "Revogar" devolve o foco ao gatilho, P12)
  readonly ref?: Ref<ComponentRef<typeof View>>
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
  blocked = false,
  hintID,
  busy = false,
  accessibilityHint,
  accessibilityLabel,
  testID,
  ref,
}: ButtonProps) {
  const theme = useTheme()
  const p = palette(theme.colors, variant)
  const web = Platform.OS === 'web'
  const off = disabled || busy
  const soft = !off && blocked
  // No web, o aria-disabled do bloqueado vai direto no elemento (P13); a
  // prop `ref` (P12) recebe a mesma vista, para o foco por programa
  const inner = useRef<ComponentRef<typeof View>>(null)
  const merged = useCallback(
    (view: ComponentRef<typeof View> | null) => {
      inner.current = view
      if (typeof ref === 'function') ref(view)
      else if (ref) ref.current = view
    },
    [ref]
  )
  useEffect(() => {
    if (web && !off) markSoftDisabled(inner.current, soft)
  }, [web, off, soft])
  return (
    <Pressable
      ref={merged}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      aria-busy={busy}
      // No app, o `disabled` fica de fora no bloqueado: com ele, o Pressable do
      // React Native apagaria o `aria-disabled` do estado acessível
      disabled={soft && !web ? undefined : off}
      // No app, o leitor de tela diz "indisponível", e o toque continua
      {...(soft && !web ? { 'aria-disabled': true } : {})}
      {...(web && hintID ? { 'aria-describedby': hintID } : {})}
      onPress={onPress}
      style={[
        styles.button,
        { backgroundColor: p.bg, borderColor: p.border },
        soft && styles.blocked,
      ]}
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
  blocked: { opacity: 0.5 },
})
