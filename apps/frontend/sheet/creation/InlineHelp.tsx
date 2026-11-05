import { HelpButton, HelpText, tokens, useHelp } from '@tms/ui'
import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'

// Um rótulo do app com o "?" ao lado e a frase aberta embaixo (R-19):
// "Prioridade" no contador do grupo e o saldo dos pontos de bônus na aba.
export function InlineHelp({
  subject,
  text,
  testID,
  narrow,
  children,
}: {
  readonly subject: string
  readonly text: string
  readonly testID?: string
  // Ao lado de um título (o contador do grupo): a frase não espreme o título
  readonly narrow?: boolean
  readonly children: ReactNode
}) {
  const { expanded, toggle, textId } = useHelp()
  return (
    <View style={[styles.wrap, narrow && styles.narrow]}>
      <View style={styles.row}>
        <View style={styles.label}>{children}</View>
        <HelpButton
          subject={subject}
          expanded={expanded}
          onToggle={toggle}
          controls={textId}
          testID={testID}
        />
      </View>
      {expanded ? <HelpText id={textId} text={text} /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: tokens.space[1], flexShrink: 1 },
  narrow: { maxWidth: 220, alignItems: 'flex-end' },
  row: { flexDirection: 'row', alignItems: 'center', gap: tokens.space[1] },
  label: { flexShrink: 1 },
})
