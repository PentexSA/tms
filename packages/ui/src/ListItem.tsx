import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { Pressable } from './Pressable'
import { Text } from './Text'
import { useTheme } from './theme'
import { tokens } from './tokens'

export interface ListItemProps {
  readonly title: string
  readonly subtitle?: string
  readonly meta?: string
  readonly leading?: ReactNode
  readonly trailing?: ReactNode
  readonly onPress?: () => void
  // Sem ele, título, subtítulo e meta formam o nome acessível.
  readonly accessibilityLabel?: string
  readonly testID?: string
}

/** Linha de lista: a linha inteira é um só alvo (crônica, personagem). */
export function ListItem({
  title,
  subtitle,
  meta,
  leading,
  trailing,
  onPress,
  accessibilityLabel,
  testID,
}: ListItemProps) {
  const { colors } = useTheme()
  const label =
    accessibilityLabel ?? [title, subtitle, meta].filter(Boolean).join(', ')
  const body = (
    <>
      {leading}
      <View style={styles.text}>
        <Text variant="fieldLabel" numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" color="inkMuted" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
        {meta ? (
          <Text variant="caption" color="inkMuted">
            {meta}
          </Text>
        ) : null}
      </View>
      {trailing}
    </>
  )
  const style = [styles.row, { borderBottomColor: colors.borderSubtle }]
  return onPress ? (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={style}
    >
      {body}
    </Pressable>
  ) : (
    <View testID={testID} accessible accessibilityLabel={label} style={style}>
      {body}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space[3],
    minHeight: tokens.size.rowMin + 16,
    paddingVertical: tokens.space[2],
    paddingHorizontal: tokens.layout.gutter,
    borderBottomWidth: tokens.borderWidth.hair,
  },
  text: { flex: 1, gap: tokens.space['0.5'] },
})
