import * as SecureStore from 'expo-secure-store'
import { json, memoryStore, testSession, tokens } from '../../test/session'
import { createAuthFetch } from '../http'
import { AuthError } from '../session/session'
import type { TokenStore } from '../session/tokenStore'
import { tokenStore as nativeStore } from '../session/tokenStore.native'
import { validateRegister } from '../validation'

jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}))

const bodyOf = (init: RequestInit) => JSON.parse(String(init.body ?? '{}'))

describe('Session (nativo: refresh no corpo, secure store)', () => {
  it('login guarda só o refresh token, nunca o de acesso', async () => {
    const { session, store, fetch } = testSession(() => json(200, tokens()))
    const user = await session.login(
      'ana@example.test',
      'senha longa o bastante'
    )
    expect(user.username).toBe('ana')
    expect(session.getState()).toEqual({ status: 'signedIn', user })
    expect(store.write).toHaveBeenCalledWith('refresh-1')
    expect(store.write).toHaveBeenCalledTimes(1)
    expect(session.accessToken).toBe('access-1')
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://api.test/auth/login')
    expect(init.credentials).toBe('omit')
    expect((init.headers as Record<string, string>)['x-tms-client']).toBe(
      'native'
    )
  })

  it('erro da API vira AuthError com a mensagem genérica dela', async () => {
    const { session } = testSession(() =>
      json(401, { error: 'e-mail ou senha incorretos' })
    )
    await expect(session.login('a@b.test', 'x')).rejects.toEqual(
      new AuthError(401, 'e-mail ou senha incorretos')
    )
    expect(session.getState().status).toBe('loading')
  })

  it('sem rede: mensagem de conexão', async () => {
    const { session } = testSession(() => {
      throw new TypeError('Network request failed')
    })
    await expect(session.login('a@b.test', 'x')).rejects.toMatchObject({
      status: 0,
      message: expect.stringContaining('conexão'),
    })
  })

  it('restore sem token guardado não chama a rede', async () => {
    const { session, fetch } = testSession(() => json(200, tokens()))
    await session.restore()
    expect(fetch).not.toHaveBeenCalled()
    expect(session.getState().status).toBe('signedOut')
  })

  it('restore com token guardado renova a sessão', async () => {
    const store = memoryStore(true, 'refresh-0')
    const { session, fetch } = testSession(() => json(200, tokens(2)), store)
    await session.restore()
    expect(session.getState().status).toBe('signedIn')
    expect(bodyOf(fetch.mock.calls[0]?.[1] as RequestInit)).toEqual({
      refreshToken: 'refresh-0',
    })
    expect(store.value()).toBe('refresh-2')
  })

  it('refresh recusado sai e apaga o token', async () => {
    const store = memoryStore(true, 'refresh-0')
    const { session } = testSession(() => json(401, {}), store)
    const onSignOut = jest.fn()
    session.onSignOut(onSignOut)
    expect(await session.refresh()).toBe(false)
    expect(store.value()).toBeNull()
    expect(session.getState().status).toBe('signedOut')
    expect(onSignOut).toHaveBeenCalledTimes(1)
  })

  it('refresh sem rede não derruba a sessão', async () => {
    const store = memoryStore(true, 'refresh-0')
    const { session } = testSession(() => {
      throw new TypeError('offline')
    }, store)
    expect(await session.refresh()).toBe(false)
    expect(store.value()).toBe('refresh-0')
  })

  it('erro do servidor no refresh não apaga o token', async () => {
    const store = memoryStore(true, 'refresh-0')
    const { session } = testSession(() => json(500, {}), store)
    expect(await session.refresh()).toBe(false)
    expect(store.value()).toBe('refresh-0')
  })

  it('dois refresh ao mesmo tempo fazem uma requisição só', async () => {
    const store = memoryStore(true, 'refresh-0')
    const { session, fetch } = testSession(() => json(200, tokens(2)), store)
    const [a, b] = await Promise.all([session.refresh(), session.refresh()])
    expect(a && b).toBe(true)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('logout avisa o servidor, apaga o token e chama os ouvintes', async () => {
    const store = memoryStore(true, 'refresh-1')
    const { session, fetch } = testSession(
      () => new Response(null, { status: 204 }),
      store
    )
    const onSignOut = jest.fn()
    session.onSignOut(onSignOut)
    await session.logout()
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://api.test/auth/logout')
    expect(bodyOf(init)).toEqual({ refreshToken: 'refresh-1' })
    expect(store.value()).toBeNull()
    expect(onSignOut).toHaveBeenCalled()
    expect(session.headers()).not.toHaveProperty('authorization')
  })

  it('sair com um refresh em voo é definitivo', async () => {
    const store = memoryStore(true, 'refresh-0')
    let release: (r: Response) => void = () => undefined
    const { session, fetch } = testSession(
      url =>
        url.endsWith('/auth/refresh')
          ? new Promise<Response>(r => {
              release = r
            })
          : new Response(null, { status: 204 }),
      store
    )
    const restoring = session.restore()
    await new Promise(r => setTimeout(r, 0))
    await session.logout()
    release(json(200, tokens(2)))
    await restoring
    expect(session.getState().status).toBe('signedOut')
    expect(session.accessToken).toBeNull()
    expect(store.value()).toBeNull()
    expect(fetch.mock.calls.map(c => c[0])).toEqual([
      'http://api.test/auth/refresh',
      'http://api.test/auth/logout',
    ])
  })

  it('logout sem rede sai do mesmo jeito', async () => {
    const store = memoryStore(true, 'refresh-1')
    const { session } = testSession(() => {
      throw new TypeError('offline')
    }, store)
    await session.logout()
    expect(session.getState().status).toBe('signedOut')
  })

  it('cadastro', async () => {
    const { session, fetch } = testSession(() => json(201, tokens()))
    await session.register('ana@example.test', 'ana', 'x'.repeat(15))
    expect(bodyOf(fetch.mock.calls[0]?.[1] as RequestInit)).toEqual({
      email: 'ana@example.test',
      username: 'ana',
      password: 'x'.repeat(15),
    })
  })

  it('subscribe e unsubscribe', async () => {
    const { session } = testSession(() => json(200, tokens()))
    const listener = jest.fn()
    const off = session.subscribe(listener)
    await session.login('a@b.test', 'x')
    off()
    await session.signOut()
    expect(listener).toHaveBeenCalledTimes(1)
  })
})

describe('Session (web: refresh no cookie HttpOnly)', () => {
  it('manda o cookie, não guarda token nenhum e não usa localStorage', async () => {
    const localStorage = { setItem: jest.fn(), getItem: jest.fn() }
    Object.defineProperty(globalThis, 'localStorage', {
      value: localStorage,
      configurable: true,
    })
    try {
      const store = memoryStore(false)
      const { session, fetch } = testSession(
        () => json(200, { ...tokens(), refreshToken: undefined }),
        store
      )
      await session.restore()
      const init = fetch.mock.calls[0]?.[1] as RequestInit
      expect(init.credentials).toBe('include')
      expect(init.body).toBeUndefined()
      expect(session.getState().status).toBe('signedIn')
      expect(store.write).not.toHaveBeenCalled()
      expect(localStorage.setItem).not.toHaveBeenCalled()
      expect(session.headers()).toEqual({ authorization: 'Bearer access-1' })
    } finally {
      Reflect.deleteProperty(globalThis, 'localStorage')
    }
  })

  it('o store do web não guarda nada', async () => {
    // O jest-expo resolve './tokenStore' para o .native; o web é o .ts puro
    const { tokenStore: webStore } = require('../session/tokenStore.ts') as {
      tokenStore: TokenStore
    }
    expect(webStore.refreshInBody).toBe(false)
    await webStore.write('x')
    expect(await webStore.read()).toBeNull()
    await webStore.clear()
  })
})

describe('tokenStore nativo', () => {
  it('usa o keychain só deste aparelho e desbloqueado', async () => {
    const options = { keychainAccessible: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY' }
    // resetMocks zera as implementações da fábrica antes de cada teste
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue('stored')
    expect(await nativeStore.read()).toBe('stored')
    await nativeStore.write('t')
    await nativeStore.clear()
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith(
      'tms.refreshToken',
      options
    )
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'tms.refreshToken',
      't',
      options
    )
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
      'tms.refreshToken',
      options
    )
  })
})

describe('createAuthFetch', () => {
  const fakeSession = (refreshOk = true) => {
    let token = 'a1'
    return {
      headers: () => ({ authorization: `Bearer ${token}` }),
      credentials: 'omit' as const,
      refresh: jest.fn(async () => {
        token = 'a2'
        return refreshOk
      }),
    }
  }
  const authOf = (call: unknown[]) =>
    new Headers((call[1] as RequestInit).headers).get('authorization')

  it('põe o token e repete uma vez depois de renovar num 401', async () => {
    const s = fakeSession()
    const base = jest
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
    const f = createAuthFetch(s, base)
    const res = await f('http://api.test/me', {
      method: 'GET',
      headers: { accept: 'application/json' },
    })
    expect(res.status).toBe(200)
    expect(s.refresh).toHaveBeenCalledTimes(1)
    expect(authOf(base.mock.calls[0])).toBe('Bearer a1')
    expect(authOf(base.mock.calls[1])).toBe('Bearer a2')
    expect(new Headers(base.mock.calls[1][1].headers).get('accept')).toBe(
      'application/json'
    )
  })

  it('refresh recusado devolve o 401 sem repetir', async () => {
    const s = fakeSession(false)
    const base = jest
      .fn()
      .mockResolvedValue(new Response(null, { status: 401 }))
    const res = await createAuthFetch(s, base)('http://api.test/me')
    expect(res.status).toBe(401)
    expect(base).toHaveBeenCalledTimes(1)
  })

  it('rotas /auth/* nunca repetem', async () => {
    const s = fakeSession()
    const base = jest
      .fn()
      .mockResolvedValue(new Response(null, { status: 401 }))
    await createAuthFetch(s, base)(new URL('http://api.test/auth/login'))
    expect(s.refresh).not.toHaveBeenCalled()
  })

  it('DELETE /me não renova: o 401 ali é a resposta à senha', async () => {
    const s = fakeSession()
    const base = jest
      .fn()
      .mockResolvedValue(new Response(null, { status: 401 }))
    const res = await createAuthFetch(s, base)('http://api.test/me', {
      method: 'delete',
      body: JSON.stringify({ password: 'x' }),
    })
    expect(res.status).toBe(401)
    expect(base).toHaveBeenCalledTimes(1)
    expect(s.refresh).not.toHaveBeenCalled()
    // GET /me continua renovando
    await createAuthFetch(s, base)('http://api.test/me', { method: 'GET' })
    expect(s.refresh).toHaveBeenCalledTimes(1)
  })

  it('outros status passam direto', async () => {
    const s = fakeSession()
    const base = jest
      .fn()
      .mockResolvedValue(new Response(null, { status: 403 }))
    expect((await createAuthFetch(s, base)('http://api.test/x')).status).toBe(
      403
    )
    expect(s.refresh).not.toHaveBeenCalled()
  })
})

describe('validateRegister', () => {
  it.each([
    [
      { email: 'ana@example.test', username: 'ana', password: 'x'.repeat(15) },
      {},
    ],
    [
      { email: 'ana', username: 'ana', password: 'x'.repeat(15) },
      { email: 'Informe um e-mail válido' },
    ],
    [
      { email: 'ana@example.test', username: 'Ana', password: 'x'.repeat(15) },
      { username: 'De 3 a 24 caracteres: letras minúsculas, números e _' },
    ],
    [
      { email: 'ana@example.test', username: 'ana', password: 'x'.repeat(14) },
      { password: 'Pelo menos 15 caracteres' },
    ],
    [
      { email: 'ana@example.test', username: 'ana', password: 'x'.repeat(129) },
      { password: 'No máximo 128 caracteres' },
    ],
  ])('%p', (input, errors) => {
    expect(validateRegister(input)).toEqual(errors)
  })
})
