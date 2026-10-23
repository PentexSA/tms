import { Image, StyleSheet, View } from 'react-native'
import { Emblem, isEmblem } from './Emblem'
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
  // Símbolo da criatura (identity.emblem do template) no lugar das
  // iniciais; nome desconhecido ou ausente volta às iniciais.
  readonly emblem?: string | null
  readonly imageUrl?: string | null
}

/** Símbolo ou iniciais na cor do accent do contexto. Decorativo: o nome está ao lado. */
export function Avatar({ name, size = 'sm', emblem, imageUrl }: AvatarProps) {
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
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          accessibilityLabel={`Retrato de ${name}`}
          style={{ width: d, height: d, borderRadius: tokens.radius.pill }}
        />
      ) : isEmblem(emblem) ? (
        <Emblem
          name={emblem}
          size={Math.round(d * 0.62)}
          color={accent.on}
          testID={`emblem-${emblem}`}
        />
      ) : (
        <Text
          variant={size === 'lg' ? 'displaySm' : 'fieldLabel'}
          style={{ color: accent.on }}
        >
          {initials(name)}
        </Text>
      )}
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
