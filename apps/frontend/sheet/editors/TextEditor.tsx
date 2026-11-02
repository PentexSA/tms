import { TextArea, TextField, tokens } from '@tms/ui'
import { Platform, StyleSheet, View } from 'react-native'
import { nextField } from '../../lib/keyboard'
import { properNameInput } from './properName'
import { SuggestionPicker } from './Suggestions'
import type { EditorProps } from './types'

// "Próximo" (T-26): o Enter foca o seguinte. O último da cadeia mostra
// "concluído" e só fecha o teclado: criar a ficha é ação explícita.
const chainKeys = (next?: () => void) =>
  next ? nextField(next) : ({ returnKeyType: 'done' } as const)

// text e longText. O limite vem do template (o mesmo que o servidor aplica).
export function TextEditor({
  id,
  def,
  value,
  onChange,
  error,
  required,
  properName,
  chain,
  inputRef,
  note,
}: EditorProps & {
  /**
   * Um aviso que o leitor de tela ouve com o campo (R-09: "Privadas: o
   * jogador não vê estas notas."): a dica no app e, no web, o
   * `aria-describedby` apontando o texto visível com esse `id`. O nome do
   * campo continua o rótulo.
   */
  readonly note?: { readonly id: string; readonly text: string }
}) {
  const long = def.type === 'longText'
  const max =
    def.type === 'text' || def.type === 'longText'
      ? (def.maxLength ?? (long ? 4000 : 200))
      : 200
  const Field = long ? TextArea : TextField
  const text = typeof value === 'string' ? value : ''
  const field = (
    <Field
      ref={inputRef}
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
      {...(properName ? properNameInput : {})}
      {...(chain && !long ? chainKeys(chain.next) : {})}
      {...(note
        ? {
            accessibilityHint: note.text,
            ...(Platform.OS === 'web'
              ? ({ 'aria-describedby': note.id } as Record<string, string>)
              : {}),
          }
        : {})}
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
