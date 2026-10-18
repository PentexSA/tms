import { StyleSheet, View } from 'react-native'
import { Text } from './Text'
import { useTheme } from './theme'
import { tokens } from './tokens'

// Trilha de caixas (Vitalidade do WoD, testes contra a morte, estresse). Só
// visual: o glifo e o nome do tipo de dano vêm do template, e a frase falada
// vem do describe() do core.

export interface Box {
  // Glifo do tipo de dano ("/", "X", "✱"); vazio quando a caixa está livre.
  readonly glyph?: string
  readonly tone?: 'empty' | 'filled' | 'severe'
}

export interface BoxTrackProps {
  readonly boxes: readonly Box[]
  readonly testID?: string
}

export function BoxTrack({ boxes, testID }: BoxTrackProps) {
  const { colors, accent } = useTheme()
  return (
    <View
      testID={testID}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.row}
    >
      {boxes.map((box, i) => {
        const tone = box.tone ?? (box.glyph ? 'filled' : 'empty')
        return (
          <View
            // biome-ignore lint/suspicious/noArrayIndexKey: posição fixa da caixa
            key={i}
            testID={`box-${tone}`}
            style={[
              styles.box,
              {
                borderColor:
                  tone === 'empty' ? colors.borderControl : accent.fill,
                backgroundColor:
                  tone === 'severe' ? accent.fill : 'transparent',
              },
            ]}
          >
            {box.glyph ? (
              <Text
                variant="numberSm"
                style={{ color: tone === 'severe' ? accent.on : colors.ink }}
              >
                {box.glyph}
              </Text>
            ) : null}
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space[1] },
  box: {
    width: tokens.size.boxSize,
    height: tokens.size.boxSize,
    borderRadius: tokens.radius.sm,
    borderWidth: tokens.borderWidth.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
