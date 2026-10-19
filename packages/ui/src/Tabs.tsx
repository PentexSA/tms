import { StyleSheet, View } from 'react-native'
import { Pressable } from './Pressable'
import { Text } from './Text'
import { useTheme } from './theme'
import { tokens } from './tokens'

export interface TabItem {
  readonly id: string
  readonly label: string
}

export interface TabsProps {
  readonly items: readonly TabItem[]
  readonly selected: string
  readonly onSelect: (id: string) => void
  readonly accessibilityLabel: string
  /** `sm`: abas de segundo nível (grupos dentro de uma seção), mais discretas. */
  readonly size?: 'md' | 'sm'
}

/**
 * Abas fixas que dividem a largura (as 3 zonas da ficha). Com fonte grande o
 * rótulo quebra em duas linhas; a faixa nunca rola de lado. As `sm` ficam
 * dentro de uma seção, abaixo das da ficha: rótulo menor e traço mais fino.
 */
export function Tabs({
  items,
  selected,
  onSelect,
  accessibilityLabel,
  size = 'md',
}: TabsProps) {
  const { colors } = useTheme()
  const sm = size === 'sm'
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={[styles.bar, { borderColor: colors.borderSubtle }]}
    >
      {items.map(item => {
        const active = item.id === selected
        return (
          <Pressable
            key={item.id}
            accessibilityRole="tab"
            accessibilityLabel={item.label}
            aria-selected={active}
            onPress={() => onSelect(item.id)}
            style={[
              styles.tab,
              sm && styles.tabSm,
              active && { borderBottomColor: colors.action },
            ]}
          >
            <Text
              variant={sm ? 'caption' : 'fieldLabel'}
              color={active ? 'ink' : 'inkMuted'}
              style={styles.label}
            >
              {item.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderBottomWidth: tokens.borderWidth.hair },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
    paddingHorizontal: tokens.space[1],
  },
  tabSm: { borderBottomWidth: 2 },
  label: { textAlign: 'center' },
})
