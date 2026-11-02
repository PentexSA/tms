import { Banner, Button, Text, tokens } from '@tms/ui'
import { randomUUID } from 'expo-crypto'
import { useRef } from 'react'
import { StyleSheet, View } from 'react-native'

import { messageOf } from '../../lib/errors'
import {
  useAcceptTransfer,
  useRejectTransfer,
} from '../../lib/queries/backstage'

// U-03: a proposta de narrar aparece para quem a recebeu, no topo da crônica
// e na lista de crônicas, e não só no Diário. Mesmas ações e mesmas chaves de
// comando; o servidor revalida o ator, a crônica e o pedido.

export function TransferOffer({
  chronicleId,
  transferId,
  chronicleName,
}: {
  readonly chronicleId: string
  readonly transferId: string
  // Na lista de crônicas, para dizer de qual crônica é a proposta
  readonly chronicleName?: string
}) {
  const accept = useAcceptTransfer(chronicleId, transferId)
  const reject = useRejectTransfer(chronicleId, transferId)
  const key = useRef<string | null>(null)
  const rejectKey = useRef<string | null>(null)
  const error = accept.error ?? reject.error
  return (
    <Banner
      tone="info"
      title={
        chronicleName
          ? `Convite para narrar ${chronicleName}`
          : 'Convite para narrar'
      }
      message="Ao aceitar, você assume NPCs, notas privadas e o histórico administrativo desta crônica."
      testID={`transfer-offer-${chronicleId}`}
      action={
        <View style={styles.actions}>
          <Button
            title="Aceitar narração"
            busy={accept.isPending}
            disabled={reject.isPending}
            onPress={() => accept.mutate((key.current ??= randomUUID()))}
          />
          <Button
            title="Recusar"
            variant="secondary"
            busy={reject.isPending}
            disabled={accept.isPending}
            onPress={() => reject.mutate((rejectKey.current ??= randomUUID()))}
          />
          {error ? (
            <Text color="danger" accessibilityRole="alert">
              {messageOf(error)}
            </Text>
          ) : null}
        </View>
      }
    />
  )
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: tokens.space[2],
  },
})
