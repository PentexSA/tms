import { xpLedgerFields } from '@tms/sheet-core'
import { BottomSheet, Skeleton, Text, tokens, useToast } from '@tms/ui'
import { StyleSheet, View } from 'react-native'
import { messageOf } from '../../lib/errors'
import { useChronicleXpRequests, useXpCommands } from '../../lib/queries/xp'
import { RequestRow } from '../../sheet/xp/ExperienceSheet'
import { GrantForm } from '../../sheet/xp/forms'
import type { TableItem } from './tableItems'

// A Mesa e o XP (doc/plano-v4.md, Etapa 8): conceder às fichas selecionadas,
// numa operação atômica (tudo ou nada), e decidir os pedidos pendentes da
// crônica sem abrir ficha por ficha.

/** Só fichas cujo sistema tem extrato recebem XP. */
export const grantable = (items: readonly TableItem[]) =>
  items.length > 0 &&
  items.every(i => i.model && xpLedgerFields(i.model).length > 0)

export function GrantXpSheet({
  chronicleId,
  items,
  onClose,
}: {
  readonly chronicleId: string
  readonly items: readonly TableItem[]
  readonly onClose: () => void
}) {
  const toast = useToast()
  const commands = useXpCommands()
  return (
    <BottomSheet
      visible
      title="Conceder XP"
      onClose={onClose}
      testID="xp-grant-sheet"
    >
      <View style={styles.content}>
        <Text color="inkMuted">
          {items.length} {items.length === 1 ? 'personagem' : 'personagens'}:
          cada ficha recebe o crédito uma vez, ou nenhuma recebe.
        </Text>
        {items.map(i => (
          <Text key={i.row.id}>{i.row.name}</Text>
        ))}
        <GrantForm
          chronicleId={chronicleId}
          characterIds={items.map(i => i.row.id)}
          commands={commands}
          onDone={result => {
            const characters =
              (result as { characters?: { balance?: { total?: number } }[] })
                ?.characters ?? []
            onClose()
            toast.show({
              message: `XP concedido a ${characters.length} ${characters.length === 1 ? 'personagem' : 'personagens'}.`,
            })
          }}
        />
      </View>
    </BottomSheet>
  )
}

export function XpRequestsSheet({
  chronicleId,
  onClose,
}: {
  readonly chronicleId: string
  readonly onClose: () => void
}) {
  const requests = useChronicleXpRequests(chronicleId)
  const commands = useXpCommands()
  return (
    <BottomSheet
      visible
      title="Pedidos de XP"
      onClose={onClose}
      testID="xp-requests-sheet"
    >
      <View style={styles.content}>
        {requests.isPending ? (
          <Skeleton lines={2} label="Carregando os pedidos" />
        ) : requests.isError ? (
          <Text color="danger">{messageOf(requests.error)}</Text>
        ) : requests.data?.length ? (
          requests.data.map(r => (
            <View key={r.id} style={styles.content}>
              <Text variant="fieldLabel">{r.characterName}</Text>
              <RequestRow
                request={r}
                chronicleId={chronicleId}
                owner={false}
                storyteller
                member
                commands={commands}
              />
            </View>
          ))
        ) : (
          <Text color="inkMuted">Nenhum pedido pendente.</Text>
        )}
      </View>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  content: { gap: tokens.space[2] },
})
