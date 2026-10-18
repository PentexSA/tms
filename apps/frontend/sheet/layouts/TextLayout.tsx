import { describe, type FieldId, plain } from '@tms/sheet-core'
import { Text, tokens } from '@tms/ui'
import { StyleSheet, View } from 'react-native'
import { useFieldEntry, useSheet } from '../context'
import type { LayoutProps } from './types'

// Blocos de texto (Sobre, Notas do Narrador). O campo da voz do personagem
// (identity.voice) vira citação na fonte de voz da skin. Sempre <Text>: o
// conteúdo é do jogador e nunca é interpretado como HTML.
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
  const { model } = useSheet()
  const entry = useFieldEntry(id)
  if (!entry) return null
  const { resolved: r, sheet } = entry
  const voice = id === model.template.identity.voice
  const text = plain(r, sheet)
  return (
    <View
      accessible
      accessibilityLabel={describe(r, sheet)}
      style={styles.block}
    >
      <Text variant="caption" color="inkMuted">
        {r.field.def.label}
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
