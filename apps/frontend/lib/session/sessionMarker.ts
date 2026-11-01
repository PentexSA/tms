import type { KeyValueStorage } from '../../sheet/sync/kv'

// Estado da sessão do web, sem segredo (T-14, T-74). O refresh do web mora
// num cookie HttpOnly que o JavaScript não lê: o app não sabe sozinho se
// ainda há sessão nem se um logout ficou sem revogar no servidor. O marcador
// diz isso, no storage do aparelho (IndexedDB), fora do escopo do usuário,
// como o session:lastUser. Nunca no localStorage (regra do storage.web.ts).
//
// - signed-in: houve login ou renovação aceitos;
// - signed-out: o servidor recusou a renovação ou revogou no logout. A
//   abertura não chama /auth/refresh (sem 401 de ruído no console);
// - logout-pending: a pessoa saiu e o servidor ainda não revogou. Nenhuma
//   renovação até o logout chegar a ele.
//
// Trocar o valor por script só faz chamar ou não o /auth/refresh, que o
// servidor decide.

export type SessionMarkerState = 'signed-in' | 'signed-out' | 'logout-pending'

export interface SessionMarker {
  read(): Promise<SessionMarkerState | null>
  write(state: SessionMarkerState): Promise<void>
}

export const SESSION_MARKER_KEY = 'session:state'
const STATES: readonly string[] = ['signed-in', 'signed-out', 'logout-pending']

export function createSessionMarker(storage: KeyValueStorage): SessionMarker {
  return {
    async read() {
      const value = await storage.getItem(SESSION_MARKER_KEY)
      return value !== null && STATES.includes(value)
        ? (value as SessionMarkerState)
        : null
    },
    write: state => storage.setItem(SESSION_MARKER_KEY, state),
  }
}

/** Aviso entre abas do mesmo navegador: uma saiu, as outras saem junto. */
export interface SessionChannel {
  post(): void
  subscribe(listener: () => void): () => void
}

// Só o pedaço do BroadcastChannel que o app usa: o app não carrega os tipos
// do DOM (é React Native)
interface BroadcastChannelLike {
  postMessage(message: unknown): void
  addEventListener(type: 'message', l: (e: { data: unknown }) => void): void
  removeEventListener(type: 'message', l: (e: { data: unknown }) => void): void
}

const SIGNED_OUT = 'signed-out'

/** O canal das abas, onde existe (web); sem BroadcastChannel, undefined. */
export function createSessionChannel(
  name = 'tms-session'
): SessionChannel | undefined {
  const Channel = (
    globalThis as unknown as {
      BroadcastChannel?: new (name: string) => BroadcastChannelLike
    }
  ).BroadcastChannel
  if (typeof Channel !== 'function') return undefined
  const channel = new Channel(name)
  return {
    post: () => channel.postMessage(SIGNED_OUT),
    subscribe(listener) {
      const onMessage = (e: { data: unknown }) => {
        if (e.data === SIGNED_OUT) listener()
      }
      channel.addEventListener('message', onMessage)
      return () => channel.removeEventListener('message', onMessage)
    },
  }
}
