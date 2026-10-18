import {
  Banner,
  BottomSheet,
  Button,
  Text,
  TextField,
  tokens,
  useToast,
} from '@tms/ui'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { messageOf } from '../../lib/errors'
import { useDeleteChronicle } from '../../lib/queries/chronicles'

// Excluir a crônica (só o narrador). Apaga as fichas dos jogadores nela: a
// confirmação é o nome digitado, não um toque (a API confere o mesmo).
export function DeleteChronicleSheet({
  chronicleId,
  chronicleName,
  visible,
  onClose,
}: {
  readonly chronicleId: string
  readonly chronicleName: string
  readonly visible: boolean
  readonly onClose: () => void
}) {
  const router = useRouter()
  const toast = useToast()
  const remove = useDeleteChronicle(chronicleId)
  const [typed, setTyped] = useState('')
  const matches = typed.trim() === chronicleName
  const close = () => {
    setTyped('')
    remove.reset()
    onClose()
  }
  const submit = () =>
    remove.mutate(typed.trim(), {
      onSuccess: () => {
        toast.show({ message: `Crônica “${chronicleName}” excluída` })
        router.replace('/')
      },
    })

  return (
    <BottomSheet
      visible={visible}
      title="Excluir crônica"
      onClose={close}
      footer={
        <>
          <Button title="Cancelar" variant="ghost" onPress={close} />
          <Button
            title="Excluir crônica"
            variant="danger"
            disabled={!matches}
            busy={remove.isPending}
            onPress={submit}
          />
        </>
      }
    >
      <View style={styles.body}>
        <Text>
          A crônica sai de vez, com as fichas de todos os jogadores nela, os
          convites e os vínculos. As contas dos jogadores continuam.
        </Text>
        {remove.isError ? (
          <Banner tone="danger" message={messageOf(remove.error)} />
        ) : null}
        <TextField
          label="Digite o nome da crônica para confirmar"
          hint={chronicleName}
          value={typed}
          onChangeText={setTyped}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={80}
          counter={false}
        />
      </View>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  body: { gap: tokens.space[3], paddingBottom: tokens.space[2] },
})
