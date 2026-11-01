import type { ComponentProps } from 'react'
import {
  type GestureResponderEvent,
  type KeyDownEvent,
  Platform,
  Pressable as RNPressable,
  type PressableProps as RNPressableProps,
  type StyleProp,
  StyleSheet,
  type ViewStyle,
} from 'react-native'
import { keyOf } from './roving'
import { useTheme } from './theme'
import { tokens } from './tokens'

export interface PressableProps extends Omit<RNPressableProps, 'style'> {
  readonly style?: StyleProp<ViewStyle>
  // Alvo mínimo de 44×44 (hit-size). Desligue só quando o pai já é o alvo.
  readonly minTarget?: boolean
  // Com o React 19 o ref é prop: o foco itinerante (roving.ts) move o foco por ele.
  readonly ref?: ComponentProps<typeof RNPressable>['ref']
}

// Papéis que o react-native-web só ativa com Enter: o Espaço dele vale só
// para `button` (PressResponder.isValidKeyPress). Aqui o Espaço passa a
// valer também para estes, como no HTML (rádio, aba, interruptor, caixa).
const SPACE_ROLES = new Set(['radio', 'tab', 'switch', 'checkbox'])

/** Área tocável com o estado pressionado do design system e alvo de 44. */
export function Pressable({
  style,
  minTarget = true,
  disabled,
  onKeyDown,
  ...rest
}: PressableProps) {
  const theme = useTheme()
  const role = (rest.role ?? rest.accessibilityRole) as string | undefined
  const space = Platform.OS === 'web' && role != null && SPACE_ROLES.has(role)
  const keyDown = space
    ? (e: KeyDownEvent) => {
        onKeyDown?.(e)
        const { key, repeat } = keyOf(e)
        if ((key === ' ' || key === 'Spacebar') && !repeat && !disabled) {
          // A página não rola, e a ação sai uma vez só (sem auto-repetição).
          e.preventDefault()
          rest.onPress?.(e as unknown as GestureResponderEvent)
        }
      }
    : onKeyDown
  return (
    <RNPressable
      disabled={disabled}
      aria-disabled={!!disabled}
      style={({ pressed }) =>
        StyleSheet.flatten([
          minTarget && styles.target,
          style,
          pressed &&
            !disabled && { backgroundColor: theme.colors.statePressed },
          disabled && styles.disabled,
        ])
      }
      {...(keyDown ? { onKeyDown: keyDown } : {})}
      {...rest}
    />
  )
}

const styles = StyleSheet.create({
  target: { minHeight: tokens.size.hitSize, minWidth: tokens.size.hitSize },
  disabled: { opacity: 0.5 },
})
