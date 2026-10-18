// O kv-store do expo-sqlite sem o módulo nativo: um Map por banco. Classe
// simples (não jest.fn), para o resetMocks não apagar o comportamento.
const databases = new Map<string, Map<string, string>>()

export class SQLiteStorage {
  readonly #data: Map<string, string>

  constructor(name: string) {
    const existing = databases.get(name) ?? new Map<string, string>()
    databases.set(name, existing)
    this.#data = existing
  }

  async getItemAsync(key: string) {
    return this.#data.get(key) ?? null
  }

  async setItemAsync(key: string, value: string) {
    this.#data.set(key, value)
  }

  async removeItemAsync(key: string) {
    return this.#data.delete(key)
  }

  async getAllKeysAsync() {
    return [...this.#data.keys()]
  }
}

export default new SQLiteStorage('ExpoSQLiteStorage')
