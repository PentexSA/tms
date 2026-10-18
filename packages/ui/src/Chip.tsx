import { StyleSheet } from 'react-native'
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
}

export function Chip({
  label,
  selected = false,
  onPress,
  accessibilityLabel,
  testID,
}: ChipProps) {
  const { colors } = useTheme()
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
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
