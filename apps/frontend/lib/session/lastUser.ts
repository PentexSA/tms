import type { KeyValueStorage } from '../../sheet/sync/kv'
import type { LastUserStore, SessionUser } from './session'

// O último usuário no storage do aparelho, fora do escopo por usuário (é ele
// que diz qual escopo abrir). Só id e nome; o que vem do disco é conferido.
const KEY = 'session:lastUser'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function createLastUserStore(storage: KeyValueStorage): LastUserStore {
  return {
    async read() {
      const text = await storage.getItem(KEY)
      if (!text) return null
      try {
        const raw = JSON.parse(text) as Partial<SessionUser> | null
        if (
          raw &&
          typeof raw.id === 'string' &&
          UUID.test(raw.id) &&
          typeof raw.username === 'string' &&
          raw.username.length > 0 &&
          raw.username.length <= 64
        )
          return { id: raw.id, username: raw.username }
      } catch {
        // descartado abaixo
      }
      await storage.removeItem(KEY)
      return null
    },
    async write(user) {
      await storage.setItem(
        KEY,
        JSON.stringify({ id: user.id, username: user.username })
      )
    },
    async clear() {
      await storage.removeItem(KEY)
    },
  }
}
