import {
  AppBar,
  Banner,
  Button,
  Screen,
  Text,
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

import { messageOf } from '../../lib/errors'
import { useAcceptInvite } from '../../lib/queries/chronicles'

export default function JoinScreen() {
  const router = useRouter()
  const accept = useAcceptInvite()
  const [code, setCode] = useState('')

  const submit = () => {
    if (!code.trim()) return
    accept.mutate(code.trim(), {
      onSuccess: r => router.replace(`/chronicles/${r.chronicleId}`),
    })
  }

  return (
    <Screen>
      <AppBar
        title="Entrar com convite"
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
          <Text color="inkMuted">
            Peça o código ao narrador. Pode digitar com ou sem espaços.
          </Text>
          {accept.isError ? (
            <Banner
              tone="danger"
              message={messageOf(accept.error, 'Não foi possível entrar')}
            />
          ) : null}
          <TextField
            label="Código do convite"
            value={code}
            onChangeText={setCode}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={40}
            counter={false}
            onSubmitEditing={submit}
            testID="invite-code"
          />
          <Button
            title="Entrar na crônica"
            onPress={submit}
            busy={accept.isPending}
            disabled={!code.trim()}
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
