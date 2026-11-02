import { useQueryClient } from '@tanstack/react-query'
import { Banner, Button, Text, tokens } from '@tms/ui'
import { randomUUID } from 'expo-crypto'
import { useRef } from 'react'
import { StyleSheet, View } from 'react-native'

import { messageOf, statusOf } from '../../lib/errors'
import {
  backstageKeys,
  useAcceptTransfer,
  useRejectTransfer,
} from '../../lib/queries/backstage'
import { chronicleKeys } from '../../lib/queries/chronicles'

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
  const queryClient = useQueryClient()
  const accept = useAcceptTransfer(chronicleId, transferId)
  const reject = useRejectTransfer(chronicleId, transferId)
  const key = useRef<string | null>(null)
  const rejectKey = useRef<string | null>(null)
  const error = accept.error ?? reject.error
  // A proposta que o servidor recusou (vencida, cancelada ou decidida noutro
  // lugar) não fica na tela com os botões: rebusca a proposta e a lista. Sem
  // resposta (rede), a chave continua para o reenvio
  const failed = (failure: unknown) => {
    if (!statusOf(failure)) return
    key.current = null
    rejectKey.current = null
    void queryClient.invalidateQueries({
      queryKey: backstageKeys.transfer(chronicleId),
    })
    void queryClient.invalidateQueries({
      queryKey: chronicleKeys.all,
      exact: true,
    })
  }
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
            onPress={() =>
              accept.mutate((key.current ??= randomUUID()), {
                onError: failed,
              })
            }
          />
          <Button
            title="Recusar"
            variant="secondary"
            busy={reject.isPending}
            disabled={accept.isPending}
            onPress={() =>
              reject.mutate((rejectKey.current ??= randomUUID()), {
                onError: failed,
              })
            }
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
