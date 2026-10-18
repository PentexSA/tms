import {
  AppBar,
  Banner,
  Button,
  Choice,
  Screen,
  Skeleton,
  TextField,
  tokens,
} from '@tms/ui'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native'

import { messageOf } from '../../../lib/errors'
import { useCreateChronicle, useSystems } from '../../../lib/queries/chronicles'

export default function NewChronicleScreen() {
  const router = useRouter()
  const systems = useSystems()
  const create = useCreateChronicle()
  const [name, setName] = useState('')
  const [picked, setPicked] = useState<string | null>(null)
  const [nameError, setNameError] = useState<string | null>(null)
  // Com um sistema só (a v0 tem o Vampiro), ele já vem escolhido
  const systemCode =
    picked ??
    (systems.data?.length === 1 ? (systems.data[0]?.code ?? null) : null)

  const submit = () => {
    if (!name.trim()) {
      setNameError('Dê um nome à crônica')
      return
    }
    setNameError(null)
    if (!systemCode) return
    create.mutate(
      { name: name.trim(), systemCode },
      { onSuccess: c => router.replace(`/chronicles/${c.id}`) }
    )
  }

  return (
    <Screen>
      <AppBar
        title="Nova crônica"
        back={{ label: 'Crônicas', onPress: () => router.back() }}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {create.isError ? (
            <Banner
              tone="danger"
              message={messageOf(
                create.error,
                'Não foi possível criar a crônica'
              )}
            />
          ) : null}
          <TextField
            label="Nome da crônica"
            value={name}
            onChangeText={setName}
            error={nameError}
            maxLength={80}
            testID="chronicle-name"
          />
          {systems.isPending ? (
            <Skeleton lines={2} label="Carregando os sistemas" />
          ) : systems.isError ? (
            <Banner tone="danger" message={messageOf(systems.error)} />
          ) : (
            <Choice
              label="Sistema"
              value={systemCode}
              onChange={setPicked}
              options={systems.data.map(s => ({ id: s.code, label: s.name }))}
            />
          )}
          <Button
            title="Criar crônica"
            onPress={submit}
            busy={create.isPending}
            disabled={!systemCode}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    gap: tokens.space[4],
    padding: tokens.layout.gutter,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
})
