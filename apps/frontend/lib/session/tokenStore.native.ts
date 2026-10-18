import * as SecureStore from 'expo-secure-store'
import type { TokenStore } from './tokenStore'

// Keychain (iOS) e Keystore (Android), só deste aparelho e com ele
// desbloqueado: o token não vai para backup nem para outro aparelho.
const KEY = 'tms.refreshToken'
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
}

export const tokenStore: TokenStore = {
  refreshInBody: true,
  read: () => SecureStore.getItemAsync(KEY, OPTIONS),
  write: token => SecureStore.setItemAsync(KEY, token, OPTIONS),
  clear: () => SecureStore.deleteItemAsync(KEY, OPTIONS),
}
