import { StyleSheet, View } from 'react-native'
import { Pressable } from './Pressable'
import { Text } from './Text'
import { useTheme } from './theme'
import { tokens } from './tokens'

export interface ChoiceOption {
  readonly id: string
  readonly label: string
  readonly meta?: string
}

export interface ChoiceProps {
  readonly label: string
  readonly options: readonly ChoiceOption[]
  readonly value: string | null
  readonly onChange: (id: string) => void
  readonly testID?: string
}

/** Escolha única: radiogroup com um radio marcado (Clã, Natureza...). */
export function Choice({
  label,
  options,
  value,
  onChange,
  testID,
}: ChoiceProps) {
  const { colors } = useTheme()
  return (
    <View
      testID={testID}
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={styles.group}
    >
      {options.map(o => {
        const checked = o.id === value
        return (
          <Pressable
            key={o.id}
            accessibilityRole="radio"
            accessibilityLabel={o.meta ? `${o.label}, ${o.meta}` : o.label}
            accessibilityState={{ checked }}
            onPress={() => onChange(o.id)}
            style={styles.row}
          >
            <View
              style={[
                styles.mark,
                { borderColor: checked ? colors.action : colors.borderControl },
              ]}
            >
              {checked ? (
                <View
                  style={[styles.dot, { backgroundColor: colors.action }]}
                />
              ) : null}
            </View>
            <View style={styles.text}>
              <Text variant="fieldLabel">{o.label}</Text>
              {o.meta ? (
                <Text variant="caption" color="inkMuted">
                  {o.meta}
                </Text>
              ) : null}
            </View>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  group: { gap: tokens.space[1] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space[3],
    minHeight: tokens.size.rowMin,
  },
  mark: {
    width: 22,
    height: 22,
    borderRadius: tokens.radius.pill,
    borderWidth: tokens.borderWidth.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: 12, height: 12, borderRadius: tokens.radius.pill },
  text: { flex: 1 },
})
