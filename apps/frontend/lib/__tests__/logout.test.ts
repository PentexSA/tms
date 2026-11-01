import * as SecureStore from 'expo-secure-store'
import { createMemoryStorage } from '../../sheet/sync/kv'
import { json, memoryStore, testSession, tokens } from '../../test/session'
import type { SessionUser } from '../session/session'
import {
  createSessionMarker,
  SESSION_MARKER_KEY,
  type SessionChannel,
} from '../session/sessionMarker'
import { tokenStore as nativeStore } from '../session/tokenStore.native'

// T-14: o logout sem rede descartava a revogação. No web, o cookie seguia
// válido e recarregar entrava sozinho; no nativo, a família do refresh
// continuava viva no servidor. T-74: a abertura sem sessão chamava
// /auth/refresh e o 401 aparecia como erro no console.

jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}))

const bodyOf = (init: RequestInit) => JSON.parse(String(init.body ?? '{}'))
const urls = (fetch: jest.Mock) =>
  fetch.mock.calls.map(call => String(call[0]).replace('http://api.test', ''))
const offline = () => {
  throw new TypeError('Network request failed')
}
const noContent = () => new Response(null, { status: 204 })

describe('logout no nativo: revogação pendente no keychain', () => {
  it('sem rede, guarda a revogação e apaga o refresh ativo', async () => {
    const store = memoryStore(true, 'refresh-1')
    const { session, fetch } = testSession(offline, store)
    await session.logout()
    expect(session.getState().status).toBe('signedOut')
    expect(store.value()).toBeNull()
    expect(store.pending()).toBe('refresh-1')
    expect(urls(fetch)).toEqual(['/auth/logout'])
    // A pendência foi gravada antes de o token ativo sair
    const wrote =
      jest.mocked(store.pendingLogout.write).mock.invocationCallOrder[0] ?? 0
    const cleared = jest.mocked(store.clear).mock.invocationCallOrder[0] ?? 0
    expect(wrote).toBeLessThan(cleared)
  })

  it('a revogação pendente vai quando a rede volta e some no 204', async () => {
    const store = memoryStore(true, null, 'refresh-1')
    const { session, fetch } = testSession(noContent, store)
    expect(await session.retryPendingLogout()).toBe(true)
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://api.test/auth/logout')
    expect(bodyOf(init)).toEqual({ refreshToken: 'refresh-1' })
    expect(store.pending()).toBeNull()
  })

  it.each([
    [500, 'erro do servidor'],
    [429, 'limite de tentativas'],
  ])('%i (%s) mantém a pendência para reenviar', async status => {
    const store = memoryStore(true, null, 'refresh-1')
    const { session } = testSession(() => json(status, { error: 'x' }), store)
    expect(await session.retryPendingLogout()).toBe(false)
    expect(store.pending()).toBe('refresh-1')
  })

  it('o token pendente nunca vai para /auth/refresh', async () => {
    // Saiu sem rede e entrou de novo: o token novo renova, o pendente só
    // vai para /auth/logout
    const store = memoryStore(true, 'refresh-2', 'refresh-1')
    const { session, fetch } = testSession(
      url =>
        url.endsWith('/auth/logout') ? noContent() : json(200, tokens(3)),
      store
    )
    await session.restore()
    await session.retryPendingLogout()
    for (const call of fetch.mock.calls as [string, RequestInit][]) {
      if (call[0].endsWith('/auth/refresh'))
        expect(bodyOf(call[1])).toEqual({ refreshToken: 'refresh-2' })
      else expect(bodyOf(call[1])).toEqual({ refreshToken: 'refresh-1' })
    }
    expect(urls(fetch)).toContain('/auth/refresh')
    expect(session.getState().status).toBe('signedIn')
    expect(store.pending()).toBeNull()
  })

  it('app morto entre gravar a pendência e apagar o token: a abertura não renova', async () => {
    const store = memoryStore(true, 'refresh-1', 'refresh-1')
    const { session, fetch } = testSession(offline, store)
    await session.restore()
    expect(session.getState().status).toBe('signedOut')
    expect(urls(fetch)).toEqual(['/auth/logout'])
    expect(store.value()).toBeNull()
    expect(store.pending()).toBe('refresh-1')
  })

  it('login com pendência entra e revoga a sessão antiga em segundo plano', async () => {
    const store = memoryStore(true, null, 'refresh-1')
    const { session, fetch } = testSession(
      url =>
        url.endsWith('/auth/logout') ? noContent() : json(200, tokens(2)),
      store
    )
    await session.login('ana@example.test', 'senha longa o bastante')
    expect(session.getState().status).toBe('signedIn')
    await session.retryPendingLogout()
    expect(urls(fetch)).toEqual(['/auth/login', '/auth/logout'])
    expect(store.value()).toBe('refresh-2')
    expect(store.pending()).toBeNull()
  })

  it('a pendência usa o keychain só deste aparelho, numa chave à parte', async () => {
    const options = { keychainAccessible: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY' }
    await nativeStore.pendingLogout.write('t')
    await nativeStore.pendingLogout.read()
    await nativeStore.pendingLogout.clear()
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'tms.pendingLogout',
      't',
      options
    )
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith(
      'tms.pendingLogout',
      options
    )
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
      'tms.pendingLogout',
      options
    )
  })
})

