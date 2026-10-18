import * as Crypto from 'expo-crypto'
import * as SecureStore from 'expo-secure-store'
import { deleteDatabaseAsync, openDatabaseAsync } from 'expo-sqlite'
import { createEncryptedStorage } from './encryptedStorage'
import type { KeyValueStorage } from './kv'

// iOS e Android: o banco próprio da Etapa 20, agora em SQLCipher (plugin do
// expo-sqlite com useSQLCipher no app.json; exige dev build). A chave fica no
// Keychain/Keystore, só deste aparelho e com ele desbloqueado, como o refresh
// token. Fora do backup no Android (allowBackup: false).
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
}

export const deviceStorage: KeyValueStorage = createEncryptedStorage({
  openDatabase: name => openDatabaseAsync(name),
  deleteDatabase: name => deleteDatabaseAsync(name),
  secrets: {
    get: key => SecureStore.getItemAsync(key, OPTIONS),
    set: (key, value) => SecureStore.setItemAsync(key, value, OPTIONS),
  },
  randomBytes: count => Crypto.getRandomBytes(count),
  // O Expo Go não tem SQLCipher: só em desenvolvimento abre sem cifra. O
  // Metro troca o NODE_ENV no build de release
  allowPlaintext: process.env.NODE_ENV !== 'production',
  // Só o tipo do problema
  report: problem => console.warn(`[storage] ${problem}`),
})
