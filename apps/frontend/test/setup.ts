/**
 * Setup global para todos os testes do Frontend
 *
 * Configurações específicas do Expo e React Native
 */

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

// Mock completo do módulo @elysiajs/eden com implementação funcional
jest.mock('@elysiajs/eden', () => ({
  treaty: jest.fn(() => ({
    todos: {
      get: jest.fn().mockResolvedValue({
        data: [
          {
            id: 1,
            title: 'Test Todo',
            done: false,
            created_at: new Date().toISOString(),
          },
        ],
      }),
      post: jest.fn().mockResolvedValue({
        data: {
          id: 2,
          title: 'New Todo',
          done: false,
          created_at: new Date().toISOString(),
        },
      }),
    },
  })),
}))

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