describe('logout espera a limpeza local', () => {
  it('ouvintes assíncronos terminam antes de o logout resolver, mesmo se um falha', async () => {
    const { session } = testSession(noContent, memoryStore(true, 'refresh-1'))
    const done: string[] = []
    session.onSignOut(async () => {
      await new Promise(r => setTimeout(r, 5))
      done.push('cache')
    })
    session.onSignOut(async () => {
      throw new Error('falhou')
    })
    session.onSignOut(() => {
      done.push('fila')
    })
    await session.logout()
    expect(done.sort()).toEqual(['cache', 'fila'])
  })

  it('apaga o que sobrou do storage do último usuário', async () => {
    const user: SessionUser = {
      id: '00000000-0000-4000-8000-000000000001',
      username: 'ana',
    }
    const purgeUserData = jest.fn(async () => undefined)
    const lastUser = {
      read: jest.fn(async () => user),
      write: jest.fn(async () => undefined),
      clear: jest.fn(async () => undefined),
    }
    const { session } = testSession(
      offline,
      memoryStore(true, 'refresh-1', 'refresh-1'),
      { lastUser, purgeUserData }
    )
    await session.restore()
    expect(purgeUserData).toHaveBeenCalledWith(user.id)
  })
})

describe('logout no web: marcador de sessão no IndexedDB', () => {
  const web = (
    responses: Parameters<typeof testSession>[0],
    state: string | null = null,
    channel?: SessionChannel
  ) => {
    const storage = createMemoryStorage()
    if (state) storage.data.set(SESSION_MARKER_KEY, state)
    const marker = createSessionMarker(storage)
    const result = testSession(responses, memoryStore(false), {
      marker,
      channel,
    })
    return {
      ...result,
      storage,
      state: () => storage.data.get(SESSION_MARKER_KEY),
    }
  }

  it('sem rede, marca logout-pending e a abertura não chama /auth/refresh', async () => {
    const tab = web(offline, 'signed-in')
    await tab.session.logout()
    expect(tab.session.getState().status).toBe('signedOut')
    expect(tab.state()).toBe('logout-pending')
    const [, init] = tab.fetch.mock.calls[0] as [string, RequestInit]
    expect(init.credentials).toBe('include')

    // Recarregar (outra instância, o mesmo IndexedDB): continua fora
    const marker = createSessionMarker(tab.storage)
    const reload = testSession(offline, memoryStore(false), { marker })
    await reload.session.restore()
    expect(reload.session.getState().status).toBe('signedOut')
    expect(urls(reload.fetch)).toEqual(['/auth/logout'])
  })

  it('ao voltar a rede, revoga e marca signed-out', async () => {
    const tab = web(noContent, 'logout-pending')
    expect(await tab.session.retryPendingLogout()).toBe(true)
    expect(urls(tab.fetch)).toEqual(['/auth/logout'])
    expect(tab.state()).toBe('signed-out')
  })

  it('uma aba aberta não renova com logout pendente', async () => {
    const tab = web(() => json(200, { ...tokens(), refreshToken: undefined }))
    await tab.session.restore()
    expect(tab.session.getState().status).toBe('signedIn')
    // Outra aba saiu sem rede
    tab.storage.data.set(SESSION_MARKER_KEY, 'logout-pending')
    tab.fetch.mockClear()
    expect(await tab.session.refresh()).toBe(false)
    expect(urls(tab.fetch)).not.toContain('/auth/refresh')
    expect(tab.session.getState().status).toBe('signedOut')
  })

  it('outra aba sai junto (BroadcastChannel)', async () => {
    const listeners = new Set<() => void>()
    const channel: SessionChannel = {
      post: () => {
        for (const l of listeners) l()
      },
      subscribe: l => {
        listeners.add(l)
        return () => listeners.delete(l)
      },
    }
    const ok = () => json(200, { ...tokens(), refreshToken: undefined })
    const one = web(ok, null, channel)
    const other = testSession(ok, memoryStore(false), {
      marker: createSessionMarker(one.storage),
      channel,
    })
    await one.session.restore()
    await other.session.restore()
    expect(other.session.getState().status).toBe('signedIn')
    await one.session.logout()
    await new Promise(r => setTimeout(r, 0))
    expect(other.session.getState().status).toBe('signedOut')
    expect(other.session.accessToken).toBeNull()
  })

  // T-74: sem sessão, nenhum 401 de /auth/refresh no console
  it('abertura com signed-out não chama a rede', async () => {
    const tab = web(() => json(401, {}), 'signed-out')
    await tab.session.restore()
    expect(tab.session.getState().status).toBe('signedOut')
    expect(tab.fetch).not.toHaveBeenCalled()
  })

  it('sem marcador, um refresh, e o resultado fica marcado', async () => {
    const out = web(() => json(401, {}))
    await out.session.restore()
    expect(urls(out.fetch)).toEqual(['/auth/refresh'])
    expect(out.state()).toBe('signed-out')

    const inside = web(() =>
      json(200, { ...tokens(), refreshToken: undefined })
    )
    await inside.session.restore()
    expect(inside.state()).toBe('signed-in')
  })

  it('sem rede na abertura, o marcador não muda', async () => {
    const tab = web(offline, 'signed-in')
    await tab.session.restore()
    expect(tab.state()).toBe('signed-in')
  })

  it('login com logout pendente marca signed-in (o servidor revoga o cookie antigo)', async () => {
    const tab = web(
      () => json(200, { ...tokens(), refreshToken: undefined }),
      'logout-pending'
    )
    await tab.session.login('ana@example.test', 'senha longa o bastante')
    expect(tab.state()).toBe('signed-in')
    expect(urls(tab.fetch)).toEqual(['/auth/login'])
  })

  it('o marcador só guarda um dos três estados; lixo vira nenhum', async () => {
    const storage = createMemoryStorage()
    const marker = createSessionMarker(storage)
    storage.data.set(SESSION_MARKER_KEY, '{"token":"x"}')
    expect(await marker.read()).toBeNull()
    await marker.write('signed-out')
    expect(await marker.read()).toBe('signed-out')
  })
})
