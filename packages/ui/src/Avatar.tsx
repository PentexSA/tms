import { StyleSheet, View } from 'react-native'
import { Text } from './Text'
import { useTheme } from './theme'
import { tokens } from './tokens'

export const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('')

export interface AvatarProps {
  readonly name: string
  readonly size?: 'sm' | 'lg'
}

/** Iniciais na cor do accent do contexto. Decorativo: o nome está ao lado. */
export function Avatar({ name, size = 'sm' }: AvatarProps) {
  const { accent } = useTheme()
  const d = size === 'lg' ? tokens.size.avatarLg : tokens.size.avatarSm
  return (
    <View
      accessible={false}
      aria-hidden
      style={[
        styles.avatar,
        { width: d, height: d, backgroundColor: accent.fill },
      ]}
    >
      <Text
        variant={size === 'lg' ? 'displaySm' : 'fieldLabel'}
        style={{ color: accent.on }}
      >
        {initials(name)}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  avatar: {
    borderRadius: tokens.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
