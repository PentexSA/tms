import { StyleSheet } from 'react-native'
import { Pressable } from './Pressable'
import { Text } from './Text'
import { tokens } from './tokens'

export interface IconButtonProps {
  // Nome acessível obrigatório: o glifo sozinho não diz nada ao leitor de tela.
  readonly label: string
  readonly glyph: string
  readonly onPress: () => void
  readonly disabled?: boolean
  readonly testID?: string
}

export function IconButton({
  label,
  glyph,
  onPress,
  disabled,
  testID,
}: IconButtonProps) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={styles.button}
    >
      <Text variant="title" accessible={false} aria-hidden>
        {glyph}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radius.pill,
  },
})
