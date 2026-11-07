import {
  Banner,
  Button,
  KeyboardArea,
  Screen,
  Text,
  TextField,
  tokens,
} from '@tms/ui'
import { useRouter } from 'expo-router'
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
  PASSWORD_MIN,
  type RegisterInput,
  registerFieldError,
  validateRegister,
} from '../../lib/validation'

export default function RegisterScreen() {
  const { session } = useSession()
  const router = useRouter()
  // Um convite chegou por link (P12): o aviso, sem o código nem a crônica
  const invite = usePendingInvite() !== null
  const [form, setForm] = useState<RegisterInput>({
    email: '',
    username: '',
    password: '',
  })
  const [fields, setFields] = useState<FieldErrors<RegisterInput>>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // Depois do primeiro envio, ou com o campo já com erro, o erro daquele
  // campo acompanha a digitação: some quando fica certo, muda quando o
  // problema muda (T-73). Antes do primeiro envio, nada aparece
  const [submitted, setSubmitted] = useState(false)
  const usernameInput = useRef<TextInputInstance>(null)
  const passwordInput = useRef<TextInputInstance>(null)
  // Funcional: o preenchimento automático muda dois campos no mesmo lote, e
  // o `form` do fechamento perderia o primeiro. O erro de um campo só
  // depende do valor dele
  const set = (key: keyof RegisterInput) => (value: string) => {
    setForm(f => ({ ...f, [key]: value }))
    if (submitted || fields[key])
      setFields(f => ({ ...f, [key]: registerFieldError(key, value) }))
  }

  // `latest`: o valor que chega com o Enter da senha. No app, o "Ir" pode
  // vir antes do último onChangeText, e a conta seria criada com a senha
  // cortada (mais fraca do que a digitada)
  const submit = async (latest: Partial<typeof form> = {}) => {
    const current = { ...form, ...latest }
    setSubmitted(true)
    const problems = validateRegister(current)
    setFields(problems)
    if (Object.keys(problems).length) return
    setBusy(true)
    setError(null)
    try {
      await session.register(
        current.email.trim(),
        current.username,
        current.password
      )
      router.replace(hasPendingInvite() ? '/join' : '/')
    } catch (e) {
      setError(
        e instanceof AuthError
          ? authMessage('register', e.status, e.message, e.requestId)
          : 'Não foi possível criar a conta'
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
          <Text variant="displayLg" accessibilityRole="header">
            Criar conta
          </Text>
          {invite ? (
            <Banner
              tone="info"
              message="Você recebeu um convite para uma crônica. Entre ou crie sua conta para continuar."
            />
          ) : null}
          {error ? <Banner tone="danger" message={error} /> : null}
          <TextField
            label="E-mail"
            value={form.email}
            onChangeText={set('email')}
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
            // "Próximo": e-mail → usuário → senha (T-26)
            {...nextField(() => usernameInput.current?.focus())}
            testID="register-email"
          />
          <TextField
            ref={usernameInput}
            label="Nome de usuário"
            value={form.username}
            onChangeText={set('username')}
            error={fields.username}
            hint="Aparece para a sua mesa. Letras minúsculas, números e _."
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            autoComplete="username-new"
            maxLength={24}
            {...nextField(() => passwordInput.current?.focus())}
            testID="register-username"
          />
          <TextField
            ref={passwordInput}
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
            returnKeyType="go"
            onSubmitEditing={e =>
              submit({ password: e?.nativeEvent?.text ?? form.password })
            }
            testID="register-password"
          />
          <Button title="Criar conta" onPress={() => submit()} busy={busy} />
          <Button
            title="Já tenho conta"
            variant="ghost"
            onPress={() => router.replace('/login')}
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
    paddingTop: tokens.space[8],
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
})
