/**
 * Setup global para todos os testes do Frontend
 *
 * Configurações específicas do Expo e React Native
 */

import { AccessibilityInfo, AppState } from 'react-native'

// Mock do Expo Router para testes. Redirect é um jest.fn: o teste confere o
// href com toHaveBeenCalledWith (createElement aqui esbarra no babel do NativeWind)
jest.mock('expo-router', () => ({
  Stack: 'Stack',
  Slot: 'Slot',
  Redirect: jest.fn(() => null),
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  })),
  useLocalSearchParams: jest.fn(() => ({})),
  // beforeRemove do LeaveGuard (Evoluir): o teste define o retorno
  useNavigation: jest.fn(() => undefined),
  Link: 'Link',
}))

// Safe area sem módulo nativo
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default
)

// Mock do Expo Status Bar
jest.mock('expo-status-bar', () => ({
  StatusBar: 'StatusBar',
}))

// Eden sem rede: cada teste mocka as rotas que usa (ver app/__tests__)
jest.mock('@elysiajs/eden', () => ({
  treaty: jest.fn(() => ({})),
}))

// O resetMocks zera os mocks do react-native antes de cada teste: restaura o
// AppState (usado pelo focusManager no _layout) e o AccessibilityInfo (Toast)
beforeEach(() => {
  jest
    .mocked(AppState.addEventListener)
    .mockReturnValue({ remove: jest.fn() } as never)
  jest
    .spyOn(AccessibilityInfo, 'isScreenReaderEnabled')
    .mockResolvedValue(false)
})

// Erros esperados (respostas 4xx simuladas) não poluem a saída
const originalError = console.error
beforeAll(() => {
  console.error = jest.fn()
})
afterAll(() => {
  console.error = originalError
})
