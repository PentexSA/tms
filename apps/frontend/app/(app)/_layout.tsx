import { AppBar, Screen, Skeleton } from '@tms/ui'
import { Redirect, Stack } from 'expo-router'

import { useSession } from '../../lib/session/SessionProvider'

// Tudo dentro de (app) exige sessão: sem ela, login. A API nega do mesmo
// jeito; esta guarda é só para a navegação.
export default function AppLayout() {
  const { status } = useSession()
  // Restaurando a sessão: a app bar com título fixo (nenhum dado do usuário
  // nem do cache antes de a sessão voltar) e o carregamento anunciado
  if (status === 'loading')
    return (
      <Screen>
        <AppBar title="TMS" />
        <Skeleton />
      </Screen>
    )
  if (status === 'signedOut') return <Redirect href="/login" />
  return <Stack screenOptions={{ headerShown: false }} />
}
