import { useEffect, useRef, useState } from 'react'
import { type AccessibilityActionEvent, StyleSheet, View } from 'react-native'
import { Pressable } from './Pressable'
import { Text } from './Text'
import { useTheme } from './theme'
import { tokens } from './tokens'

// Stepper (design system §8 e §11): muda 1 por toque e nunca salta. Para o
// leitor de tela é um controle "adjustable" com increment e decrement. Segurar
// − ou + repete só no visual e grava UMA mudança ao soltar.

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
}: StepperProps) {
  const { colors } = useTheme()
  const [display, setDisplay] = useState(value)
  const shown = useRef(value)
  const hold = useRef<{
    delay?: ReturnType<typeof setTimeout>
    repeat?: ReturnType<typeof setInterval>
    repeated: boolean
  }>({ repeated: false })

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
    clearTimeout(hold.current.delay)
    clearInterval(hold.current.repeat)
  }
  const pressIn = (delta: number) => {
    hold.current.repeated = false
    hold.current.delay = setTimeout(() => {
      hold.current.repeat = setInterval(() => {
        hold.current.repeated = true
        show(clamp(shown.current + delta))
      }, REPEAT_MS)
    }, HOLD_DELAY_MS)
  }
  const pressOut = (delta: number) => {
    stop()
    if (hold.current.repeated) commit(shown.current)
    else commit(value + delta)
  }
  const onAction = (e: AccessibilityActionEvent) => {
    if (e.nativeEvent.actionName === 'increment') commit(value + 1)
    if (e.nativeEvent.actionName === 'decrement') commit(value - 1)
  }

  const big = size === 'sheet'
  const button = (delta: 1 | -1) => {
    const off = disabled || (delta < 0 ? display <= min : display >= max)
    return (
      <Pressable
        testID={testID ? `${testID}-${delta > 0 ? 'inc' : 'dec'}` : undefined}
        accessible={false}
        importantForAccessibility="no"
        disabled={off}
        onPressIn={() => pressIn(delta)}
        onPressOut={() => pressOut(delta)}
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

  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{
        min,
        max,
        now: display,
        text: valueText ? valueText(display) : undefined,
      }}
      accessibilityState={{ disabled }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={disabled ? undefined : onAction}
      style={styles.row}
    >
      {button(-1)}
      <Text
        variant={big ? 'numberLg' : 'number'}
        style={[styles.value, big && styles.valueBig]}
      >
        {String(display)}
      </Text>
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
  valueBig: { minWidth: 56 },
})
