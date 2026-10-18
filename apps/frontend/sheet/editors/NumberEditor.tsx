import { Stepper, Text, tokens } from '@tms/ui'
import { StyleSheet, View } from 'react-native'
import type { EditorProps } from './types'

// number e rating: o Stepper muda 1 por toque, dentro da faixa do template.
export function NumberEditor({ id, def, value, onChange, error }: EditorProps) {
  if (def.type !== 'number' && def.type !== 'rating') return null
  const min = def.min ?? 0
  const max = def.type === 'rating' ? def.max : (def.max ?? 1_000_000)
  const current =
    typeof value === 'number' ? value : (def.default ?? def.min ?? 0)
  const suffix = def.type === 'number' ? (def.suffix ?? '') : ''
  return (
    <View testID={`editor-${id}`} style={styles.row}>
      <View style={styles.label}>
        <Text variant="fieldLabel">{def.label}</Text>
        {suffix ? (
          <Text variant="caption" color="inkMuted">
            {`${current}${suffix}`}
          </Text>
        ) : null}
        {error ? (
          <Text variant="caption" color="danger" accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
      </View>
      <Stepper
        label={def.label}
        value={current}
        min={min}
        max={max}
        onChange={onChange}
        valueText={n =>
          def.type === 'rating' ? `${n} de ${max}` : `${n}${suffix}`
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: tokens.space[3] },
  label: { flex: 1, gap: tokens.space['0.5'] },
})
