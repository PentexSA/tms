import { Screen, Skeleton } from '@tms/ui'
import { Redirect, Stack } from 'expo-router'

import { hasPendingInvite } from '../../lib/invite/pending'
import { useSession } from '../../lib/session/SessionProvider'

// Login e cadastro: quem já tem sessão vai direto para o app. Com um convite
// que chegou por link (P12, D-14), o destino é "Entrar com convite": o
// redirecionamento da sessão não pode correr na frente e cair na lista.
export default function AuthLayout() {
  const { status } = useSession()
  if (status === 'loading')
    return (
      <Screen>
        <Skeleton />
      </Screen>
    )
  if (status === 'signedIn')
    return <Redirect href={hasPendingInvite() ? '/join' : '/'} />
  return <Stack screenOptions={{ headerShown: false }} />
}
