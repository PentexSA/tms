import { useEffect, useRef, useState } from 'react'
import {
  type AccessibilityActionEvent,
  Platform,
  StyleSheet,
  View,
} from 'react-native'
import { Pressable } from './Pressable'
import { Text } from './Text'
import { useTheme } from './theme'
import { tokens } from './tokens'

// Stepper (design system §8 e §11): muda 1 por toque e nunca salta. Segurar
// − ou + repete só no visual e grava UMA mudança ao soltar.
//
// Acessibilidade por plataforma (DS §11): no app, um controle "adjustable"
// com increment e decrement (os botões ficam escondidos do leitor de tela);
// no web, um grupo com os botões "Diminuir" e "Aumentar" de verdade, porque o
// react-native-web não liga as setas do teclado às ações de acessibilidade.

export interface StepperProps {
  readonly label: string
  readonly value: number
  readonly min: number
  readonly max: number
  readonly onChange: (next: number) => void
  // Texto falado do valor ("9 de 13", "2 níveis de dano letal").
  readonly valueText?: (n: number) => string
  readonly disabled?: boolean
  readonly size?: 'inline' | 'sheet'
  readonly testID?: string
  // Tocar no valor (digitar o número). No web é um botão; no app, a ação
  // "activate" do controle ajustável (toque duplo do leitor de tela).
  readonly onValuePress?: () => void
}

const HOLD_DELAY_MS = 400
const REPEAT_MS = 100

export function Stepper({
  label,
  value,
  min,
  max,
  onChange,
  valueText,
  disabled = false,
  size = 'inline',
  testID,
  onValuePress,
}: StepperProps) {
  const { colors } = useTheme()
  const [display, setDisplay] = useState(value)
  const shown = useRef(value)
  // Segurar: o onLongPress liga a repetição (só visual); soltar grava uma vez.
  // O toque simples é o onPress, que também atende Enter e Espaço no web e a
  // ativação pelo leitor de tela.
  const hold = useRef<{
    repeat?: ReturnType<typeof setInterval>
    repeating: boolean
  }>({ repeating: false })

  useEffect(() => {
    setDisplay(value)
    shown.current = value
  }, [value])
  useEffect(() => () => stop(), [])

  const clamp = (n: number) => Math.max(min, Math.min(max, n))
  const show = (n: number) => {
    shown.current = n
    setDisplay(n)
  }
  const commit = (n: number) => {
    const next = clamp(n)
    if (next !== value) onChange(next)
  }
  function stop() {
    clearInterval(hold.current.repeat)
    hold.current.repeat = undefined
  }
  const longPress = (delta: number) => {
    hold.current.repeating = true
    show(clamp(shown.current + delta))
    hold.current.repeat = setInterval(
      () => show(clamp(shown.current + delta)),
      REPEAT_MS
    )
  }
  const pressOut = () => {
    if (!hold.current.repeating) return
    hold.current.repeating = false
    stop()
    commit(shown.current)
  }
  const onAction = (e: AccessibilityActionEvent) => {
    if (e.nativeEvent.actionName === 'increment') commit(value + 1)
    if (e.nativeEvent.actionName === 'decrement') commit(value - 1)
    if (e.nativeEvent.actionName === 'activate') onValuePress?.()
  }
  const typeable = Boolean(onValuePress) && !disabled

  const big = size === 'sheet'
  const web = Platform.OS === 'web'
  const spoken = valueText ? valueText(display) : String(display)
  const button = (delta: 1 | -1) => {
    const off = disabled || (delta < 0 ? display <= min : display >= max)
    return (
      <Pressable
        testID={testID ? `${testID}-${delta > 0 ? 'inc' : 'dec'}` : undefined}
        {...(web
          ? {
              accessibilityRole: 'button' as const,
              accessibilityLabel: `${delta > 0 ? 'Aumentar' : 'Diminuir'} ${label}`,
            }
          : { accessible: false, 'aria-hidden': true })}
        disabled={off}
        onPress={() => commit(value + delta)}
        onLongPress={() => longPress(delta)}
        delayLongPress={HOLD_DELAY_MS}
        onPressOut={pressOut}
        style={[
          styles.button,
          big && styles.big,
          { borderColor: colors.borderControl },
        ]}
      >
        <Text variant={big ? 'numberLg' : 'number'}>
          {delta > 0 ? '+' : '−'}
        </Text>
      </Pressable>
    )
  }

  const container = web
    ? { role: 'group' as const, 'aria-label': label }
    : {
        accessible: true,
        accessibilityRole: 'adjustable' as const,
        accessibilityLabel: label,
        'aria-valuemin': min,
        'aria-valuemax': max,
        'aria-valuenow': display,
        'aria-valuetext': valueText ? valueText(display) : undefined,
        'aria-disabled': disabled,
        accessibilityActions: [
          { name: 'increment' },
          { name: 'decrement' },
          ...(typeable ? [{ name: 'activate', label: 'Digitar o valor' }] : []),
        ],
        onAccessibilityAction: disabled ? undefined : onAction,
      }

  const shownValue = (
    <Text
      variant={big ? 'numberLg' : 'number'}
      style={[styles.value, big && styles.valueBig]}
      {...(web
        ? {
            accessibilityLabel: `${label}, ${spoken}`,
            'aria-live': 'polite' as const,
          }
        : {})}
    >
      {String(display)}
    </Text>
  )

  return (
    <View testID={testID} {...container} style={styles.row}>
      {button(-1)}
      {typeable ? (
        <Pressable
          testID={testID ? `${testID}-value` : undefined}
          {...(web
            ? {
                accessibilityRole: 'button' as const,
                accessibilityLabel: `Digitar ${label}`,
              }
            : { accessible: false, 'aria-hidden': true })}
          onPress={onValuePress}
          style={styles.valueTarget}
        >
          {shownValue}
        </Pressable>
      ) : (
        shownValue
      )}
      {button(1)}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: tokens.space[2] },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radius.md,
    borderWidth: tokens.borderWidth.control,
  },
  big: { width: tokens.size.stepperSize, height: tokens.size.stepperSize },
  value: { minWidth: 32, textAlign: 'center' },
  valueTarget: { alignItems: 'center', justifyContent: 'center' },
  valueBig: { minWidth: 56 },
})
