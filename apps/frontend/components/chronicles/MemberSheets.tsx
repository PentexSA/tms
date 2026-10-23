import {
  Banner,
  BottomSheet,
  Button,
  Choice,
  Text,
  tokens,
  useToast,
} from '@tms/ui'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { messageOf } from '../../lib/errors'
import {
  useLeaveChronicle,
  useRemoveMember,
} from '../../lib/queries/chronicles'

// Remover um jogador (o narrador) e sair da crônica (o jogador), com
// confirmação (doc/plano-v3.md, Etapa 7). Nada é apagado: as fichas ficam
// arquivadas, e o ex-membro continua lendo as dele.

export function RemoveMemberSheet({
  chronicleId,
  member,
  onClose,
}: {
  readonly chronicleId: string
  readonly member: { readonly id: string; readonly username: string }
  readonly onClose: () => void
}) {
  const toast = useToast()
  const remove = useRemoveMember(chronicleId)
  // O removido não volta sozinho com um convite que já tinha (§7, decisão 4)
  const [invites, setInvites] = useState<'revoke' | 'keep'>('revoke')
  const submit = () =>
    remove.mutate(
      { userId: member.id, revokeInvites: invites === 'revoke' },
      {
        onSuccess: () => {
          toast.show({ message: `${member.username} saiu da crônica.` })
          onClose()
        },
      }
    )
  return (
    <BottomSheet
      visible
      title={`Remover ${member.username}`}
      onClose={onClose}
      footer={
        <>
          <Button title="Cancelar" variant="ghost" onPress={onClose} />
          <Button
            title="Remover"
            variant="danger"
            busy={remove.isPending}
            onPress={submit}
          />
        </>
      }
    >
      <View style={styles.body}>
        <Text>
          As fichas de {member.username} vão para arquivadas: quem sai continua
          lendo, mas não altera nem rola. Você pode reativá-las depois.
        </Text>
        <Choice
          label="Convites ativos"
          options={[
            { id: 'revoke', label: 'Revogar os convites ativos' },
            { id: 'keep', label: 'Manter os convites' },
          ]}
          value={invites}
          onChange={id => setInvites(id as typeof invites)}
        />
        {remove.isError ? (
          <Banner tone="danger" message={messageOf(remove.error)} />
        ) : null}
      </View>
    </BottomSheet>
  )
}

export function LeaveChronicleSheet({
  chronicleId,
  chronicleName,
  onClose,
}: {
  readonly chronicleId: string
  readonly chronicleName: string
  readonly onClose: () => void
}) {
  const router = useRouter()
  const toast = useToast()
  const leave = useLeaveChronicle(chronicleId)
  const submit = () =>
    leave.mutate(undefined, {
      onSuccess: () => {
        toast.show({ message: `Você saiu de “${chronicleName}”.` })
        onClose()
        router.replace('/')
      },
    })
  return (
    <BottomSheet
      visible
      title="Sair da crônica"
      onClose={onClose}
      footer={
        <>
          <Button title="Cancelar" variant="ghost" onPress={onClose} />
          <Button
            title="Sair da crônica"
            variant="danger"
            busy={leave.isPending}
            onPress={submit}
          />
        </>
      }
    >
      <View style={styles.body}>
        <Text>
          Suas fichas ficam arquivadas: você continua lendo, mas não altera nem
          rola. Para voltar, peça um convite ao narrador.
        </Text>
        {leave.isError ? (
          <Banner tone="danger" message={messageOf(leave.error)} />
        ) : null}
      </View>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  body: { gap: tokens.space[3], paddingBottom: tokens.space[2] },
})
