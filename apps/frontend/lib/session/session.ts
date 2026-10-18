import type { TokenStore } from './tokenStore'

// Sessão do app (doc/plano-v0.md, Etapa 9). O token de acesso vive só em
// memória; o refresh token, no tokenStore (secure store no nativo, cookie
// HttpOnly no web). Um refresh por vez (single-flight): dois em paralelo com o
// mesmo token fariam a API revogar a sessão (reuso de token).

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

export interface SessionDeps {
  readonly apiUrl: string
  readonly store: TokenStore
  readonly fetch: (input: string, init: RequestInit) => Promise<Response>
}

interface TokenResponse {
  readonly accessToken: string
  readonly user: SessionUser
  readonly refreshToken?: string
}

const OFFLINE = 'Não foi possível falar com o servidor. Verifique a conexão.'

export class Session {
  #state: SessionState = { status: 'loading', user: null }
  #accessToken: string | null = null
  #refreshing: Promise<boolean> | null = null
  readonly #listeners = new Set<() => void>()
  readonly #signOutListeners = new Set<() => void>()
  readonly #deps: SessionDeps

  constructor(deps: SessionDeps) {
    this.#deps = deps
  }

  getState = (): SessionState => this.#state

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  /** Chamado ao sair: o app limpa cache e fila do usuário. */
  onSignOut(listener: () => void): () => void {
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

  /** Ao abrir o app: tenta recuperar a sessão. */
  async restore(): Promise<void> {
    if (this.#deps.store.refreshInBody && !(await this.#deps.store.read())) {
      this.#set({ status: 'signedOut', user: null })
      return
    }
    if (!(await this.refresh())) this.#set({ status: 'signedOut', user: null })
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

  async logout(): Promise<void> {
    const token = this.#deps.store.refreshInBody
      ? await this.#deps.store.read()
      : null
    try {
      await this.#post('/auth/logout', token ? { refreshToken: token } : {})
    } catch {
      // Sem rede: a sessão local sai do mesmo jeito
    }
    await this.signOut()
  }

  /** Sai localmente (refresh recusado ou logout): apaga tudo do usuário. */
  async signOut(): Promise<void> {
    this.#accessToken = null
    await this.#deps.store.clear()
    this.#set({ status: 'signedOut', user: null })
    for (const l of this.#signOutListeners) l()
  }

  async #doRefresh(): Promise<boolean> {
    const stored = this.#deps.store.refreshInBody
      ? await this.#deps.store.read()
      : null
    if (this.#deps.store.refreshInBody && !stored) return false
    let res: Response
    try {
      res = await this.#post(
        '/auth/refresh',
        stored ? { refreshToken: stored } : undefined
      )
    } catch {
      // Sem rede não é sessão inválida: mantém o estado e tenta depois
      return false
    }
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) await this.signOut()
      return false
    }
    await this.#accept((await res.json()) as TokenResponse)
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
    await this.#accept(data)
    return data.user
  }

  async #accept(data: TokenResponse): Promise<void> {
    this.#accessToken = data.accessToken
    if (this.#deps.store.refreshInBody && data.refreshToken)
      await this.#deps.store.write(data.refreshToken)
    this.#set({ status: 'signedIn', user: data.user })
  }

  #post(path: string, body?: unknown): Promise<Response> {
    return this.#deps.fetch(`${this.#deps.apiUrl}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(this.#deps.store.refreshInBody ? { 'x-tms-client': 'native' } : {}),
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
