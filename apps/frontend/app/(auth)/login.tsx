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

import { authMessage } from '../../lib/authMessages'
import { hasPendingInvite } from '../../lib/invite/pending'
import { usePendingInvite } from '../../lib/invite/usePendingInvite'
import { nextField } from '../../lib/keyboard'
import { AuthError } from '../../lib/session'
import { useSession } from '../../lib/session/SessionProvider'
import {
  type FieldErrors,
  type LoginInput,
  validateLogin,
} from '../../lib/validation'

export default function LoginScreen() {
  const { session } = useSession()
  const router = useRouter()
  // Veio da exclusão de conta (app/(app)/account.tsx)
  const { deleted } = useLocalSearchParams<{ deleted?: string }>()
  // Um convite chegou por link (P12): o aviso, sem o código nem a crônica
  const invite = usePendingInvite() !== null
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // Os erros de campo (T-73): depois do primeiro envio, acompanham a digitação
  const [fields, setFields] = useState<FieldErrors<LoginInput>>({})
  const [submitted, setSubmitted] = useState(false)
  const passwordInput = useRef<TextInputInstance>(null)
  const recheck = (next: LoginInput, key: keyof LoginInput) => {
    if (!submitted && !fields[key]) return
    setFields(f => ({ ...f, [key]: validateLogin(next)[key] }))
  }
  const changeEmail = (value: string) => {
    setEmail(value)
    recheck({ email: value, password }, 'email')
  }
  const changePassword = (value: string) => {
    setPassword(value)
    recheck({ email, password: value }, 'password')
  }

  const submit = async () => {
    setSubmitted(true)
    const problems = validateLogin({ email, password })
    setFields(problems)
    // O e-mail é conferido antes: sem requisição, o erro no campo (POA-34)
    if (Object.keys(problems).length) return
    setBusy(true)
    setError(null)
    try {
      await session.login(email.trim(), password)
      router.replace(hasPendingInvite() ? '/join' : '/')
    } catch (e) {
      setError(
        e instanceof AuthError
          ? authMessage('login', e.status, e.message)
          : 'Não foi possível entrar'
      )
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
          {invite ? (
            <Banner
              tone="info"
              message="Você recebeu um convite para uma crônica. Entre ou crie sua conta para continuar."
            />
          ) : null}
          {error ? <Banner tone="danger" message={error} /> : null}
          <TextField
            label="E-mail"
            value={email}
            onChangeText={changeEmail}
            error={fields.email}
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
            onChangeText={changePassword}
            error={fields.password}
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
