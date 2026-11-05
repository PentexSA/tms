import { type Help, tokens, useTheme, WithHelp } from '@tms/ui'
import type { ReactNode } from 'react'
import { StyleSheet } from 'react-native'

// A linha que é um botão só (texto e escolha em Evoluir) com o "?" da ajuda
// (R-19): [botão (flex 1)][?] e a frase aberta embaixo, na largura da linha
// (WithHelp do @tms/ui). O nome e a dica do botão da linha não mudam. Sem
// frase, a linha de hoje.
export function HelpRow({
  help,
  compact,
  testID,
  children,
}: {
  readonly help: Help | null
  readonly compact: boolean
  readonly testID?: string
  // Recebe `true` quando a borda e o respiro ficam no contorno, não no botão
  readonly children: (wrapped: boolean) => ReactNode
}) {
  const { colors } = useTheme()
  if (!help) return <>{children(false)}</>
  return (
    <WithHelp
      help={help}
      fill
      testID={testID ? `${testID}-help` : undefined}
      style={[
        styles.wrap,
        compact && styles.compact,
        { borderBottomColor: colors.borderSubtle },
      ]}
    >
      {children(true)}
    </WithHelp>
  )
}

/** O botão da linha dentro do contorno do HelpRow: sem borda nem respiro. */
export const helpRowInner = {
  flexDirection: 'row',
  alignItems: 'center',
  gap: tokens.space[3],
  minHeight: tokens.size.rowMin,
} as const

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    paddingVertical: tokens.space[2],
    paddingHorizontal: tokens.layout.gutter,
    borderBottomWidth: tokens.borderWidth.hair,
  },
  compact: { paddingHorizontal: 0, paddingVertical: tokens.space[1] },
})
