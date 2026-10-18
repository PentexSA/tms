/**
 * Setup global para todos os testes do Frontend
 *
 * Configurações específicas do Expo e React Native
 */

import { AppState } from 'react-native'

// Mock do Expo Router para testes
jest.mock('expo-router', () => ({
  Stack: 'Stack',
  useRouter: jest.fn(),
  useLocalSearchParams: jest.fn(),
  Link: 'Link',
}))

// Mock do Expo Status Bar
jest.mock('expo-status-bar', () => ({
  StatusBar: 'StatusBar',
}))

// Mock da config
jest.mock('@tms/config/env', () => ({
  config: {
    EXPO_PUBLIC_API_URL: 'http://localhost:3001',
  },
}))

// Eden sem rede: cada teste mocka as rotas que usa (ver app/__tests__)
jest.mock('@elysiajs/eden', () => ({
  treaty: jest.fn(() => ({})),
}))

// O resetMocks zera o mock do AppState (react-native/jest) antes de cada teste;
// restaura o retorno de addEventListener usado pelo focusManager no _layout
beforeEach(() => {
  jest
    .mocked(AppState.addEventListener)
    .mockReturnValue({ remove: jest.fn() } as never)
})

// Suprimir console.error nos testes para evitar poluição do output
// Os erros são tratados adequadamente pelo código no bloco try/catch
const originalError = console.error
beforeAll(() => {
  console.log('🧪 Starting Frontend test suite...')
  console.log('📱 Testing Expo + React Native app')
  console.error = jest.fn()
})

// Cleanup global após todos os testes
afterAll(() => {
  console.log('✅ Frontend test suite finished')
  // Restaurar console.error
  console.error = originalError
})
