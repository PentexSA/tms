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
import { StyleSheet, View } from 'react-native'
import { submitField } from '../../lib/keyboard'
import { useSheet } from '../context'
import { properNameInput } from '../editors/properName'
import { SuggestionChips } from '../editors/Suggestions'
import type { FieldViewProps } from '../views/types'
import { fieldA11y } from './a11y'
import { useCompact } from './compact'
import { fieldHelp } from './EditorShell'
import { HelpRow, helpRowInner } from './HelpRow'
import { useFieldIssue, useSetDraft } from './hooks'
import { useTextDefault } from './recommend'

// text e longText em Evoluir: a linha mostra o começo do texto e abre um
// sheet com o campo, o contador e o limite do template (o mesmo do servidor).
// O texto é do jogador: aparece sempre em <Text>, nunca como HTML.
//
// Com `default` por opção (a Fraqueza pelo Clã, R-26), a ficha mostra o
// texto da opção enquanto o campo não é gravado: nada é gravado sozinho, e
// "Aplicar" sem mudar o texto não grava. O texto do jogador vence; apagar
// tudo volta ao texto da opção. Com um texto próprio, a folha oferece voltar
// a ele ("Usar o resumo"), com confirmação.

export function TextEditorRow({ resolved }: FieldViewProps) {
  const { colors } = useTheme()
  const { model } = useSheet()
  const set = useSetDraft()
  const issue = useFieldIssue(resolved.id)
  const compact = useCompact()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  // Pelo store: com o texto gravado, trocar o Clã não muda este campo
  const initial = useTextDefault(resolved.id)
  if (resolved.type !== 'text' && resolved.type !== 'longText') return null
  const def = resolved.field.def
  const long = resolved.type === 'longText'
  const max = def.maxLength ?? (long ? 4000 : 200)
  const required = resolved.id === model.template.identity.name
  const Field = long ? TextArea : TextField
  const value = resolved.value
  const apply = () => {
    const clean = text.trim()
    if (required && !clean) {
      setError('Informe o nome')
      return
    }
    // O texto da opção, sem mudança: nada a gravar (a ficha segue a opção)
    if (resolved.defaulted && clean === value) {
      setOpen(false)
      return
    }
    const err = set(`values.${resolved.id}`, clean ? clean : null)
    setError(err)
    if (!err) setOpen(false)
  }
  // Voltar ao texto da opção: tira o texto gravado, e a ficha passa a
  // seguir a opção de novo (o "Desfazer" é o do rascunho, antes do Salvar)
  const restoreInitial = () => {
    const err = set(`values.${resolved.id}`, null)
    setError(err)
    setConfirming(false)
    if (!err) setOpen(false)
  }
  const own = initial && !resolved.defaulted && value !== initial.text
  return (
    <>
      <HelpRow
        help={fieldHelp(def)}
        compact={compact}
        testID={`editor-${resolved.id}`}
      >
        {wrapped => (
          <Pressable
            testID={`editor-${resolved.id}`}
            accessibilityRole="button"
            {...fieldA11y(def.label, value || 'vazio')}
            accessibilityHint="Abre o editor de texto"
            onPress={() => {
              setText(value)
              setError(null)
              setConfirming(false)
              setOpen(true)
            }}
            style={
              wrapped
                ? helpRowInner
                : [
                    styles.row,
                    compact && styles.compact,
                    { borderBottomColor: colors.borderSubtle },
                  ]
            }
          >
            <View style={styles.text}>
              <Text variant="fieldLabel">{def.label}</Text>
              <Text color={value ? 'ink' : 'inkMuted'} numberOfLines={2}>
                {value || '—'}
              </Text>
              {resolved.defaulted && initial ? (
                <Text
                  variant="caption"
                  color="inkMuted"
                  testID={`default-${resolved.id}`}
                >
                  {`Resumo de ${initial.option}; edite para trocar.`}
                </Text>
              ) : null}
              {issue ? (
                <Text
                  variant="caption"
                  color="danger"
                  accessibilityRole="alert"
                >
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
        )}
      </HelpRow>
      <BottomSheet
        visible={open}
        title={def.label}
        onClose={() => setOpen(false)}
        footer={
          confirming ? (
            <>
              <Button
                title="Cancelar"
                variant="ghost"
                onPress={() => setConfirming(false)}
              />
              <Button title="Trocar" onPress={restoreInitial} />
            </>
          ) : (
            <>
              <Button
                title="Cancelar"
                variant="ghost"
                onPress={() => setOpen(false)}
              />
              <Button title="Aplicar" onPress={apply} />
            </>
          )
        }
      >
        {confirming && initial ? (
          <Text accessibilityRole="alert">
            {`Trocar o seu texto pelo resumo de ${initial.option}?`}
          </Text>
        ) : null}
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
          // T-10: no campo de uma linha, o "✓" do teclado (Enter no web)
          // aplica, como o "Digitar" (T-25); com erro, o campo fica aberto.
          // No texto longo, Enter continua sendo nova linha.
          {...(long ? {} : submitField('done', apply))}
        />
        {own && !confirming ? (
          <View style={styles.suggestions}>
            <Button
              title={`Usar o resumo de ${initial.option}`}
              variant="ghost"
              onPress={() => setConfirming(true)}
            />
          </View>
        ) : null}
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
