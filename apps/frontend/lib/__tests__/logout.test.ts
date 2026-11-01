import * as SecureStore from 'expo-secure-store'
import { createMemoryStorage } from '../../sheet/sync/kv'
import { json, memoryStore, testSession, tokens } from '../../test/session'
import { MAX_PENDING_LOGOUTS, type SessionUser } from '../session/session'
import {
  createSessionMarker,
  SESSION_MARKER_KEY,
  type SessionChannel,
} from '../session/sessionMarker'
import {
  tokenStore as nativeStore,
  parsePending,
} from '../session/tokenStore.native'

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
    expect(store.pending()).toEqual(['refresh-1'])
    expect(urls(fetch)).toEqual(['/auth/logout'])
    // A pendência foi gravada antes de o token ativo sair
    const wrote =
      jest.mocked(store.pendingLogout.write).mock.invocationCallOrder[0] ?? 0
    const cleared = jest.mocked(store.clear).mock.invocationCallOrder[0] ?? 0
    expect(wrote).toBeLessThan(cleared)
  })

  it('a revogação pendente vai quando a rede volta e some no 204', async () => {
    const store = memoryStore(true, null, ['refresh-1'])
    const { session, fetch } = testSession(noContent, store)
    expect(await session.retryPendingLogout()).toBe(true)
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://api.test/auth/logout')
    expect(bodyOf(init)).toEqual({ refreshToken: 'refresh-1' })
    expect(store.pending()).toEqual([])
  })

  it.each([
    [500, 'erro do servidor'],
    [503, 'servidor fora'],
  ])('%i (%s) mantém a pendência para reenviar', async status => {
    const store = memoryStore(true, null, ['refresh-1'])
    const { session } = testSession(() => json(status, { error: 'x' }), store)
    expect(await session.retryPendingLogout()).toBe(false)
    expect(store.pending()).toEqual(['refresh-1'])
  })

  // Qualquer 4xx não muda com outra tentativa: encerra, sem laço
  it.each([400, 403, 429])('%i encerra a pendência', async status => {
    const store = memoryStore(true, null, ['refresh-1'])
    const { session, fetch } = testSession(
      () => json(status, { error: 'x' }),
      store
    )
    expect(await session.retryPendingLogout()).toBe(true)
    expect(store.pending()).toEqual([])
    expect(await session.retryPendingLogout()).toBe(true)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  // Revisão de código: com uma posição só, o logout de B apagava a
  // pendência de A, que nunca tinha chegado ao servidor
  it('A pendente, login de B e logout de B sem rede: as duas sessões acabam revogadas', async () => {
    let reachable = false
    const revoked: string[] = []
    // A saiu sem rede; B entra, mas o /auth/logout ainda não alcança
    const store = memoryStore(true, null, ['refresh-a'])
    const { session } = testSession((url, init) => {
      if (!url.endsWith('/auth/logout'))
        return json(200, { ...tokens(), refreshToken: 'refresh-b' })
      if (!reachable) throw new TypeError('Network request failed')
      revoked.push(bodyOf(init).refreshToken)
      return noContent()
    }, store)
    await session.login('bia@example.test', 'senha longa o bastante')
    expect(await session.retryPendingLogout()).toBe(false)
    await session.logout()
    expect(store.pending()).toEqual(['refresh-a', 'refresh-b'])
    reachable = true
    expect(await session.retryPendingLogout()).toBe(true)
    expect(revoked).toEqual(['refresh-a', 'refresh-b'])
    expect(store.pending()).toEqual([])
  })

  it(`guarda até ${MAX_PENDING_LOGOUTS} revogações; a mais antiga sai`, async () => {
    const old = Array.from({ length: MAX_PENDING_LOGOUTS }, (_, n) => `r-${n}`)
    const store = memoryStore(true, 'r-new', old)
    const { session } = testSession(offline, store)
    await session.logout()
    expect(store.pending()).toEqual([...old.slice(1), 'r-new'])
  })

  it('lê o keychain uma vez, não a cada renovação', async () => {
    const store = memoryStore(true, 'refresh-0')
    const { session } = testSession(() => json(200, tokens(2)), store)
    await session.restore()
    await session.refresh()
    await session.refresh()
    expect(store.pendingLogout.read).toHaveBeenCalledTimes(1)
  })

  it('o token pendente nunca vai para /auth/refresh', async () => {
    // Saiu sem rede e entrou de novo: o token novo renova, o pendente só
    // vai para /auth/logout
    const store = memoryStore(true, 'refresh-2', ['refresh-1'])
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
    expect(store.pending()).toEqual([])
  })

  it('app morto entre gravar a pendência e apagar o token: a abertura não renova', async () => {
    const store = memoryStore(true, 'refresh-1', ['refresh-1'])
    const { session, fetch } = testSession(offline, store)
    await session.restore()
    expect(session.getState().status).toBe('signedOut')
    expect(urls(fetch)).toEqual(['/auth/logout'])
    expect(store.value()).toBeNull()
    expect(store.pending()).toEqual(['refresh-1'])
  })

  it('login com pendência entra e revoga a sessão antiga em segundo plano', async () => {
    const store = memoryStore(true, null, ['refresh-1'])
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
    expect(store.pending()).toEqual([])
  })

  it('a pendência usa o keychain só deste aparelho, numa chave à parte', async () => {
    const options = { keychainAccessible: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY' }
    await nativeStore.pendingLogout.write(['t1', 't2'])
    await nativeStore.pendingLogout.read()
    await nativeStore.pendingLogout.write([])
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'tms.pendingLogout',
      '["t1","t2"]',
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

  it('a lista do keychain é conferida', () => {
    expect(parsePending(null)).toEqual([])
    expect(parsePending('["a","b"]')).toEqual(['a', 'b'])
    expect(parsePending('[1,"a",""]')).toEqual(['a'])
    expect(parsePending('token-antigo')).toEqual(['token-antigo'])
    expect(parsePending('[quebrado')).toEqual([])
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
      memoryStore(true, 'refresh-1', ['refresh-1']),
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

  // 403 (Origin fora da allowlist) não muda com outra tentativa: o logout
  // encerra a pendência uma vez só, sem laço. 5xx continua pendente
  it('403 no logout encerra a pendência uma vez só', async () => {
    const tab = web(
      () => json(403, { error: 'origem não permitida' }),
      'signed-in'
    )
    await tab.session.logout()
    expect(tab.state()).toBe('signed-out')
    // Nada mais a enviar: outro "online" ou outra abertura não chamam a rede
    expect(await tab.session.retryPendingLogout()).toBe(true)
    await tab.session.restore()
    expect(urls(tab.fetch)).toEqual(['/auth/logout'])
  })

  it('5xx no logout mantém a pendência para a próxima tentativa', async () => {
    const tab = web(() => json(503, { error: 'fora' }), 'signed-in')
    await tab.session.logout()
    expect(tab.state()).toBe('logout-pending')
    expect(await tab.session.retryPendingLogout()).toBe(false)
    expect(tab.state()).toBe('logout-pending')
  })

  it('400 no reenvio também encerra a pendência', async () => {
    const tab = web(
      () => json(400, { error: 'dados inválidos' }),
      'logout-pending'
    )
    expect(await tab.session.retryPendingLogout()).toBe(true)
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

  // Um canal falso: guarda as mensagens até o teste entregar
  const fakeChannel = () => {
    const listeners = new Set<(userId: string) => void>()
    const queued: string[] = []
    const channel: SessionChannel = {
      post: userId => {
        queued.push(userId)
      },
      subscribe: l => {
        listeners.add(l)
        return () => listeners.delete(l)
      },
    }
    const deliver = () => {
      for (const userId of queued.splice(0))
        for (const l of listeners) l(userId)
    }
    return { channel, deliver }
  }
  const ana = tokens(1).user
  const bia = { id: '00000000-0000-4000-8000-000000000002', username: 'bia' }
  const as = (user: typeof ana) => () =>
    json(200, { ...tokens(), user, refreshToken: undefined })

  it('outra aba do mesmo usuário sai junto (BroadcastChannel)', async () => {
    const { channel, deliver } = fakeChannel()
    const one = web(as(ana), null, channel)
    const other = testSession(as(ana), memoryStore(false), {
      marker: createSessionMarker(one.storage),
      channel,
    })
    await one.session.restore()
    await other.session.restore()
    expect(other.session.getState().status).toBe('signedIn')
    await one.session.logout()
    deliver()
    await new Promise(r => setTimeout(r, 0))
    expect(other.session.getState().status).toBe('signedOut')
    expect(other.session.accessToken).toBeNull()
  })

  // Revisão de código: a aba A sai e entra com outra pessoa antes de B
  // processar o aviso; B já está na sessão nova e não pode sair por ele
  it('aba A sai e entra com outro usuário antes de B processar: B, já na sessão nova, fica', async () => {
    const { channel, deliver } = fakeChannel()
    let user = ana
    const responses = () =>
      json(200, { ...tokens(), user, refreshToken: undefined })
    const a = web(responses, null, channel)
    const b = testSession(responses, memoryStore(false), {
      marker: createSessionMarker(a.storage),
      channel,
    })
    await a.session.restore()
    await b.session.restore()
    await a.session.logout()
    user = bia
    await a.session.login('bia@example.test', 'senha longa o bastante')
    // B renova (cookie compartilhado) antes de o aviso chegar
    await b.session.refresh()
    expect(b.session.getState().user?.id).toBe(bia.id)
    deliver()
    await new Promise(r => setTimeout(r, 0))
    expect(b.session.getState().status).toBe('signedIn')
    expect(b.session.getState().user?.id).toBe(bia.id)
  })

  // Revisão de código: um 401 numa aba velha gravava signed-out depois que
  // outra aba entrou de novo; quem recarregava aparecia deslogado
  it('401 numa aba velha não marca signed-out sobre a sessão nova de outra aba', async () => {
    let release: (r: Response) => void = () => undefined
    let refreshes = 0
    const old = web(url => {
      if (!url.endsWith('/auth/refresh')) return noContent()
      refreshes++
      return refreshes === 1
        ? json(200, { ...tokens(), refreshToken: undefined })
        : new Promise<Response>(r => {
            release = r
          })
    })
    await old.session.restore()
    expect(old.state()).toMatch(/^signed-in:/)
    const renewing = old.session.refresh()
    await new Promise(r => setTimeout(r, 0))
    // Outra aba entra de novo (sessão nova) enquanto a renovação voa
    const fresh = testSession(
      () => json(200, { ...tokens(), refreshToken: undefined }),
      memoryStore(false),
      { marker: createSessionMarker(old.storage) }
    )
    await fresh.session.login('ana@example.test', 'senha longa o bastante')
    const newMark = old.state()
    expect(newMark).toMatch(/^signed-in:/)
    release(json(401, {}))
    expect(await renewing).toBe(false)
    expect(old.session.getState().status).toBe('signedOut')
    expect(old.state()).toBe(newMark)
    // Recarregar renova pela sessão nova, em vez de aparecer deslogado
    const reload = testSession(
      () => json(200, { ...tokens(), refreshToken: undefined }),
      memoryStore(false),
      { marker: createSessionMarker(old.storage) }
    )
    await reload.session.restore()
    expect(urls(reload.fetch)).toEqual(['/auth/refresh'])
    expect(reload.session.getState().status).toBe('signedIn')
  })

  it('401 da sessão desta aba marca signed-out', async () => {
    let refreshes = 0
    const tab = web(() =>
      ++refreshes === 1
        ? json(200, { ...tokens(), refreshToken: undefined })
        : json(401, {})
    )
    await tab.session.restore()
    expect(await tab.session.refresh()).toBe(false)
    expect(tab.state()).toBe('signed-out')
  })

  it('renovar mantém o id da sessão; login abre outro', async () => {
    const tab = web(() => json(200, { ...tokens(), refreshToken: undefined }))
    await tab.session.restore()
    const first = tab.state()
    await tab.session.refresh()
    expect(tab.state()).toBe(first)
    await tab.session.login('ana@example.test', 'senha longa o bastante')
    expect(tab.state()).toMatch(/^signed-in:/)
    expect(tab.state()).not.toBe(first)
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
    expect(inside.state()).toMatch(/^signed-in:/)
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
    expect(tab.state()).toMatch(/^signed-in:/)
    expect(urls(tab.fetch)).toEqual(['/auth/login'])
  })

  it('o marcador só guarda um dos três estados e o id da sessão; lixo vira nenhum', async () => {
    const storage = createMemoryStorage()
    const marker = createSessionMarker(storage)
    for (const junk of [
      '{"token":"x"}',
      'signed-out:x',
      'signed-in:a:b',
      'signed-in:<x>',
    ]) {
      storage.data.set(SESSION_MARKER_KEY, junk)
      expect(await marker.read()).toBeNull()
    }
    await marker.write('signed-out')
    expect(await marker.read()).toEqual({ state: 'signed-out', id: null })
    await marker.write('signed-in', 'abc-123')
    expect(storage.data.get(SESSION_MARKER_KEY)).toBe('signed-in:abc-123')
    expect(await marker.read()).toEqual({ state: 'signed-in', id: 'abc-123' })
  })
})
