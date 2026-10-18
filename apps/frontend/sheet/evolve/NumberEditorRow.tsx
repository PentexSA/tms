import { Stepper, textStyle, tokens, useTheme } from '@tms/ui'
import { useState } from 'react'
import { StyleSheet, TextInput } from 'react-native'
import type { FieldViewProps } from '../views/types'
import { EditorShell } from './EditorShell'
import { useFieldIssue, useSetDraft } from './hooks'
import { SpecialtyEditor } from './SpecialtyEditor'

// rating, number e percent em Evoluir (DS: FieldRow com Stepper inline). O
// Stepper muda 1 por toque; tocar no valor abre o teclado numérico. O que
// passa da faixa do template o core recusa (e a mensagem aparece aqui).

interface Range {
  readonly value: number
  readonly min: number
  readonly max: number
  readonly spoken: (n: number) => string
}

function rangeOf(props: FieldViewProps): Range | null {
  const r = props.resolved
  if (r.type === 'rating') {
    const { min = 0, max } = r.field.def
    return { value: r.base, min, max, spoken: n => `${n} de ${max}` }
  }
  if (r.type === 'percent') {
    const max = r.field.def.max ?? 99
    return { value: r.base, min: 0, max, spoken: n => `${n}%` }
  }
  if (r.type === 'number') {
    const { min = 0, max = 1_000_000, suffix = '' } = r.field.def
    return { value: r.value, min, max, spoken: n => `${n}${suffix}` }
  }
  return null
}

export function NumberEditorRow(props: FieldViewProps) {
  const { resolved, sheet } = props
  const theme = useTheme()
  const { colors } = theme
  const set = useSetDraft()
  const issue = useFieldIssue(resolved.id)
  const [error, setError] = useState<string | null>(null)
  const [typing, setTyping] = useState(false)
  const range = rangeOf(props)
  if (!range) return null
  const def = resolved.field.def
  const path = `values.${resolved.id}`
  const apply = (n: number) => setError(set(path, n))
  const typed = (text: string) => {
    const n = Number.parseInt(text, 10)
    if (!Number.isInteger(n) || n < range.min || n > range.max) {
      setError(`Digite um número de ${range.min} a ${range.max}`)
      return
    }
    setTyping(false)
    apply(n)
  }
  const specialty =
    'specialty' in def && def.specialty ? (
      <SpecialtyEditor
        id={resolved.id}
        label={def.label}
        specialty={sheet.specialty(resolved.id)}
      />
    ) : null
  return (
    <EditorShell
      label={def.label}
      error={error ?? issue}
      below={specialty}
      testID={`editor-${resolved.id}`}
    >
      {typing ? (
        <TextInput
          accessibilityLabel={`${def.label}, de ${range.min} a ${range.max}`}
          keyboardType="number-pad"
          returnKeyType="done"
          autoFocus
          selectTextOnFocus
          defaultValue={String(range.value)}
          maxLength={String(range.max).length + 1}
          onSubmitEditing={e => typed(e.nativeEvent.text)}
          onEndEditing={e => typed(e.nativeEvent.text)}
          style={[
            styles.input,
            textStyle(theme, 'number'),
            { borderColor: colors.borderControl, color: colors.ink },
          ]}
        />
      ) : (
        <Stepper
          label={def.label}
          value={range.value}
          min={range.min}
          max={range.max}
          onChange={apply}
          valueText={range.spoken}
          onValuePress={() => setTyping(true)}
        />
      )}
    </EditorShell>
  )
}

const styles = StyleSheet.create({
  input: {
    minWidth: 72,
    minHeight: tokens.size.hitSize,
    borderWidth: tokens.borderWidth.control,
    borderRadius: tokens.radius.md,
    paddingHorizontal: tokens.space[3],
    textAlign: 'center',
  },
})
