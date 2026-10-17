import '../global.css'
import { focusManager, QueryClientProvider } from '@tanstack/react-query'
import { Stack } from 'expo-router'
import { useEffect, useState } from 'react'
import { AppState, type AppStateStatus, Platform } from 'react-native'

import { createQueryClient } from '../lib/queryClient'

// No mobile não existe foco de janela: refaz as queries quando o app volta ao primeiro plano
const onAppStateChange = (status: AppStateStatus) => {
  if (Platform.OS !== 'web') {
    focusManager.setFocused(status === 'active')
  }
}

export default function Layout() {
  const [queryClient] = useState(createQueryClient)

  useEffect(() => {
    const subscription = AppState.addEventListener('change', onAppStateChange)
    return () => subscription.remove()
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <Stack screenOptions={{ headerShown: false }} />
    </QueryClientProvider>
  )
}
