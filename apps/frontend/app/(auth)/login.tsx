import {
  Banner,
  Button,
  KeyboardArea,
  Screen,
  Text,
  TextField,
  tokens,
} from '@tms/ui'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useRef, useState } from 'react'
import { ScrollView, StyleSheet, type TextInputInstance } from 'react-native'

import { nextField } from '../../lib/keyboard'
import { AuthError } from '../../lib/session'
import { useSession } from '../../lib/session/SessionProvider'

export default function LoginScreen() {
  const { session } = useSession()
  const router = useRouter()
  // Veio da exclusão de conta (app/(app)/account.tsx)
  const { deleted } = useLocalSearchParams<{ deleted?: string }>()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const passwordInput = useRef<TextInputInstance>(null)

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
      {/* O formulário encolhe acima do teclado também no Android (T-26) */}
      <KeyboardArea>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text variant="displayXl" accessibilityRole="header">
            TMS
          </Text>
          <Text color="inkMuted">Entre para ver suas crônicas e fichas.</Text>
          {deleted === '1' ? (
            <Banner
              tone="success"
              title="Conta excluída"
              message="Seus dados foram apagados, inclusive os deste aparelho."
            />
          ) : null}
          {error ? <Banner tone="danger" message={error} /> : null}
          <TextField
            label="E-mail"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            // O teclado não corrige nem guarda o e-mail (T-38; MASVS-STORAGE-2)
            autoCorrect={false}
            spellCheck={false}
            autoComplete="email"
            textContentType="emailAddress"
            maxLength={254}
            counter={false}
            // "Próximo" leva à senha (T-26); só a senha envia
            {...nextField(() => passwordInput.current?.focus())}
            testID="login-email"
          />
          <TextField
            ref={passwordInput}
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
      </KeyboardArea>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: {
    gap: tokens.space[4],
    padding: tokens.layout.gutter,
    paddingTop: tokens.space[12],
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
})
