import {
  BottomSheet,
  Button,
  Pressable,
  Text,
  TextArea,
  TextField,
  tokens,
  useTheme,
} from '@tms/ui'
import { useState } from 'react'
import { Platform, StyleSheet, View } from 'react-native'
import { useSheet } from '../context'
import { properNameInput } from '../editors/properName'
import { SuggestionChips } from '../editors/Suggestions'
import type { FieldViewProps } from '../views/types'
import { fieldA11y } from './a11y'
import { useCompact } from './compact'
import { useFieldIssue, useSetDraft } from './hooks'

// text e longText em Evoluir: a linha mostra o começo do texto e abre um
// sheet com o campo, o contador e o limite do template (o mesmo do servidor).
// O texto é do jogador: aparece sempre em <Text>, nunca como HTML.

// T-10: no campo de uma linha, o "✓" do teclado (Enter no web) aplica, como
// no "Digitar" do NumberEditorRow (T-25). Enter não tira o foco: com erro,
// o campo fica aberto. No texto longo, Enter continua sendo nova linha.
function singleLineSubmit(apply: () => void) {
  return {
    returnKeyType: 'done',
    submitBehavior: 'submit',
    ...(Platform.OS === 'web' ? { blurOnSubmit: false } : {}),
    onSubmitEditing: apply,
  } as const
}

export function TextEditorRow({ resolved }: FieldViewProps) {
  const { colors } = useTheme()
  const { model } = useSheet()
  const set = useSetDraft()
  const issue = useFieldIssue(resolved.id)
  const compact = useCompact()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  if (resolved.type !== 'text' && resolved.type !== 'longText') return null
  const def = resolved.field.def
  const long = resolved.type === 'longText'
  const max = def.maxLength ?? (long ? 4000 : 200)
  const required = resolved.id === model.template.identity.name
  const Field = long ? TextArea : TextField
  const apply = () => {
    const clean = text.trim()
    if (required && !clean) {
      setError('Informe o nome')
      return
    }
    const err = set(`values.${resolved.id}`, clean ? clean : null)
    setError(err)
    if (!err) setOpen(false)
  }
  const value = resolved.value
  return (
    <>
      <Pressable
        testID={`editor-${resolved.id}`}
        accessibilityRole="button"
        {...fieldA11y(def.label, value || 'vazio')}
        accessibilityHint="Abre o editor de texto"
        onPress={() => {
          setText(value)
          setError(null)
          setOpen(true)
        }}
        style={[
          styles.row,
          compact && styles.compact,
          { borderBottomColor: colors.borderSubtle },
        ]}
      >
        <View style={styles.text}>
          <Text variant="fieldLabel">{def.label}</Text>
          <Text color={value ? 'ink' : 'inkMuted'} numberOfLines={2}>
            {value || '—'}
          </Text>
          {issue ? (
            <Text variant="caption" color="danger" accessibilityRole="alert">
              {issue}
            </Text>
          ) : null}
        </View>
        {compact ? null : (
          <Text variant="caption" color="action">
            Editar
          </Text>
        )}
      </Pressable>
      <BottomSheet
        visible={open}
        title={def.label}
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button
              title="Cancelar"
              variant="ghost"
              onPress={() => setOpen(false)}
            />
            <Button title="Aplicar" onPress={apply} />
          </>
        }
      >
        <Field
          label={required ? `${def.label} (obrigatório)` : def.label}
          value={text}
          onChangeText={setText}
          maxLength={max}
          error={error}
          hint={def.help}
          placeholder={def.placeholder}
          autoFocus
          {...(required ? properNameInput : {})}
          {...(long ? {} : singleLineSubmit(apply))}
        />
        {def.type === 'text' && def.suggestions?.length ? (
          <View style={styles.suggestions}>
            <SuggestionChips
              options={def.suggestions}
              value={text}
              onPick={setText}
              testID={`suggest-${resolved.id}`}
            />
          </View>
        ) : null}
      </BottomSheet>
    </>
  )
}

const styles = StyleSheet.create({
  row: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space[3],
    minHeight: tokens.size.rowMin,
    paddingVertical: tokens.space[2],
    paddingHorizontal: tokens.layout.gutter,
    borderBottomWidth: tokens.borderWidth.hair,
  },
  compact: { paddingHorizontal: 0, paddingVertical: tokens.space[1] },
  text: { flex: 1, gap: tokens.space['0.5'] },
  suggestions: { paddingTop: tokens.space[3] },
})
