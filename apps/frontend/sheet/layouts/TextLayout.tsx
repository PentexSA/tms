import { describe, plain } from '@tms/sheet-core'
import { Text, tokens } from '@tms/ui'
import { StyleSheet, View } from 'react-native'
import { useSheet } from '../context'
import type { LayoutProps } from './types'

// Blocos de texto (Sobre, Notas do Narrador). O campo da voz do personagem
// (identity.voice) vira citação na fonte de voz da skin. Sempre <Text>: o
// conteúdo é do jogador e nunca é interpretado como HTML.
export function TextLayout({ section }: LayoutProps) {
  const { model, resolved } = useSheet()
  const voice = model.template.identity.voice
  return (
    <View style={styles.blocks}>
      {section.fieldIds.map(id => {
        const r = resolved.get(id)
        if (!r) return null
        const text = plain(r, resolved)
        return (
          <View
            key={id}
            accessible
            accessibilityLabel={describe(r, resolved)}
            style={styles.block}
          >
            <Text variant="caption" color="inkMuted">
              {r.field.def.label}
            </Text>
            {text ? (
              <Text variant={id === voice ? 'voice' : 'body'}>
                {id === voice ? `“${text}”` : text}
              </Text>
            ) : (
              <Text color="inkMuted">{'—'}</Text>
            )}
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  blocks: { gap: tokens.space[4], paddingHorizontal: tokens.layout.gutter },
  block: { gap: tokens.space[1] },
})
