import { Screen, Skeleton } from '@tms/ui'
import { Redirect, Stack } from 'expo-router'

import { useSession } from '../../lib/session/SessionProvider'

// Login e cadastro: quem já tem sessão vai direto para o app.
export default function AuthLayout() {
  const { status } = useSession()
  if (status === 'loading')
    return (
      <Screen>
        <Skeleton />
      </Screen>
    )
  if (status === 'signedIn') return <Redirect href="/" />
  return <Stack screenOptions={{ headerShown: false }} />
}
