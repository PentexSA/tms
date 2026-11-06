import {
  AppBar,
  Banner,
  Button,
  KeyboardArea,
  Screen,
  Text,
  TextField,
  tokens,
} from '@tms/ui'
import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet } from 'react-native'

import { messageOf } from '../../lib/errors'
import { clearPendingInvite, peekPendingInvite } from '../../lib/invite/pending'
import { usePendingInvite } from '../../lib/invite/usePendingInvite'
import { useAcceptInvite } from '../../lib/queries/chronicles'
import { useSession } from '../../lib/session/SessionProvider'

// "Entrar com convite". Com um link (P12, D-14), o campo já vem preenchido
// com o código da memória (lib/invite/pending.ts) e diz com que conta a
// pessoa vai entrar; o aceite continua no toque, nunca ao abrir a tela.
// A tela não lê query (?code=): o código só chega pelo fragmento.
export default function JoinScreen() {
  const router = useRouter()
  const { user } = useSession()
  const accept = useAcceptInvite()
  const pending = usePendingInvite()
  const [code, setCode] = useState(() => peekPendingInvite() ?? '')
  // Um link novo com a tela aberta (hashchange no web, deep link no app)
  useEffect(() => {
    if (pending) setCode(pending)
  }, [pending])

  const submit = () => {
    if (!code.trim()) return
    accept.mutate(code.trim(), {
      onSuccess: r => {
        clearPendingInvite()
        router.replace(`/chronicles/${r.chronicleId}`)
      },
    })
  }
  const leave = () => {
    clearPendingInvite()
    router.back()
  }

  return (
    <Screen>
      <AppBar
        title="Entrar com convite"
        back={{ label: 'Crônicas', onPress: leave }}
      />
      {/* Encolhe acima do teclado também no Android (T-26) */}
      <KeyboardArea>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text color="inkMuted">
            Peça o código ao narrador. Pode digitar com ou sem espaços.
          </Text>
          {pending && user ? (
            <Banner
              tone="info"
              message={`Convite recebido. Você vai entrar como ${user.username}.`}
            />
          ) : null}
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
            // Sem sugestão de preenchimento (nem o código de SMS do iOS)
            autoComplete="off"
            spellCheck={false}
            // O teto do aceite na API: cabe um código colado com espaços
            maxLength={64}
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
      </KeyboardArea>
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
})
