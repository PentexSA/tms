import {
  Text as RNText,
  type TextProps as RNTextProps,
  StyleSheet,
} from 'react-native'
import {
  type ColorName,
  type TypeStyleName,
  textStyle,
  useTheme,
} from './theme'
import { tokens } from './tokens'

export interface TextProps extends RNTextProps {
  readonly variant?: TypeStyleName
  readonly color?: ColorName | 'accent'
}

/** Texto do design system. Todo texto da ficha passa por aqui (nunca HTML). */
export function Text({
  variant = 'body',
  color = 'ink',
  style,
  ...rest
}: TextProps) {
  const theme = useTheme()
  const max = tokens.type[variant] as { maxFontSizeMultiplier?: number }
  return (
    <RNText
      maxFontSizeMultiplier={max.maxFontSizeMultiplier}
      {...rest}
      style={StyleSheet.flatten([
        textStyle(theme, variant),
        {
          color: color === 'accent' ? theme.accent.text : theme.colors[color],
        },
        style,
      ])}
    />
  )
}
