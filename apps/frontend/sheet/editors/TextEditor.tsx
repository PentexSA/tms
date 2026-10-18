import { TextArea, TextField } from '@tms/ui'
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
  return (
    <Field
      testID={`editor-${id}`}
      label={required ? `${def.label} (obrigatório)` : def.label}
      value={typeof value === 'string' ? value : ''}
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
}
