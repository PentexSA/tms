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
import {
  type FieldErrors,
  PASSWORD_MIN,
  type RegisterInput,
  validateRegister,
} from '../../lib/validation'

export default function RegisterScreen() {
  const { session } = useSession()
  const router = useRouter()
  const [form, setForm] = useState<RegisterInput>({
    email: '',
    username: '',
    password: '',
  })
  const [fields, setFields] = useState<FieldErrors<RegisterInput>>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const set = (key: keyof RegisterInput) => (value: string) =>
    setForm(f => ({ ...f, [key]: value }))

  const submit = async () => {
    const problems = validateRegister(form)
    setFields(problems)
    if (Object.keys(problems).length) return
    setBusy(true)
    setError(null)
    try {
      await session.register(form.email.trim(), form.username, form.password)
      router.replace('/')
    } catch (e) {
      setError(
        e instanceof AuthError ? e.message : 'Não foi possível criar a conta'
      )
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
          <Text variant="displayLg" accessibilityRole="header">
            Criar conta
          </Text>
          {error ? <Banner tone="danger" message={error} /> : null}
          <TextField
            label="E-mail"
            value={form.email}
            onChangeText={set('email')}
            error={fields.email}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            maxLength={254}
            counter={false}
            testID="register-email"
          />
          <TextField
            label="Nome de usuário"
            value={form.username}
            onChangeText={set('username')}
            error={fields.username}
            hint="Aparece para a sua mesa. Letras minúsculas, números e _."
            autoCapitalize="none"
            autoComplete="username-new"
            maxLength={24}
            testID="register-username"
          />
          <TextField
            label="Senha"
            value={form.password}
            onChangeText={set('password')}
            error={fields.password}
            hint={`Pelo menos ${PASSWORD_MIN} caracteres. Uma frase funciona bem.`}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            maxLength={128}
            counter={false}
            testID="register-password"
          />
          <Button title="Criar conta" onPress={submit} busy={busy} />
          <Button
            title="Já tenho conta"
            variant="ghost"
            onPress={() => router.replace('/login')}
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
    paddingTop: tokens.space[8],
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
})
