import { Platform, StyleSheet } from 'react-native'
import { Pressable } from './Pressable'
import { Text } from './Text'
import { useTheme } from './theme'
import { tokens } from './tokens'

export interface ChipProps {
  readonly label: string
  readonly selected?: boolean
  readonly onPress?: () => void
  readonly accessibilityLabel?: string
  readonly testID?: string
  /**
   * `toggle` (padrão): alternância de filtro ou atalho; no web,
   * `aria-pressed`. `switch`: liga e desliga um estado (Rolagem oculta),
   * anunciado como interruptor ligado ou desligado em todas as plataformas.
   */
  readonly kind?: 'toggle' | 'switch'
}

export function Chip({
  label,
  selected = false,
  onPress,
  accessibilityLabel,
  testID,
  kind = 'toggle',
}: ChipProps) {
  const { colors } = useTheme()
  // O ARIA não aceita aria-selected num botão, e o web não anunciava nada:
  // a alternância é aria-pressed (web) ou o "selecionado" do app.
  const state =
    kind === 'switch'
      ? { accessibilityRole: 'switch' as const, 'aria-checked': selected }
      : Platform.OS === 'web'
        ? { accessibilityRole: 'button' as const, 'aria-pressed': selected }
        : { accessibilityRole: 'button' as const, 'aria-selected': selected }
  return (
    <Pressable
      testID={testID}
      {...state}
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      disabled={!onPress}
      style={[
        styles.chip,
        {
          borderColor: selected ? colors.action : colors.borderControl,
          backgroundColor: selected ? colors.surfaceRaised : 'transparent',
        },
      ]}
    >
      <Text variant="caption" color={selected ? 'action' : 'ink'}>
        {label}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: tokens.radius.pill,
    borderWidth: tokens.borderWidth.control,
    paddingHorizontal: tokens.space[3],
    alignItems: 'center',
    justifyContent: 'center',
  },
})
