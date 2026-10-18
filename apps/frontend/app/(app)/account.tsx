import {
  AppBar,
  Banner,
  Button,
  Screen,
  SectionHeader,
  Text,
  TextField,
  tokens,
} from '@tms/ui'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'

import { type DeleteAccountResult, deleteAccount } from '../../lib/account'
import { useSession } from '../../lib/session/SessionProvider'

type Failure = Extract<DeleteAccountResult, { ok: false }>

// O que acontece com os dados, na ordem em que a pessoa precisa saber
const WHAT_HAPPENS = [
  'Sua conta, suas fichas e seus convites são apagados de vez.',
  'Nas fichas de outras pessoas, o que você alterou continua no histórico como “Conta excluída”.',
  'Crônicas que você narra sem outros jogadores são apagadas. Com outros jogadores, exclua a crônica antes.',
  'Os dados guardados neste aparelho também são apagados.',
]

// Conta (LGPD art. 18): quem é a pessoa e o direito de excluir os dados.
export default function AccountScreen() {
  const router = useRouter()
  const { session, user } = useSession()
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<Failure | null>(null)

  const submit = async () => {
    if (!password) {
      setFailure({
        ok: false,
        kind: 'password',
        message: 'Informe a sua senha para confirmar.',
        chronicles: [],
      })
      return
    }
    setBusy(true)
    setFailure(null)
    const result = await deleteAccount(session, password)
    setBusy(false)
    if (result.ok) {
      router.replace('/login?deleted=1')
      return
    }
    if (result.kind === 'password') setPassword('')
    setFailure(result)
  }

  return (
    <Screen>
      <AppBar
        title="Conta"
        back={{ label: 'Crônicas', onPress: () => router.replace('/') }}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {user ? (
          <Text color="inkMuted">{`Você entrou como ${user.username}.`}</Text>
        ) : null}
        <SectionHeader title="Excluir conta" />
        <View style={styles.list}>
          {WHAT_HAPPENS.map(line => (
            <Text key={line}>{`• ${line}`}</Text>
          ))}
        </View>
        {failure?.kind === 'blocked' ? (
          <Banner
            tone="warning"
            title={failure.message}
            message="Você narra crônicas com outros jogadores. Abra cada uma e exclua (ou espere passar a narração):"
            action={
              <View style={styles.list}>
                {failure.chronicles.map(c => (
                  <Button
                    key={c.id}
                    title={`Abrir ${c.name}`}
                    variant="secondary"
                    onPress={() => router.push(`/chronicles/${c.id}`)}
                  />
                ))}
              </View>
            }
          />
        ) : failure ? (
          <Banner tone="danger" message={failure.message} />
        ) : null}
        <TextField
          label="Senha"
          hint="Para confirmar que é você"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          maxLength={128}
          counter={false}
          testID="account-password"
        />
        <Button
          title="Excluir conta"
          variant="danger"
          busy={busy}
          onPress={submit}
        />
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: {
    gap: tokens.space[4],
    padding: tokens.layout.gutter,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  list: { gap: tokens.space[2] },
})
