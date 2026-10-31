import { TextArea, TextField, tokens } from '@tms/ui'
import { StyleSheet, View } from 'react-native'
import { SuggestionPicker } from './Suggestions'
import type { EditorProps } from './types'

// text e longText. O limite vem do template (o mesmo que o servidor aplica).
export function TextEditor({
  id,
  def,
  value,
  onChange,
  error,
  required,
}: EditorProps) {
  const long = def.type === 'longText'
  const max =
    def.type === 'text' || def.type === 'longText'
      ? (def.maxLength ?? (long ? 4000 : 200))
      : 200
  const Field = long ? TextArea : TextField
  const text = typeof value === 'string' ? value : ''
  const field = (
    <Field
      testID={`editor-${id}`}
      label={required ? `${def.label} (obrigatório)` : def.label}
      value={text}
      onChangeText={onChange}
      maxLength={max}
      error={error}
      hint={def.help}
      placeholder={
        def.type === 'text' || def.type === 'longText'
          ? def.placeholder
          : undefined
      }
    />
  )
  // Com sugestões no template (Natureza, Comportamento), a lista ao lado
  const suggestions = def.type === 'text' ? def.suggestions : undefined
  if (!suggestions?.length) return field
  return (
    <View style={styles.field}>
      {field}
      <SuggestionPicker
        label={def.label}
        options={suggestions}
        value={text}
        onPick={onChange}
        testID={`suggest-${id}`}
      />
    </View>
  )
}

const styles = StyleSheet.create({ field: { gap: tokens.space[1] } })
