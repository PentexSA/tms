import { Pressable, Text, tokens, useTheme } from '@tms/ui'
import { StyleSheet, View } from 'react-native'

export interface RadioChip {
  readonly id: string
  readonly label: string
  // Nome acessível por extenso ("Físicos, Primária, 7 pontos")
  readonly spoken?: string
}

/**
 * Escolha única em chips, numa linha: a prioridade de um grupo (7 · 5 · 3) e
 * o que a distribuição gasta (Básicos | Bônus). Um radiogroup, como o
 * seletor de modo da ficha.
 */
export function RadioChips({
  label,
  options,
  value,
  onChange,
  disabled = false,
  testID,
}: {
  readonly label: string
  readonly options: readonly RadioChip[]
  readonly value: string | null
  readonly onChange: (id: string) => void
  readonly disabled?: boolean
  readonly testID?: string
}) {
  const { colors } = useTheme()
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={styles.row}
      testID={testID}
    >
      {options.map(o => {
        const on = o.id === value
        return (
          <Pressable
            key={o.id}
            accessibilityRole="radio"
            accessibilityLabel={o.spoken ?? o.label}
            aria-checked={on}
            disabled={disabled}
            testID={testID ? `${testID}-${o.id}` : undefined}
            onPress={() => {
              if (!on) onChange(o.id)
            }}
            style={[
              styles.chip,
              {
                borderColor: on ? colors.action : colors.borderControl,
                backgroundColor: on ? colors.surfaceRaised : 'transparent',
              },
            ]}
          >
            <Text variant="caption" color={on ? 'action' : 'ink'}>
              {o.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: tokens.space[1],
  },
  chip: {
    borderRadius: tokens.radius.pill,
    borderWidth: tokens.borderWidth.control,
    paddingHorizontal: tokens.space[3],
    alignItems: 'center',
    justifyContent: 'center',
  },
})
