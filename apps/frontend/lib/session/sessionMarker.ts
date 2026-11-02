import type { KeyValueStorage } from '../../sheet/sync/kv'

// Estado da sessão do web, sem segredo (T-14, T-74). O refresh do web mora
// num cookie HttpOnly que o JavaScript não lê: o app não sabe sozinho se
// ainda há sessão nem se um logout ficou sem revogar no servidor. O marcador
// diz isso, no storage do aparelho (IndexedDB), fora do escopo do usuário,
// como o session:lastUser. Nunca no localStorage (regra do storage.web.ts).
//
// - signed-in: houve login ou renovação aceitos. Leva o id da sessão (um
//   por login, aleatório e sem segredo): uma aba que recebe 401 só marca
//   signed-out se o marcador ainda for da sessão dela (outra aba pode ter
//   entrado de novo nesse meio tempo);
// - signed-out: o servidor recusou a renovação ou revogou no logout. A
//   abertura não chama /auth/refresh (sem 401 de ruído no console);
// - logout-pending: a pessoa saiu e o servidor ainda não revogou. Nenhuma
//   renovação até o logout chegar a ele.
//
// Trocar o valor por script só faz chamar ou não o /auth/refresh, que o
// servidor decide.

export type SessionMarkerState = 'signed-in' | 'signed-out' | 'logout-pending'

export interface SessionMark {
  readonly state: SessionMarkerState
  // Só no signed-in: de qual login é a sessão
  readonly id: string | null
}

export interface SessionMarker {
  read(): Promise<SessionMark | null>
  write(state: SessionMarkerState, id?: string): Promise<void>
}

export const SESSION_MARKER_KEY = 'session:state'
const STATES: readonly string[] = ['signed-in', 'signed-out', 'logout-pending']
const ID = /^[A-Za-z0-9-]{1,64}$/

export function createSessionMarker(storage: KeyValueStorage): SessionMarker {
  return {
    async read() {
      const value = await storage.getItem(SESSION_MARKER_KEY)
      if (value === null) return null
      const [state = '', id, ...rest] = value.split(':')
      if (!STATES.includes(state) || rest.length) return null
      if (id === undefined)
        return { state: state as SessionMarkerState, id: null }
      return state === 'signed-in' && ID.test(id)
        ? { state: 'signed-in', id }
        : null
    },
    write: (state, id) =>
      storage.setItem(
        SESSION_MARKER_KEY,
        state === 'signed-in' && id && ID.test(id) ? `${state}:${id}` : state
      ),
  }
}

/**
 * Aviso entre abas do mesmo navegador: um usuário saiu, as abas dele saem
 * junto. A mensagem leva o id de quem saiu; quem recebe só sai se a sessão
 * da aba for desse usuário.
 */
export interface SessionChannel {
  post(userId: string): void
  subscribe(listener: (userId: string) => void): () => void
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
    post: userId => channel.postMessage({ type: SIGNED_OUT, userId }),
    subscribe(listener) {
      const onMessage = ({ data }: { data: unknown }) => {
        const message = data as { type?: unknown; userId?: unknown } | null
        if (message?.type === SIGNED_OUT && typeof message.userId === 'string')
          listener(message.userId)
      }
      channel.addEventListener('message', onMessage)
      return () => channel.removeEventListener('message', onMessage)
    },
  }
}
