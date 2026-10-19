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
  /** Colunas; por padrão, 2 a partir de 8 opções (os 14 clãs). */
  readonly columns?: 1 | 2
}

// A partir daqui a lista vira grade, para não rolar uma coluna longa
const GRID_FROM = 8

/** Escolha única: radiogroup com um radio marcado (Clã, Natureza...). */
export function Choice({
  label,
  options,
  value,
  onChange,
  testID,
  columns = options.length >= GRID_FROM ? 2 : 1,
}: ChoiceProps) {
  const { colors } = useTheme()
  const grid = columns === 2
  return (
    <View
      testID={testID}
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={[styles.group, grid && styles.grid]}
    >
      {options.map(o => {
        const checked = o.id === value
        return (
          <Pressable
            key={o.id}
            accessibilityRole="radio"
            accessibilityLabel={o.meta ? `${o.label}, ${o.meta}` : o.label}
            aria-checked={checked}
            onPress={() => onChange(o.id)}
            style={[styles.row, grid && styles.cell]}
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 0 },
  // 50% menos o respiro, para o rótulo não colar na coluna ao lado
  cell: { width: '50%', paddingRight: tokens.space[2] },
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
