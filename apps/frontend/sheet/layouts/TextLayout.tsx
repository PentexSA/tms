import { describe, type FieldId, plain } from '@tms/sheet-core'
import { Text, tokens } from '@tms/ui'
import { StyleSheet, View } from 'react-native'
import { useFieldEntry, useSheet } from '../context'
import { drawsEditor, FieldSlot } from '../FieldSlot'
import {
  barEdits,
  hiddenFromOwner,
  PRIVATE_NOTE,
  PRIVATE_NOTE_A11Y,
} from '../storyteller/privacy'
import type { LayoutProps } from './types'

// Blocos de texto (Sobre, Notas do Narrador). O campo da voz do personagem
// (identity.voice) vira citação na fonte de voz da skin. Sempre <Text>: o
// conteúdo é do jogador e nunca é interpretado como HTML. No Editar e na
// Criação, o texto que o papel escreve vira o editor (T-84), pela mesma
// regra dos outros layouts; o que só o narrador escreve fica com a barra
// dele (`barEdits`).
export function TextLayout({ section }: LayoutProps) {
  return (
    <View style={styles.blocks}>
      {section.fieldIds.map(id => (
        <TextBlock key={id} id={id} />
      ))}
    </View>
  )
}

function TextBlock({ id }: { readonly id: FieldId }) {
  const { model, roles, mode } = useSheet()
  const entry = useFieldEntry(id)
  if (!entry) return null
  if (drawsEditor(model, roles, id, mode) && !barEdits(model, id))
    return <FieldSlot id={id} variant="row" />
  const { resolved: r, sheet } = entry
  const voice = id === model.template.identity.voice
  const text = plain(r, sheet)
  // R-09: o campo que só o narrador lê diz que é privado (só quem o lê vê o
  // bloco; o servidor nunca o manda ao dono)
  const secret = roles.has('storyteller') && hiddenFromOwner(model, id)
  const caption = secret
    ? `${r.field.def.label} · ${PRIVATE_NOTE}`
    : r.field.def.label
  return (
    <View
      accessible
      accessibilityLabel={
        secret
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

const styles = StyleSheet.create({
  blocks: { gap: tokens.space[4], paddingHorizontal: tokens.layout.gutter },
  block: { gap: tokens.space[1] },
})
