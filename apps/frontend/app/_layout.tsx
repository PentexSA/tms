import '../global.css'
import { focusManager, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider, ToastProvider } from '@tms/ui'
import { type ErrorBoundaryProps, Slot } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useState } from 'react'
import {
  AppState,
  type AppStateStatus,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { connectNetwork } from '../lib/network'
import { OfflineProvider } from '../lib/persist'
import { createQueryClient } from '../lib/queryClient'
import { session } from '../lib/session'
import { SessionProvider } from '../lib/session/SessionProvider'
import { captureError, initTelemetry } from '../lib/telemetry'
import { SyncProvider } from '../sheet/sync/SyncProvider'
import { deviceStorage } from '../sheet/sync/storage'

// Error tracking (web, com DSN no build); o nativo não faz nada
initTelemetry()

// Online e offline vêm do NetInfo: queries pausam e a fila espera a rede
connectNetwork()

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
            {/* Cache e fila no aparelho, por usuário (doc/arquitetura §7) */}
            <OfflineProvider storage={deviceStorage}>
              <ToastProvider>
                <SyncProvider>
                  <StatusBar style="auto" />
                  <Slot />
                </SyncProvider>
              </ToastProvider>
            </OfflineProvider>
          </SessionProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  )
}

/**
 * Erro ao desenhar o app: sai da raiz, fora do ThemeProvider e dos demais
 * providers, então o fallback usa só componentes do React Native e cores
 * fixas. Não mostra a mensagem nem a pilha: elas podem repetir valores da
 * ficha. Um boundary de rota (characters/[id].tsx) engole o erro antes daqui.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    captureError(error, { source: 'boundary' })
  }, [error])
  return (
    <View
      accessibilityRole="alert"
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        gap: 12,
        backgroundColor: '#ffffff',
      }}
    >
      <Text style={{ fontSize: 20, fontWeight: '600', color: '#111111' }}>
        Algo deu errado
      </Text>
      <Text style={{ color: '#444444', textAlign: 'center' }}>
        O que já foi salvo continua guardado. Tente de novo; se o erro
        continuar, recarregue a página.
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => void retry()}
        style={{
          paddingVertical: 10,
          paddingHorizontal: 20,
          borderRadius: 8,
          backgroundColor: '#111111',
        }}
      >
        <Text style={{ color: '#ffffff' }}>Tentar de novo</Text>
      </Pressable>
      {Platform.OS === 'web' && (
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            (globalThis as { location?: { reload(): void } }).location?.reload()
          }
        >
          <Text style={{ color: '#111111', textDecorationLine: 'underline' }}>
            Recarregar a página
          </Text>
        </Pressable>
      )}
    </View>
  )
}
