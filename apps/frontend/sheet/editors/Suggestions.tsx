import { BottomSheet, Button, Chip, tokens, WithHelp } from '@tms/ui'
import { useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { nameHelp } from '../evolve/help'
import { byLabel, fold } from '../evolve/text'

// As sugestões de um campo de texto (`suggestions` do template, como os
// Arquétipos do livro para Natureza e Comportamento): um toque preenche o
// campo. O texto continua livre; a lista só poupa a digitação.

/**
 * Os chips das sugestões. Com um texto que ainda não é uma delas, mostra só as
 * que o contêm (sem acento nem caixa); vazio ou já escolhido, mostra todas.
 */
export function SuggestionChips({
  options,
  value,
  onPick,
  help,
  testID,
}: {
  readonly options: readonly string[]
  readonly value: string
  readonly onPick: (option: string) => void
  // A frase por sugestão (R-19): o "?" vai junto do chip que tem frase
  readonly help?: Readonly<Record<string, string>>
  readonly testID?: string
}) {
  const query = fold(value)
  // Na ordem do rótulo, não na do array do template (T-60)
  const sorted = useMemo(() => byLabel(options), [options])
  const exact = sorted.some(o => fold(o) === query)
  const shown =
    query && !exact ? sorted.filter(o => fold(o).includes(query)) : sorted
  // A frase de cada sugestão, calculada uma vez por lista
  const helps = useMemo(
    () => new Map(options.map(o => [o, nameHelp(help, o)] as const)),
    [options, help]
  )
  if (!shown.length) return null
  // Os chips continuam quebrando linha; só a sugestão com frase leva o "?"
  // junto do chip ([chip][?]), com a frase aberta logo abaixo dela
  return (
    <View style={styles.chips} testID={testID}>
      {shown.map(o => {
        const chip = (
          <Chip
            key={o}
            label={o}
            selected={fold(o) === query}
            onPress={() => onPick(o)}
          />
        )
        const h = helps.get(o)
        return h ? (
          <WithHelp key={o} help={h} style={styles.withHelp}>
            {chip}
          </WithHelp>
        ) : (
          chip
        )
      })}
    </View>
  )
}

/** "Escolher da lista": abre as sugestões num sheet (formulário de criação). */
export function SuggestionPicker({
  label,
  options,
  value,
  onPick,
  help,
  testID,
}: {
  readonly label: string
  readonly options: readonly string[]
  readonly value: string
  readonly onPick: (option: string) => void
  readonly help?: Readonly<Record<string, string>>
  readonly testID?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <View style={styles.open}>
        <Button
          title="Escolher da lista"
          // Dois na tela (Natureza e Comportamento): o nome diz qual
          accessibilityLabel={`Escolher da lista: ${label}`}
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
          help={help}
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
  withHelp: { maxWidth: '100%' },
  open: { alignItems: 'flex-start' },
})
