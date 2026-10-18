import type { NetInfoState } from '@react-native-community/netinfo'
import { onlineManager } from '@tanstack/react-query'
import { connectNetwork, isOnline } from '../network'

// Etapa 20: o onlineManager do TanStack segue o NetInfo.

afterEach(() => {
  onlineManager.setOnline(true)
})

function fakeNetInfo() {
  let listener: ((s: NetInfoState) => void) | undefined
  return {
    configure: jest.fn(),
    addEventListener: jest.fn((l: (s: NetInfoState) => void) => {
      listener = l
      return () => {
        listener = undefined
      }
    }),
    emit: (isConnected: boolean | null) =>
      listener?.({ isConnected } as NetInfoState),
  }
}

it('offline e online do NetInfo viram o estado do TanStack', () => {
  const netinfo = fakeNetInfo()
  connectNetwork(netinfo)
  netinfo.emit(false)
  expect(onlineManager.isOnline()).toBe(false)
  netinfo.emit(true)
  expect(onlineManager.isOnline()).toBe(true)
  // Desconhecido não trava o app como offline
  netinfo.emit(false)
  netinfo.emit(null)
  expect(onlineManager.isOnline()).toBe(true)
})

it('sem checagem de "internet alcançável" (chamaria um servidor de terceiros)', () => {
  const netinfo = fakeNetInfo()
  connectNetwork(netinfo)
  const config = netinfo.configure.mock.calls[0]?.[0]
  expect(config.reachabilityShouldRun()).toBe(false)
})

it('no web fica o padrão do TanStack (eventos online/offline da janela)', () => {
  const netinfo = fakeNetInfo()
  connectNetwork(netinfo, 'web')
  expect(netinfo.configure).not.toHaveBeenCalled()
  expect(netinfo.addEventListener).not.toHaveBeenCalled()
})

it('isOnline', () => {
  expect(isOnline({ isConnected: true })).toBe(true)
  expect(isOnline({ isConnected: false })).toBe(false)
  expect(isOnline({ isConnected: null })).toBe(true)
})

it('o padrão usa o NetInfo do pacote', () => {
  expect(() => connectNetwork()).not.toThrow()
})
