import {
  Pressable as RNPressable,
  type PressableProps as RNPressableProps,
  type StyleProp,
  StyleSheet,
  type ViewStyle,
} from 'react-native'
import { useTheme } from './theme'
import { tokens } from './tokens'

export interface PressableProps extends Omit<RNPressableProps, 'style'> {
  readonly style?: StyleProp<ViewStyle>
  // Alvo mínimo de 44×44 (hit-size). Desligue só quando o pai já é o alvo.
  readonly minTarget?: boolean
}

/** Área tocável com o estado pressionado do design system e alvo de 44. */
export function Pressable({
  style,
  minTarget = true,
  disabled,
  ...rest
}: PressableProps) {
  const theme = useTheme()
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
      {...rest}
    />
  )
}

const styles = StyleSheet.create({
  target: { minHeight: tokens.size.hitSize, minWidth: tokens.size.hitSize },
  disabled: { opacity: 0.5 },
})
