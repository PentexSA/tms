import { Button, Text, tokens } from '@tms/ui'
import { StyleSheet, View } from 'react-native'
import { useSheet } from '../context'
import { blockedBy, useLifecycle } from '../policy'
import { useXpShortcut, type XpShortcutTarget } from '../xp/XpShortcut'

// U-01: a nota do editor bloqueado pela política. Quando o bloqueio é o da
// evolução depois da criação ("Peça ao narrador.") e a ficha oferece o
// pedido, a nota ganha o atalho "Solicitar evolução", que abre a Experiência
// com o traço escolhido. Fora disso, só a frase, como antes.

export function BlockedNote({
  text,
  to,
  subject,
}: {
  readonly text: string
  // Sem alvo (a nota não é da evolução), só a frase
  readonly to: XpShortcutTarget | null
  // O nome do traço ou da lista, para o nome acessível do atalho
  readonly subject: string
}) {
  const { roles } = useSheet()
  const lifecycle = useLifecycle()
  const shortcut = useXpShortcut()
  const offered =
    shortcut !== null &&
    to !== null &&
    blockedBy(roles, lifecycle, 'advance') === 'NEEDS_XP_APPROVAL' &&
    shortcut.offers(to)
  return (
    <View style={styles.row}>
      <Text variant="caption" color="inkMuted" numberOfLines={2}>
        {text}
      </Text>
      {offered ? (
        <Button
          title="Solicitar evolução"
          variant="ghost"
          // Começa pelo texto visível (WCAG 2.5.3)
          accessibilityLabel={`Solicitar evolução de ${subject}`}
          testID="xp-shortcut"
          onPress={() => shortcut.open(to)}
        />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: tokens.space[2],
  },
})
