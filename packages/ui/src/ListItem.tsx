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

/**
 * Linha de lista: a linha inteira é um só alvo (crônica, personagem).
 *
 * Sem `onPress`, a linha é um elemento só para o leitor de tela. Com
 * `trailing` (Revogar, Remover), o texto vira o elemento e o `trailing` fica
 * fora dele: senão, no app, o botão some dentro da linha. `onPress` com
 * `trailing` interativo não é suportado (botão dentro de botão).
 */
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
  const text = (
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
  )
  const style = [styles.row, { borderBottomColor: colors.borderSubtle }]
  if (onPress)
    return (
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        style={style}
      >
        {leading}
        {text}
        {trailing}
      </Pressable>
    )
  if (!trailing)
    return (
      <View testID={testID} accessible accessibilityLabel={label} style={style}>
        {leading}
        {text}
      </View>
    )
  return (
    <View testID={testID} style={style}>
      <View accessible accessibilityLabel={label} style={styles.main}>
        {leading}
        {text}
      </View>
      {trailing}
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
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space[3],
  },
  text: { flex: 1, gap: tokens.space['0.5'] },
})
