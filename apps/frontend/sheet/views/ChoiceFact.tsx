import { describe, plain, type ResolvedChoice } from '@tms/sheet-core'
import { Glyph, isGlyph, Text, tokens, useTheme } from '@tms/ui'
import { StyleSheet, View } from 'react-native'
import type { FieldViewProps } from './types'

// Termo e valor de um `choice`, com o glifo do template ao lado da opção
// (`glyph: augur-moon` desenha a fase da lua do Augúrio a partir do
// `glyphParam`). Sem glifo, é o mesmo fato do GenericFact.
export function ChoiceFact({ resolved, sheet }: FieldViewProps) {
  const { colors } = useTheme()
  const r = resolved as ResolvedChoice
  const glyph = r.field.def.glyph
  const param = r.option?.glyphParam
  const value = plain(r, sheet)
  return (
    <View
      accessible
      accessibilityLabel={describe(r, sheet)}
      accessibilityValue={value ? { text: value } : undefined}
      style={styles.fact}
    >
      <Text variant="caption" color="inkMuted">
        {r.field.def.label}
      </Text>
      <View style={styles.value}>
        {isGlyph(glyph) && typeof param === 'number' ? (
          <Glyph
            name={glyph}
            param={param}
            size={18}
            color={colors.ink}
            testID={`glyph-${r.id}`}
          />
        ) : null}
        <Text>{value || '—'}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  fact: { gap: tokens.space['0.5'], paddingVertical: tokens.space[1] },
  value: { flexDirection: 'row', alignItems: 'center', gap: tokens.space[1] },
})
