import { SQLiteStorage } from 'expo-sqlite/kv-store'
import type { KeyValueStorage } from './kv'

// iOS e Android: um banco SQLite próprio (não o padrão do kv-store), para a
// Etapa 22 trocar por SQLCipher sem mexer no resto. Fora do backup no Android
// (allowBackup: false).
const db = new SQLiteStorage('tms-offline.db')

export const deviceStorage: KeyValueStorage = {
  getItem: key => db.getItemAsync(key),
  setItem: (key, value) => db.setItemAsync(key, value),
  async removeItem(key) {
    await db.removeItemAsync(key)
  },
  async keys(prefix) {
    return (await db.getAllKeysAsync()).filter(k => k.startsWith(prefix))
  },
}
