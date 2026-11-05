import {
  type CompiledSection,
  isDraftMode,
  type SheetMode,
} from '@tms/sheet-core'
import { HelpButton, HelpText, SectionHeader, tokens, useHelp } from '@tms/ui'
import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'

// O "?" do grupo de seção (R-19): "Físicos", "Talentos", "Conhecimentos".
// Só na criação e no Editar (pergunta 8 do P10-D): em Leitura e Jogo a ficha
// fica como está. O grupo sem frase não mostra "?".

/** A frase do grupo no template, se houver e se o modo pedir ajuda. */
export function groupHelpOf(
  section: CompiledSection,
  groupId: string,
  mode: SheetMode
): string | null {
  if (!isDraftMode(mode)) return null
  return section.def.groups?.find(g => g.id === groupId)?.help ?? null
}

/** O título do grupo com o "?" e, abaixo, a frase aberta. */
export function GroupTitle({
  title,
  help,
  right,
  testID,
}: {
  readonly title: string
  readonly help: string | null
  readonly right?: ReactNode
  readonly testID?: string
}) {
  const state = useHelp()
  if (!help) return <SectionHeader title={title} level="group" right={right} />
  return (
    <View>
      <SectionHeader
        title={title}
        level="group"
        right={
          <View style={styles.right}>
            <HelpButton
              subject={title}
              expanded={state.expanded}
              onToggle={state.toggle}
              controls={state.textId}
              testID={testID}
            />
            {right}
          </View>
        }
      />
      {state.expanded ? <HelpText id={state.textId} text={help} /> : null}
    </View>
  )
}

/**
 * Com as abas por grupo no celular, a aba é um alvo só: o "?" vai no topo do
 * conteúdo da aba, não no rótulo dela.
 */
export function GroupHelpLine({
  title,
  help,
  testID,
  inset = true,
}: {
  readonly title: string
  readonly help: string | null
  readonly testID?: string
  // Sem o respiro lateral, dentro de uma coluna que já tem o seu
  readonly inset?: boolean
}) {
  const state = useHelp()
  if (!help) return null
  return (
    <View style={[styles.line, inset && styles.inset]}>
      <HelpButton
        subject={title}
        expanded={state.expanded}
        onToggle={state.toggle}
        controls={state.textId}
        testID={testID}
      />
      {state.expanded ? <HelpText id={state.textId} text={help} /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  right: { flexDirection: 'row', alignItems: 'center', gap: tokens.space[2] },
  line: { alignItems: 'flex-start', gap: tokens.space[1] },
  inset: { paddingHorizontal: tokens.layout.gutter },
})
