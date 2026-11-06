import { plain } from '@tms/sheet-core'
import { Button, Text, tokens, useToast } from '@tms/ui'
import { useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { useCommandKey } from '../../lib/commandKey'
import { messageOf } from '../../lib/errors'
import { useOnline } from '../../lib/network'
import { useSetReveal } from '../../lib/queries/reveal'
import { useSheet, useSheetSelector } from '../context'
import { REVEAL_OFFLINE } from './privacy'
import { RevealNotesSheet, revealNotesCopy } from './RevealNotesSheet'
import { type RevealedValue, useRevealed } from './revealed'

// U-11 (P16-D): no fim do bloco das notas, na aba "Sobre", o narrador revela
// as notas ao dono (com confirmação) ou as deixa privadas de novo (direto,
// como descer a visibilidade do NPC). Só com rede; nunca na fila offline.

export const HIDE_DONE =
  'As notas voltaram a ser privadas. Quem já leu continua sabendo.'

export function RevealControl({ sectionId }: { readonly sectionId: string }) {
  // Fora de uma ficha viva (projeção do viewer, testes da folha): nada
  const reveal = useRevealed()
  if (!reveal?.narrator) return null
  return <NarratorReveal sectionId={sectionId} reveal={reveal} />
}

function NarratorReveal({
  sectionId,
  reveal,
}: {
  readonly sectionId: string
  readonly reveal: RevealedValue
}) {
  const { model } = useSheet()
  const toast = useToast()
  const online = useOnline()
  const change = useSetReveal(reveal.characterId)
  // Uma chave por intenção: revelar e esconder são pedidos diferentes
  const revealKey = useCommandKey()
  const hideKey = useCommandKey()
  const [confirm, setConfirm] = useState<'open' | 'closing' | null>(null)
  const [offline, setOffline] = useState(false)
  const done = useRef<string | null>(null)
  const section = model.sections.get(sectionId)
  const fieldIds = section?.fieldIds ?? []
  // O texto que o narrador confere antes de revelar (o que está salvo)
  const text = useSheetSelector(s =>
    fieldIds
      .map(id => {
        const r = s.entries.get(id)
        return r ? plain(r.resolved, r.sheet) : ''
      })
      .filter(Boolean)
      .join('\n\n')
  )
  if (!section) return null
  const owner = reveal.ownerName
  const label =
    model.fields.get(fieldIds[0] ?? '')?.def.label ?? section.def.title
  const revealed = reveal.sections.has(sectionId)
  const copy = revealNotesCopy(owner, label)

  const send = (to: boolean, onDone: () => void) => {
    const key = to ? revealKey : hideKey
    change.mutate(
      {
        clientCommandId: key.current(),
        section: sectionId,
        revealed: to,
        revision: reveal.revision,
      },
      {
        onSuccess: () => {
          key.settle(null)
          onDone()
        },
        onError: error => key.settle(error),
      }
    )
  }
  const press = () => {
    if (!online) {
      setOffline(true)
      return
    }
    setOffline(false)
    change.reset()
    if (revealed) send(false, () => toast.show({ message: HIDE_DONE }))
    else setConfirm('open')
  }
  return (
    <View style={styles.control}>
      <Button
        title={revealed ? 'Deixar privadas' : 'Revelar ao jogador'}
        variant="secondary"
        busy={change.isPending && confirm === null}
        // O nome começa pelo texto visível (WCAG 2.5.3) e diz o quê e a quem
        accessibilityLabel={
          revealed
            ? `Deixar privadas: ${label}, de novo só do narrador`
            : `Revelar ao jogador: ${label} a ${owner}`
        }
        testID="reveal-notes"
        onPress={press}
      />
      {offline && !online ? (
        <Text color="inkMuted" accessibilityRole="alert">
          {REVEAL_OFFLINE}
        </Text>
      ) : null}
      {change.isError && confirm === null ? (
        <Text color="danger" accessibilityRole="alert">
          {messageOf(change.error)}
        </Text>
      ) : null}
      {confirm ? (
        <RevealNotesSheet
          visible={confirm === 'open'}
          owner={owner}
          label={label}
          text={text}
          busy={change.isPending}
          error={change.isError ? messageOf(change.error) : null}
          onConfirm={() => {
            // Já revelada (a ficha rebuscada diz): fecha sem enviar
            if (reveal.sections.has(sectionId)) {
              setConfirm('closing')
              return
            }
            send(true, () => {
              done.current = copy.done
              setConfirm('closing')
            })
          }}
          // Com o envio em curso, fechar não desfaria a revelação: espera
          onClose={() => {
            if (!change.isPending) setConfirm('closing')
          }}
          onClosed={() => {
            setConfirm(null)
            change.reset()
            const message = done.current
            done.current = null
            if (message) toast.show({ message })
          }}
        />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  control: { gap: tokens.space[2], alignItems: 'flex-start' },
})
