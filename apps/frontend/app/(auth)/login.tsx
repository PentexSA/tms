import { Banner, Button, Screen, Text, TextField, tokens } from '@tms/ui'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native'

import { AuthError } from '../../lib/session'
import { useSession } from '../../lib/session/SessionProvider'

export default function LoginScreen() {
  const { session } = useSession()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!email.trim() || !password) {
      setError('Informe o e-mail e a senha')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await session.login(email.trim(), password)
      router.replace('/')
    } catch (e) {
      setError(e instanceof AuthError ? e.message : 'Não foi possível entrar')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text variant="displayXl" accessibilityRole="header">
            TMS
          </Text>
          <Text color="inkMuted">Entre para ver suas crônicas e fichas.</Text>
          {error ? <Banner tone="danger" message={error} /> : null}
          <TextField
            label="E-mail"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            maxLength={254}
            counter={false}
            testID="login-email"
          />
          <TextField
            label="Senha"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
            maxLength={128}
            counter={false}
            onSubmitEditing={submit}
            testID="login-password"
          />
          <Button title="Entrar" onPress={submit} busy={busy} />
          <Button
            title="Criar conta"
            variant="ghost"
            onPress={() => router.replace('/register')}
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
    paddingTop: tokens.space[12],
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
})
