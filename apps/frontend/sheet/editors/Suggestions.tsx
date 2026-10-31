import { BottomSheet, Button, Chip, tokens } from '@tms/ui'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

// As sugestões de um campo de texto (`suggestions` do template, como os
// Arquétipos do livro para Natureza e Comportamento): um toque preenche o
// campo. O texto continua livre; a lista só poupa a digitação.

const fold = (v: string) =>
  v
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

/**
 * Os chips das sugestões. Com um texto que ainda não é uma delas, mostra só as
 * que o contêm (sem acento nem caixa); vazio ou já escolhido, mostra todas.
 */
export function SuggestionChips({
  options,
  value,
  onPick,
  testID,
}: {
  readonly options: readonly string[]
  readonly value: string
  readonly onPick: (option: string) => void
  readonly testID?: string
}) {
  const query = fold(value)
  const exact = options.some(o => fold(o) === query)
  const shown =
    query && !exact ? options.filter(o => fold(o).includes(query)) : options
  if (!shown.length) return null
  return (
    <View style={styles.chips} testID={testID}>
      {shown.map(o => (
        <Chip
          key={o}
          label={o}
          selected={fold(o) === query}
          onPress={() => onPick(o)}
        />
      ))}
    </View>
  )
}

/** "Escolher da lista": abre as sugestões num sheet (formulário de criação). */
export function SuggestionPicker({
  label,
  options,
  value,
  onPick,
  testID,
}: {
  readonly label: string
  readonly options: readonly string[]
  readonly value: string
  readonly onPick: (option: string) => void
  readonly testID?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <View style={styles.open}>
        <Button
          title="Escolher da lista"
          variant="ghost"
          accessibilityHint={`Abre a lista de ${label}`}
          testID={testID}
          onPress={() => setOpen(true)}
        />
      </View>
      <BottomSheet visible={open} title={label} onClose={() => setOpen(false)}>
        <SuggestionChips
          options={options}
          // A lista inteira, com a escolha atual marcada
          value={options.some(o => fold(o) === fold(value)) ? value : ''}
          onPick={o => {
            onPick(o)
            setOpen(false)
          }}
          testID={testID ? `${testID}-list` : undefined}
        />
      </BottomSheet>
    </>
  )
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space[2] },
  open: { alignItems: 'flex-start' },
})
