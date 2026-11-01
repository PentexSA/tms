import * as SecureStore from 'expo-secure-store'
import type { TokenStore } from './tokenStore'

// Keychain (iOS) e Keystore (Android), só deste aparelho e com ele
// desbloqueado: o token não vai para backup nem para outro aparelho.
const KEY = 'tms.refreshToken'
// A revogação pendente do logout sem rede (T-14): o mesmo nível de proteção
// do token ativo, nunca em claro nem no banco do aparelho
const PENDING_LOGOUT = 'tms.pendingLogout'
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
}

export const tokenStore: TokenStore = {
  refreshInBody: true,
  read: () => SecureStore.getItemAsync(KEY, OPTIONS),
  write: token => SecureStore.setItemAsync(KEY, token, OPTIONS),
  clear: () => SecureStore.deleteItemAsync(KEY, OPTIONS),
  pendingLogout: {
    read: () => SecureStore.getItemAsync(PENDING_LOGOUT, OPTIONS),
    write: token => SecureStore.setItemAsync(PENDING_LOGOUT, token, OPTIONS),
    clear: () => SecureStore.deleteItemAsync(PENDING_LOGOUT, OPTIONS),
  },
}
