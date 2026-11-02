import { Text, tokens } from '@tms/ui'
import { StyleSheet, View } from 'react-native'

/**
 * O corpo das confirmações de concluir e aprovar (T-32): o texto do
 * `completionCopy` e as linhas extras (`notes`), como a sobra de bônus que o
 * P05-C (T-18) põe nos três caminhos.
 */
export function CompletionMessage({
  body,
  notes = [],
  suffix = '',
}: {
  readonly body: string
  readonly notes?: readonly string[]
  // Complemento na mesma frase ("As alterações abaixo são salvas antes.")
  readonly suffix?: string
}) {
  return (
    <View style={styles.gap} testID="completion-message">
      <Text color="inkMuted">
        {body}
        {suffix}
      </Text>
      {notes.map(note => (
        <Text key={note} color="inkMuted">
          {note}
        </Text>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({ gap: { gap: tokens.space[1] } })
