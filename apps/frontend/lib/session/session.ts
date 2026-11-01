import { NO_STORE_HEADERS } from '../noStore'
import type {
  SessionChannel,
  SessionMark,
  SessionMarker,
  SessionMarkerState,
} from './sessionMarker'
import type { TokenStore } from './tokenStore'

// Sessão do app (doc/plano-v0.md, Etapa 9). O token de acesso vive só em
// memória; o refresh token, no tokenStore (secure store no nativo, cookie
// HttpOnly no web). Um refresh por vez (single-flight): dois em paralelo com o
// mesmo token fariam a API revogar a sessão (reuso de token).
//
// Logout (T-14): registra a revogação pendente, apaga tudo do aparelho e só
// então tenta avisar o servidor. Sem rede, a pendência fica (no keychain no
// nativo; no marcador de sessão no web) e vai na reconexão ou na próxima
// abertura; com ela, nada renova a sessão. Se o app morrer no meio, a
// próxima abertura revoga antes de qualquer outra coisa (fail secure).

export interface SessionUser {
  readonly id: string
  readonly username: string
}

export type SessionStatus = 'loading' | 'signedOut' | 'signedIn'

export interface SessionState {
  readonly status: SessionStatus
  readonly user: SessionUser | null
}

export class AuthError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'AuthError'
    this.status = status
  }
}

/**
 * O último usuário que entrou (id e nome, nunca token): sem rede ao abrir o
 * app, a sessão entra com ele para a ficha abrir do cache do aparelho.
 */
export interface LastUserStore {
  read(): Promise<SessionUser | null>
  write(user: SessionUser): Promise<void>
  clear(): Promise<void>
}

export interface SessionDeps {
  readonly apiUrl: string
  readonly store: TokenStore
  readonly fetch: (input: string, init: RequestInit) => Promise<Response>
  readonly lastUser?: LastUserStore
  // Só no web: o estado da sessão, sem segredo (sessionMarker.ts)
  readonly marker?: SessionMarker
  // Só no web: avisa as outras abas que esta saiu
  readonly channel?: SessionChannel
  // Apaga o que sobrou do storage de um usuário (app morto no meio do
  // logout): sem sessão, ninguém abre o storage dele para apagar
  readonly purgeUserData?: (userId: string) => Promise<void>
  // O id de cada login no marcador (sem segredo); os testes trocam
  readonly newSessionId?: () => string
}

