import { HelpButton, HelpText, tokens, useHelp, useTheme } from '@tms/ui'
import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import type { FieldHelp } from './EditorShell'

// A linha que é um botão só (texto e escolha em Evoluir) com o "?" da ajuda
// (R-19). O "?" não pode ficar dentro do botão da linha: a linha vira
// [botão (flex 1)][?], e a frase aberta fica embaixo, na largura da linha. O
// nome e a dica do botão da linha não mudam. Sem frase, a linha de hoje.
export function HelpRow({
  help,
  compact,
  testID,
  children,
}: {
  readonly help: FieldHelp | null
  readonly compact: boolean
  readonly testID?: string
  // Recebe `true` quando a borda e o respiro ficam no contorno, não no botão
  readonly children: (wrapped: boolean) => ReactNode
}) {
  const { colors } = useTheme()
  const state = useHelp()
  if (!help) return <>{children(false)}</>
  return (
    <View
      style={[
        styles.wrap,
        compact && styles.compact,
        { borderBottomColor: colors.borderSubtle },
      ]}
    >
      <View style={styles.row}>
        {children(true)}
        <HelpButton
          subject={help.subject}
          expanded={state.expanded}
          onToggle={state.toggle}
          controls={state.textId}
          testID={testID ? `${testID}-help` : undefined}
        />
      </View>
      {state.expanded ? <HelpText id={state.textId} text={help.text} /> : null}
    </View>
  )
}

/** O botão da linha dentro do contorno do HelpRow: sem borda nem respiro. */
export const helpRowInner = {
  flex: 1,
  flexDirection: 'row',
  alignItems: 'center',
  gap: tokens.space[3],
  minHeight: tokens.size.rowMin,
} as const

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    gap: tokens.space[1],
    paddingVertical: tokens.space[2],
    paddingHorizontal: tokens.layout.gutter,
    borderBottomWidth: tokens.borderWidth.hair,
  },
  compact: { paddingHorizontal: 0, paddingVertical: tokens.space[1] },
  row: { flexDirection: 'row', alignItems: 'center', gap: tokens.space[1] },
})
