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
    read: async () =>
      parsePending(await SecureStore.getItemAsync(PENDING_LOGOUT, OPTIONS)),
    write: tokens =>
      tokens.length
        ? SecureStore.setItemAsync(
            PENDING_LOGOUT,
            JSON.stringify(tokens),
            OPTIONS
          )
        : SecureStore.deleteItemAsync(PENDING_LOGOUT, OPTIONS),
  },
}

/** A lista do keychain, conferida: só textos do tamanho de um token. */
export function parsePending(raw: string | null): string[] {
  if (!raw) return []
  try {
    const value: unknown = JSON.parse(raw)
    if (Array.isArray(value))
      return value.filter(
        (t): t is string =>
          typeof t === 'string' && t.length > 0 && t.length <= 200
      )
  } catch {
    // Um token só, gravado como texto: vale como lista de um
    if (raw.length <= 200 && !raw.startsWith('[')) return [raw]
  }
  return []
}