const randomSessionId = (): string =>
  (
    globalThis as { crypto?: { randomUUID?: () => string } }
  ).crypto?.randomUUID?.() ??
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`

/** Ouvinte do logout: o logout espera a limpeza que ele devolver. */
export type SignOutListener = () => void | Promise<unknown>

interface TokenResponse {
  readonly accessToken: string
  readonly user: SessionUser
  readonly refreshToken?: string
}

const OFFLINE = 'Não foi possível falar com o servidor. Verifique a conexão.'

/**
 * Quantas revogações pendentes o nativo guarda (sair de A e de B sem rede).
 * Passando disso, a mais antiga sai da lista: aquela sessão não é revogada
 * agora e vence no servidor no prazo normal (30 dias sem uso, 90 no total).
 * O limite mantém o valor do keychain pequeno.
 */
export const MAX_PENDING_LOGOUTS = 5

/** 2xx revogou; 4xx não vai mudar com outra tentativa. 5xx e rede, sim. */
const terminal = (status: number) =>
  (status >= 200 && status < 300) || (status >= 400 && status < 500)

export class Session {
  #state: SessionState = { status: 'loading', user: null }
  #accessToken: string | null = null
  #refreshing: Promise<boolean> | null = null
  // Um envio da revogação pendente por vez
  #revoking: Promise<boolean> | null = null
  // Nativo: as revogações pendentes, lidas do keychain uma vez e mantidas em
  // memória (só esta sessão grava a chave); as mudanças vão em fila
  #pending: string[] | null = null
  #pendingWrites: Promise<unknown> = Promise.resolve()
  // Web: o id da sessão desta aba no marcador (o do último login ou
  // renovação aceitos aqui)
  #sessionId: string | null = null
  // O último refresh falhou por falta de rede (não por sessão inválida)
  #unreachable = false
  // Sobe a cada saída: resposta de refresh ou login iniciado antes dela é
  // descartada (sair é definitivo, mesmo com uma renovação em voo)
  #epoch = 0
  readonly #listeners = new Set<() => void>()
  readonly #signOutListeners = new Set<SignOutListener>()
  readonly #deps: SessionDeps

  constructor(deps: SessionDeps) {
    this.#deps = deps
    // Outra aba saiu: esta sai também, sem esperar o próximo 401, mas só
    // se for do mesmo usuário (a outra pode já ter entrado com outro)
    deps.channel?.subscribe(userId => {
      if (this.#state.status !== 'signedOut' && this.#state.user?.id === userId)
        void this.#clearLocal()
    })
  }

  getState = (): SessionState => this.#state

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  /**
   * Chamado ao sair: o app limpa cache e fila do usuário. O logout espera a
   * promessa que o ouvinte devolver (todas, mesmo se uma falhar).
   */
  onSignOut(listener: SignOutListener): () => void {
    this.#signOutListeners.add(listener)
    return () => this.#signOutListeners.delete(listener)
  }

  get accessToken(): string | null {
    return this.#accessToken
  }

  /** Cabeçalhos de toda requisição à API. */
  headers(): Record<string, string> {
    return {
      ...(this.#accessToken
        ? { authorization: `Bearer ${this.#accessToken}` }
        : {}),
      ...(this.#deps.store.refreshInBody ? { 'x-tms-client': 'native' } : {}),
    }
  }

  // O web manda o cookie do refresh; o nativo não tem cookie nenhum.
  get credentials(): 'include' | 'omit' {
    return this.#deps.store.refreshInBody ? 'omit' : 'include'
  }

  /**
   * Ao abrir o app: tenta recuperar a sessão. Sem rede, entra com o último
   * usuário (sem token de acesso): a ficha abre do aparelho, e a primeira
   * chamada com rede renova a sessão ou, se o servidor recusar, sai.
   */
  async restore(): Promise<void> {
    // Logout que não chegou ao servidor: revoga antes de tudo e nunca renova
    if (await this.#activeSessionIsPending()) {
      await this.#clearLocal()
      await this.#sendPendingLogout()
      return
    }
    // Revogação de um logout anterior, com outra sessão já ativa (nativo):
    // vai em segundo plano
    void this.#sendPendingLogout()
    if (this.#deps.store.refreshInBody && !(await this.#deps.store.read())) {
      this.#set({ status: 'signedOut', user: null })
      return
    }
    // Web que já saiu: nenhuma chamada, sem 401 de ruído (T-74). Sem
    // marcador (navegador novo ou versão anterior), um refresh, como antes
    if ((await this.#readMarker())?.state === 'signed-out') {
      this.#set({ status: 'signedOut', user: null })
      return
    }
    const epoch = this.#epoch
    if (await this.refresh()) return
    const last = this.#unreachable
      ? await this.#deps.lastUser?.read().catch(() => null)
      : null
    if (epoch !== this.#epoch) return
    if (last) this.#set({ status: 'signedIn', user: last })
    else this.#set({ status: 'signedOut', user: null })
  }

  login(email: string, password: string): Promise<SessionUser> {
    return this.#authenticate('/auth/login', { email, password })
  }

  register(
    email: string,
    username: string,
    password: string
  ): Promise<SessionUser> {
    return this.#authenticate('/auth/register', { email, username, password })
  }

  /** Troca o refresh token. Concorrentes esperam o mesmo resultado. */
  refresh(): Promise<boolean> {
    this.#refreshing ??= this.#doRefresh().finally(() => {
      this.#refreshing = null
    })
    return this.#refreshing
  }

  /**
   * "Sair": registra a revogação pendente, apaga tudo do aparelho e só então
   * avisa o servidor. Sem rede, a revogação fica pendente e vai depois.
   */
  async logout(): Promise<void> {
    const { store } = this.#deps
    const userId = this.#state.user?.id
    if (store.refreshInBody) {
      const token = await store.read()
      // Antes de apagar o token ativo: se o app morrer aqui, a abertura vê
      // o ativo na lista e revoga sem renovar
      if (token)
        await this.#updatePending(tokens =>
          [...tokens.filter(t => t !== token), token].slice(
            -MAX_PENDING_LOGOUTS
          )
        )
    } else await this.#writeMarker('logout-pending')
    await this.#clearLocal()
    if (userId) this.#deps.channel?.post(userId)
    await this.#sendPendingLogout()
  }

  /** Reenvia a revogação pendente (o app chama ao voltar a rede). */
  retryPendingLogout(): Promise<boolean> {
    return this.#sendPendingLogout()
  }

  /**
   * Sai localmente quando a sessão já não vale no servidor (refresh
   * recusado, conta excluída): apaga tudo do usuário.
   */
  async signOut(): Promise<void> {
    await this.#markSignedOut(this.#sessionId)
    await this.#clearLocal()
  }

  /**
   * Marca signed-out só se o marcador ainda for da sessão esperada
   * (compare-and-set): um 401 numa aba velha não derruba a sessão nova que
   * outra aba abriu nesse meio tempo, nem um logout pendente. Ler e gravar
   * no IndexedDB não é atômico entre abas; a janela é a de uma leitura.
   */
  async #markSignedOut(expected: string | null): Promise<void> {
    const mark = await this.#readMarker()
    if (mark?.state === 'logout-pending') return
    if (mark?.state === 'signed-in' && mark.id !== expected) return
    await this.#writeMarker('signed-out')
  }

  /** Apaga tudo do usuário no aparelho e espera os ouvintes. */
  async #clearLocal(): Promise<void> {
    this.#epoch++
    this.#accessToken = null
    await this.#deps.store.clear()
    const last = await this.#deps.lastUser?.read().catch(() => null)
    await this.#deps.lastUser?.clear().catch(() => undefined)
    this.#set({ status: 'signedOut', user: null })
    await Promise.allSettled(
      [...this.#signOutListeners].map(async listener => listener())
    )
    if (last) await this.#deps.purgeUserData?.(last.id).catch(() => undefined)
  }

  /**
   * Nativo: o token ativo é o da revogação pendente (o app morreu entre
   * gravar a pendência e apagá-lo). Web: o marcador diz que o logout não
   * chegou ao servidor. Nos dois casos, nada pode renovar a sessão.
   */
  async #activeSessionIsPending(): Promise<boolean> {
    const { store } = this.#deps
    if (!store.refreshInBody)
      return (await this.#readMarker())?.state === 'logout-pending'
    const pending = await this.#pendingTokens()
    if (pending.length === 0) return false
    const active = await store.read()
    return active !== null && pending.includes(active)
  }

  /** Nativo: a lista de revogações pendentes (do keychain, uma vez). */
  async #pendingTokens(): Promise<readonly string[]> {
    if (this.#pending === null) {
      const stored = await this.#deps.store.pendingLogout
        .read()
        .catch(() => [] as readonly string[])
      this.#pending ??= [...stored]
    }
    return this.#pending
  }

  /** Muda a lista em fila: duas mudanças nunca leem a mesma versão. */
  #updatePending(change: (tokens: string[]) => string[]): Promise<void> {
    const run = this.#pendingWrites.then(async () => {
      const next = change([...(await this.#pendingTokens())])
      this.#pending = next
      try {
        await this.#deps.store.pendingLogout.write(next)
      } catch (error) {
        // O disco pode ter ficado diferente: a próxima leitura confere
        this.#pending = null
        throw error
      }
    })
    this.#pendingWrites = run.catch(() => undefined)
    return run
  }

  #sendPendingLogout(): Promise<boolean> {
    this.#revoking ??= this.#doSendPendingLogout().finally(() => {
      this.#revoking = null
    })
    return this.#revoking
  }

  /** true quando não sobra revogação pendente. */
  async #doSendPendingLogout(): Promise<boolean> {
    if (this.#deps.store.refreshInBody) return this.#sendNativePending()
    if ((await this.#readMarker())?.state !== 'logout-pending') return true
    const status = await this.#postLogout({})
    // 5xx e falta de rede: fica pendente para a reconexão e a próxima
    // abertura. 2xx revogou; 4xx (por exemplo, 403 de Origin) não muda com
    // outra tentativa e encerra a pendência, sem laço
    if (status === null || !terminal(status)) return false
    if ((await this.#readMarker())?.state === 'logout-pending')
      await this.#writeMarker('signed-out')
    return true
  }

  /** Nativo: envia todas; cada uma sai da lista só no 2xx ou no 4xx. */
  async #sendNativePending(): Promise<boolean> {
    let left = false
    for (const token of [...(await this.#pendingTokens())]) {
      const status = await this.#postLogout({ refreshToken: token })
      // Sem rede, as outras também não vão: tenta tudo de novo depois
      if (status === null) return false
      if (!terminal(status)) {
        left = true
        continue
      }
      await this.#updatePending(tokens => tokens.filter(t => t !== token))
    }
    return !left
  }

  /** O status do POST /auth/logout, ou null sem resposta (rede). */
  async #postLogout(body: { refreshToken?: string }): Promise<number | null> {
    try {
      return (await this.#post('/auth/logout', body)).status
    } catch {
      return null
    }
  }

  async #readMarker(): Promise<SessionMark | null> {
    return (await this.#deps.marker?.read().catch(() => null)) ?? null
  }

  async #writeMarker(state: SessionMarkerState, id?: string): Promise<void> {
    await this.#deps.marker?.write(state, id).catch(() => undefined)
  }

  async #doRefresh(): Promise<boolean> {
    const epoch = this.#epoch
    // Com logout pendente nenhuma aba renova: o marcador é lido a cada
    // renovação, não só ao abrir
    if (await this.#activeSessionIsPending()) {
      if (this.#state.status !== 'signedOut') await this.#clearLocal()
      return false
    }
    const stored = this.#deps.store.refreshInBody
      ? await this.#deps.store.read()
      : null
    if (this.#deps.store.refreshInBody && !stored) return false
    // De qual sessão o marcador era quando a renovação saiu (compare-and-set
    // do 401 abaixo)
    const seen = (await this.#readMarker())?.id ?? null
    let res: Response
    try {
      res = await this.#post(
        '/auth/refresh',
        stored ? { refreshToken: stored } : undefined
      )
    } catch {
      // Sem rede não é sessão inválida: mantém o estado e tenta depois
      this.#unreachable = true
      return false
    }
    this.#unreachable = false
    if (epoch !== this.#epoch) return false
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        await this.#markSignedOut(seen)
        await this.#clearLocal()
      }
      return false
    }
    const data = (await res.json()) as TokenResponse
    if (epoch !== this.#epoch) return false
    await this.#accept(data, 'refresh')
    return true
  }

  async #authenticate(path: string, body: unknown): Promise<SessionUser> {
    let res: Response
    try {
      res = await this.#post(path, body)
    } catch {
      throw new AuthError(0, OFFLINE)
    }
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: unknown }
      throw new AuthError(
        res.status,
        typeof data.error === 'string' ? data.error : OFFLINE
      )
    }
    const data = (await res.json()) as TokenResponse
    await this.#accept(data, 'login')
    return data.user
  }

  async #accept(data: TokenResponse, how: 'login' | 'refresh'): Promise<void> {
    this.#accessToken = data.accessToken
    if (this.#deps.store.refreshInBody && data.refreshToken)
      await this.#deps.store.write(data.refreshToken)
    // No web, o login já revogou no servidor o cookie anterior. Login abre
    // uma sessão nova (id novo); a renovação continua a do marcador
    if (this.#deps.marker) {
      const mark = how === 'refresh' ? await this.#readMarker() : null
      if (mark?.state === 'signed-in' && mark.id) this.#sessionId = mark.id
      else {
        this.#sessionId = (this.#deps.newSessionId ?? randomSessionId)()
        await this.#writeMarker('signed-in', this.#sessionId)
      }
    }
    await this.#deps.lastUser?.write(data.user).catch(() => undefined)
    this.#set({ status: 'signedIn', user: data.user })
    // Nativo: a revogação de um logout anterior segue sem travar o login
    void this.#sendPendingLogout()
  }

  #post(path: string, body?: unknown): Promise<Response> {
    return this.#deps.fetch(`${this.#deps.apiUrl}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(this.#deps.store.refreshInBody ? { 'x-tms-client': 'native' } : {}),
        // Só no nativo: a resposta com tokens não vai para o cache HTTP (T-13)
        ...NO_STORE_HEADERS,
      },
      credentials: this.credentials,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  }

  #set(state: SessionState) {
    this.#state = state
    for (const l of this.#listeners) l()
  }
}
