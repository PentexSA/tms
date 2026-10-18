import * as Crypto from 'expo-crypto'
import * as SecureStore from 'expo-secure-store'
import { KEY_NAME } from '../encryptedStorage'
import { deviceStorage } from '../storage.native'

// A fiação do storage nativo: a chave do banco fica no Keychain/Keystore só
// deste aparelho e desbloqueado (como o refresh token), com 32 bytes do
// gerador do expo-crypto. O expo-sqlite é o fake do test/setup.ts.

jest.mock('expo-crypto', () => ({ getRandomBytes: jest.fn() }))
jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}))

it('chave no SecureStore deste aparelho, com 32 bytes aleatórios', async () => {
  const options = { keychainAccessible: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY' }
  // resetMocks zera as implementações da fábrica antes de cada teste
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue(null)
  jest
    .mocked(Crypto.getRandomBytes)
    .mockImplementation(n => new Uint8Array(n).fill(171))
  await deviceStorage.setItem('k', 'v')
  expect(await deviceStorage.getItem('k')).toBe('v')
  expect(Crypto.getRandomBytes).toHaveBeenCalledWith(32)
  expect(SecureStore.getItemAsync).toHaveBeenCalledWith(KEY_NAME, options)
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
    KEY_NAME,
    'ab'.repeat(32),
    options
  )
})
