import {
  canRead,
  describe,
  type FieldId,
  plain,
  revealableSections,
} from '@tms/sheet-core'
import { Text, tokens } from '@tms/ui'
import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import { useFieldEntry, useSheet } from '../context'
import { drawsEditor, FieldSlot } from '../FieldSlot'
import {
  barEdits,
  hiddenFromOwner,
  inRevealed,
  PRIVATE_NOTE,
  PRIVATE_NOTE_A11Y,
  REVEALED_BY_STORYTELLER,
  REVEALED_FAILED,
  REVEALED_OFFLINE,
  revealedNote,
  revealedNoteA11y,
} from '../storyteller/privacy'
import { RevealControl } from '../storyteller/RevealControl'
import { useRevealed } from '../storyteller/revealed'
import type { LayoutProps } from './types'

// Blocos de texto (Sobre, Notas do Narrador). O campo da voz do personagem
// (identity.voice) vira citação na fonte de voz da skin. Sempre <Text>: o
// conteúdo é do jogador e nunca é interpretado como HTML. No Editar e na
// Criação, o texto que o papel escreve vira o editor (T-84), pela mesma
// regra dos outros layouts; o que só o narrador escreve fica com a barra
// dele (`barEdits`).
export function TextLayout({ section }: LayoutProps) {
  const { model } = useSheet()
  const revealable = revealableSections(model).includes(section.id)
  return (
    <View style={styles.blocks}>
      {section.fieldIds.map(id => (
        <TextBlock key={id} id={id} />
      ))}
      {/* U-11 (P16-D): revelar ou esconder, só para o narrador */}
      {revealable ? <RevealControl sectionId={section.id} /> : null}
    </View>
  )
}

function TextBlock({ id }: { readonly id: FieldId }) {
  const { model, roles, mode } = useSheet()
  const reveal = useRevealed()
  const entry = useFieldEntry(id)
  // U-11: o dono não lê o campo pelos papéis, mas o narrador o revelou: o
  // texto vem da rota própria, só em leitura
  if (!canRead(model, id, roles))
    return reveal && inRevealed(model, id, reveal.sections) ? (
      <RevealedBlock id={id} />
    ) : null
  if (!entry) return null
  if (drawsEditor(model, roles, id, mode) && !barEdits(model, id))
    return <FieldSlot id={id} variant="row" />
  const { resolved: r, sheet } = entry
  const voice = id === model.template.identity.voice
  const text = plain(r, sheet)
  // R-09: o campo que só o narrador lê diz que é privado (só quem o lê vê o
  // bloco; o servidor nunca o manda ao dono). U-11: revelado, diz quem lê
  const secret = roles.has('storyteller') && hiddenFromOwner(model, id)
  const shown =
    secret && reveal ? inRevealed(model, id, reveal.sections) : false
  const owner = reveal?.ownerName ?? ''
  const caption = shown
    ? `${r.field.def.label} · ${revealedNote(owner)}`
    : secret
      ? `${r.field.def.label} · ${PRIVATE_NOTE}`
      : r.field.def.label
  return (
    <View
      accessible
      accessibilityLabel={
        shown
          ? `${describe(r, sheet)}. ${revealedNoteA11y(owner)}`
          : secret
            ? `${describe(r, sheet)}. ${PRIVATE_NOTE_A11Y}`
            : describe(r, sheet)
      }
      style={styles.block}
    >
      <Text variant="caption" color="inkMuted">
        {caption}
      </Text>
      {text ? (
        <Text variant={voice ? 'voice' : 'body'}>
          {voice ? `“${text}”` : text}
        </Text>
      ) : (
        <Text color="inkMuted">{'—'}</Text>
      )}
    </View>
  )
}

/** A nota revelada ao dono: só leitura, sem editor nem botão (U-11). */
function RevealedBlock({ id }: { readonly id: FieldId }) {
  const { model } = useSheet()
  const reveal = useRevealed()
  // Ao aparecer (abrir o "Sobre", voltar a ele): a rota de novo, para a nota
  // que o narrador deixou privada sair na hora, sem esperar os 30 s
  const refresh = reveal?.refresh
  useEffect(() => {
    refresh?.()
  }, [refresh])
  const label = model.fields.get(id)?.def.label ?? ''
  const text = reveal?.values.get(id)
  const status = reveal?.status ?? 'idle'
  const body =
    status === 'ready'
      ? text || null
      : status === 'offline'
        ? REVEALED_OFFLINE
        : status === 'error'
          ? REVEALED_FAILED
          : null
  const caption = `${label} · ${REVEALED_BY_STORYTELLER}`
  const a11y =
    status === 'ready'
      ? `${label}, ${REVEALED_BY_STORYTELLER}: ${text || 'vazio'}`
      : `${label}, ${REVEALED_BY_STORYTELLER}: ${body ?? 'carregando'}`
  return (
    <View
      accessible
      accessibilityLabel={a11y}
      style={styles.block}
      testID={`revealed-${id}`}
    >
      <Text variant="caption" color="inkMuted">
        {caption}
      </Text>
      {status === 'ready' && text ? (
        <Text variant="body">{text}</Text>
      ) : (
        <Text color="inkMuted">{body ?? (status === 'ready' ? '—' : '…')}</Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  blocks: { gap: tokens.space[4], paddingHorizontal: tokens.layout.gutter },
  block: { gap: tokens.space[1] },
})
