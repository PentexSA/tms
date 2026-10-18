import NetInfo, { type NetInfoState } from '@react-native-community/netinfo'
import { onlineManager } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'
import { Platform } from 'react-native'

// Online e offline vêm do NetInfo (doc/arquitetura §7.1): o TanStack pausa as
// queries sem rede e a fila tenta de novo ao reconectar. Sem a checagem de
// "internet alcançável": ela chama um servidor de terceiros (Google) a cada
// mudança de rede, e o CSP do web bloquearia de todo jeito.

interface NetInfoLike {
  configure(config: { reachabilityShouldRun: () => boolean }): void
  addEventListener(listener: (state: NetInfoState) => void): () => void
}

/** `isConnected` null é desconhecido: não trava o app como offline. */
export const isOnline = (state: Pick<NetInfoState, 'isConnected'>) =>
  state.isConnected !== false

export function connectNetwork(
  netinfo: NetInfoLike = NetInfo,
  platform: string = Platform.OS
): void {
  // No web, o NetInfo usa navigator.connection quando existe (Chromium), e o
  // "change" dele não dispara quando a rede cai. Os eventos online/offline da
  // janela, que o onlineManager do TanStack já escuta por padrão, disparam
  if (platform === 'web') return
  netinfo.configure({ reachabilityShouldRun: () => false })
  onlineManager.setEventListener(setOnline =>
    netinfo.addEventListener(state => setOnline(isOnline(state)))
  )
}

export const useOnline = (): boolean =>
  useSyncExternalStore(
    listener => onlineManager.subscribe(listener),
    () => onlineManager.isOnline()
  )
