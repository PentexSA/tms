import '../global.css'
import { focusManager, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider, ToastProvider } from '@tms/ui'
import { Slot } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useState } from 'react'
import { AppState, type AppStateStatus, Platform } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { createQueryClient } from '../lib/queryClient'
import { session } from '../lib/session'
import { SessionProvider } from '../lib/session/SessionProvider'
import { SyncProvider } from '../sheet/sync/SyncProvider'

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
    <SafeAreaProvider>
      <ThemeProvider preference="sistema" skin="wod">
        <QueryClientProvider client={queryClient}>
          <SessionProvider session={session}>
            <ToastProvider>
              <SyncProvider>
                <StatusBar style="auto" />
                <Slot />
              </SyncProvider>
            </ToastProvider>
          </SessionProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  )
}
