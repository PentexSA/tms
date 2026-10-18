// O storage do aparelho (doc/arquitetura §7.1 e §7.2): chave e valor, só
// texto. O cache e o outbox gravam aqui; tokens nunca (ficam no secure store
// ou no cookie HttpOnly). No nativo, a implementação é o banco SQLCipher de
// encryptedStorage.ts; no web, o IndexedDB.

export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
  /** As chaves que começam com `prefix`. */
  keys(prefix: string): Promise<string[]>
}

/** O storage de um usuário: toda chave leva o id dele. */
export interface UserStorage extends KeyValueStorage {
  readonly userId: string
  /** Apaga tudo deste usuário (logout). */
  clear(): Promise<void>
  /**
   * Fecha: leituras voltam vazias e gravações são ignoradas. Uma gravação
   * atrasada (o throttle do cache) não escreve depois do logout.
   */
  close(): void
}

export function createMemoryStorage(): KeyValueStorage & {
  readonly data: Map<string, string>
} {
  const data = new Map<string, string>()
  return {
    data,
    async getItem(key) {
      return data.get(key) ?? null
    },
    async setItem(key, value) {
      data.set(key, value)
    },
    async removeItem(key) {
      data.delete(key)
    },
    async keys(prefix) {
      return [...data.keys()].filter(k => k.startsWith(prefix))
    },
  }
}

// O id vem do servidor (UUID); mesmo assim a chave só aceita o formato.
const SAFE_ID = /^[A-Za-z0-9-]{1,64}$/

export const userPrefix = (userId: string) => `u:${userId}:`

export function scopeStorage(
  storage: KeyValueStorage,
  userId: string
): UserStorage {
  if (!SAFE_ID.test(userId)) throw new Error('id de usuário inválido')
  const prefix = userPrefix(userId)
  let closed = false
  return {
    userId,
    async getItem(key) {
      return closed ? null : storage.getItem(prefix + key)
    },
    async setItem(key, value) {
      if (!closed) await storage.setItem(prefix + key, value)
    },
    async removeItem(key) {
      await storage.removeItem(prefix + key)
    },
    async keys(sub) {
      if (closed) return []
      const all = await storage.keys(prefix + sub)
      return all.map(k => k.slice(prefix.length))
    },
    async clear() {
      const all = await storage.keys(prefix)
      await Promise.all(all.map(k => storage.removeItem(k)))
    },
    close() {
      closed = true
    },
  }
}
