import { BottomSheet, Button, Text, tokens } from '@tms/ui'
import { StyleSheet, View } from 'react-native'

// U-11 (P16-D): revelar as Notas do Narrador ao dono pede confirmação, com o
// texto que vai ser revelado à vista, para o narrador conferir se não ficou
// segredo nele. A revelação é viva: o dono lê também o que for salvo depois.
// O servidor continua a autoridade: a folha só pergunta antes de enviar.

export const revealNotesCopy = (owner: string, label: string) => ({
  title: `Revelar as ${label} a ${owner}?`,
  body: `${owner} passa a ler estas notas inteiras, só em leitura, e também o que você salvar nelas enquanto estiverem reveladas. Quem já leu continua sabendo, mesmo que você volte a deixá-las privadas.`,
  empty: `As notas estão vazias: ${owner} lê o que você escrever depois.`,
  confirm: 'Revelar notas',
  done: `Notas reveladas a ${owner}, só leitura.`,
})

export function RevealNotesSheet({
  visible,
  owner,
  label,
  text,
  busy,
  error,
  onConfirm,
  onClose,
  onClosed,
}: {
  readonly visible: boolean
  readonly owner: string
  readonly label: string
  // O texto atual das notas, que o narrador confere antes de revelar
  readonly text: string
  readonly busy: boolean
  // O erro do envio (inclusive o 409 da revisão velha) aparece aqui dentro
  readonly error: string | null
  readonly onConfirm: () => void
  readonly onClose: () => void
  // Depois da animação de saída: o toast sai aqui, para não ficar atrás do
  // Modal (lição do QAA-24)
  readonly onClosed: () => void
}) {
  const copy = revealNotesCopy(owner, label)
  return (
    <BottomSheet
      visible={visible}
      title={copy.title}
      onClose={onClose}
      onClosed={onClosed}
      testID="reveal-notes-sheet"
      footer={
        <>
          <Button
            title="Cancelar"
            variant="ghost"
            disabled={busy}
            onPress={onClose}
          />
          <Button
            title={copy.confirm}
            busy={busy}
            disabled={busy}
            onPress={onConfirm}
          />
        </>
      }
    >
      <View style={styles.body}>
        <Text>{copy.body}</Text>
        {/* Sempre <Text>: a nota nunca é interpretada como HTML */}
        <View style={styles.quote} testID="reveal-notes-text">
          {text ? (
            <Text>{text}</Text>
          ) : (
            <Text color="inkMuted">{copy.empty}</Text>
          )}
        </View>
        {error ? (
          <Text color="danger" accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
      </View>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  body: { gap: tokens.space[3] },
  quote: { gap: tokens.space[1] },
})
