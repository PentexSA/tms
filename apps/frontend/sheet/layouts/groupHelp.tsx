import { type Help, SectionHeader, tokens, WithHelp } from '@tms/ui'
import type { ReactNode } from 'react'
import { StyleSheet } from 'react-native'
import { AnchorHeader } from './AnchorHeader'
import type { AnchorTarget } from './anchor'

// O "?" do grupo de seção (R-19): "Físicos", "Talentos", "Conhecimentos".
// A frase vem do `help` do CompiledGroup e, no bloco que o título nomeia
// (T-58), também da lista. Só na criação e no Editar (pergunta 8 do P10-D):
// em Leitura e Jogo a ficha fica como está. Sem frase, sem "?".

/**
 * A ajuda de um bloco: a frase do grupo e a da lista que ele nomeia. Com as
 * duas, um "?" só mostra as duas, a do grupo primeiro; a repetida sai.
 */
export function blockHelp(
  subject: string,
  group: string | null | undefined,
  list: string | null | undefined
): Help | null {
  const texts = [group, list].filter((t): t is string => Boolean(t))
  const unique = [...new Set(texts)]
  return unique.length ? { subject, text: unique.join(' ') } : null
}

/**
 * O título do grupo com o "?" ao fim da linha e, abaixo, a frase aberta. Com
 * `target`, o título é a âncora do "ir ao grupo" (P05-D), com o foco no texto.
 */
export function GroupTitle({
  title,
  help,
  right,
  target,
  testID,
}: {
  readonly title: string
  readonly help: Help | null
  readonly right?: ReactNode
  readonly target?: AnchorTarget
  readonly testID?: string
}) {
  return (
    <WithHelp help={help} fill testID={testID}>
      {target ? (
        <AnchorHeader
          title={title}
          level="group"
          right={right}
          target={target}
        />
      ) : (
        <SectionHeader title={title} level="group" right={right} />
      )}
    </WithHelp>
  )
}

/**
 * Com as abas por grupo no celular, a aba é um alvo só: o "?" vai no topo do
 * conteúdo da aba, não no rótulo dela. Também é o "?" logo abaixo do título
 * da seção, quando ele já nomeia o bloco.
 */
export function GroupHelpLine({
  help,
  testID,
  inset = true,
}: {
  readonly help: Help | null
  readonly testID?: string
  // Sem o respiro lateral, dentro de uma coluna que já tem o seu
  readonly inset?: boolean
}) {
  return (
    <WithHelp
      help={help}
      testID={testID}
      style={inset ? styles.inset : undefined}
    />
  )
}

const styles = StyleSheet.create({
  inset: { paddingHorizontal: tokens.layout.gutter },
})
