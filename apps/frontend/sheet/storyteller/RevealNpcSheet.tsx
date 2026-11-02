import { BottomSheet, Button, Text, tokens } from '@tms/ui'
import { StyleSheet, View } from 'react-native'

// T-46: revelar o NPC pede confirmação, e o texto diz que quem já viu
// continua sabendo. Descer (revelar menos) envia direto. O servidor continua
// a autoridade: a folha só pergunta antes de enviar.

export type NpcVisibility = 'hidden' | 'identity' | 'full'
export type Reveal = Exclude<NpcVisibility, 'hidden'>

// Ordem do sigilo: oculto < identidade < ficha
const LEVEL: Record<NpcVisibility, number> = { hidden: 0, identity: 1, full: 2 }

/**
 * A visibilidade que a API manda (texto). Valor desconhecido conta como
 * oculto: qualquer troca a partir dele pede confirmação (fail secure).
 */
export const npcVisibilityOf = (value: string | null | undefined) =>
  value === 'identity' || value === 'full' ? value : ('hidden' as const)

/** Subir na ordem (revelar mais) pede confirmação; descer, não. */
export const revealsMore = (
  from: NpcVisibility,
  to: NpcVisibility
): to is Reveal => LEVEL[to] > LEVEL[from]

const ALREADY_SEEN =
  'Quem já viu continua sabendo, mesmo que você volte a Oculto.'

export const REVEAL_COPY: Record<
  Reveal,
  {
    readonly title: string
    readonly body: (name: string) => string
    readonly confirm: string
    readonly done: string
  }
> = {
  identity: {
    title: 'Revelar a identidade para os jogadores?',
    body: name =>
      `Os jogadores passam a ver o nome, o selo, o subtítulo e o retrato de ${name}. ${ALREADY_SEEN}`,
    confirm: 'Revelar identidade',
    done: 'Identidade revelada aos jogadores.',
  },
  full: {
    title: 'Revelar a ficha para os jogadores?',
    body: name =>
      `Os jogadores passam a abrir uma cópia só de leitura de ${name}, sem as Notas do Narrador. ${ALREADY_SEEN}`,
    confirm: 'Revelar ficha',
    done: 'Ficha revelada aos jogadores, só leitura.',
  },
}

/** O aviso depois de revelar menos (sem folha). */
export const lowerDone = (to: NpcVisibility, name: string) =>
  to === 'identity'
    ? 'Agora os jogadores veem só a identidade. Quem já abriu a ficha continua sabendo.'
    : `${name} voltou a ficar oculto. Quem já viu continua sabendo.`

export function RevealNpcSheet({
  visible,
  target,
  name,
  busy,
  error,
  onConfirm,
  onClose,
  onClosed,
}: {
  readonly visible: boolean
  readonly target: Reveal
  readonly name: string
  readonly busy: boolean
  // O erro do envio aparece dentro da folha (inclusive o 409 da revisão
  // velha, do cache restaurado): nada é revelado sobre dado velho
  readonly error: string | null
  readonly onConfirm: () => void
  readonly onClose: () => void
  // Depois da animação de saída: o toast sai aqui, para não ficar atrás do
  // Modal (lição do QAA-24)
  readonly onClosed: () => void
}) {
  const copy = REVEAL_COPY[target]
  return (
    <BottomSheet
      visible={visible}
      title={copy.title}
      onClose={onClose}
      onClosed={onClosed}
      testID="reveal-npc-sheet"
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
        <Text>{copy.body(name)}</Text>
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
  body: { gap: tokens.space[2] },
})
