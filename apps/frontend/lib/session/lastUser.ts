import type { KeyValueStorage } from '../../sheet/sync/kv'
import type { LastUserStore, SessionUser } from './session'

// O último usuário no storage do aparelho, fora do escopo por usuário (é ele
// que diz qual escopo abrir). Só id e nome; o que vem do disco é conferido.
const KEY = 'session:lastUser'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Por quanto tempo a sessão offline vale sem falar com o servidor: o mesmo
 * prazo do cache persistido (lib/persist.tsx, CACHE_MAX_AGE_MS). Depois
 * disso, sem rede, o app pede login (fail secure), em vez de abrir os dados
 * de quem talvez já não tenha sessão.
 */
export const LAST_USER_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

export function createLastUserStore(
  storage: KeyValueStorage,
  now: () => number = Date.now
): LastUserStore {
  return {
    async read() {
      const text = await storage.getItem(KEY)
      if (!text) return null
      try {
        const raw = JSON.parse(text) as
          | (Partial<SessionUser> & { savedAt?: unknown })
          | null
        const age =
          raw && typeof raw.savedAt === 'number' ? now() - raw.savedAt : NaN
        if (
          raw &&
          typeof raw.id === 'string' &&
          UUID.test(raw.id) &&
          typeof raw.username === 'string' &&
          raw.username.length > 0 &&
          raw.username.length <= 64 &&
          // Relógio adiantado no disco também não passa
          age >= 0 &&
          age <= LAST_USER_MAX_AGE_MS
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
        JSON.stringify({ id: user.id, username: user.username, savedAt: now() })
      )
    },
    async clear() {
      await storage.removeItem(KEY)
    },
  }
}
