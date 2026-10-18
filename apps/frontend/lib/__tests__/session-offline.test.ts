import { createMemoryStorage } from '../../sheet/sync/kv'
import { json, memoryStore } from '../../test/session'
import { createLastUserStore } from '../session/lastUser'
import { Session } from '../session/session'

// Etapa 20: sem rede ao abrir o app, a sessão entra com o último usuário
// para a ficha abrir do aparelho; o servidor decide quando a rede voltar.

const USER = { id: '00000000-0000-4000-8000-0000000000a1', username: 'ana' }
const KEY = 'session:lastUser'

function setup(
  respond: () => Response | Promise<Response>,
  refreshToken: string | null = 'refresh'
) {
  const storage = createMemoryStorage()
  const lastUser = createLastUserStore(storage)
  const store = memoryStore(true, refreshToken)
  const fetch = jest.fn(async () => respond())
  const session = new Session({
    apiUrl: 'http://api.test',
    store,
    fetch,
    lastUser,
  })
  return { session, storage, lastUser, store, fetch }
}

const tokens = () =>
  json(200, { accessToken: 'a', refreshToken: 'r2', user: USER })
const offline = () => {
  throw new Error('Network request failed')
}

it('entrar grava o último usuário (só id e nome)', async () => {
  const { session, storage } = setup(tokens)
  await session.restore()
  expect(session.getState()).toEqual({ status: 'signedIn', user: USER })
  expect(JSON.parse(storage.data.get(KEY) ?? '{}')).toEqual(USER)
  expect(storage.data.get(KEY)).not.toContain('r2')
})

it('sem rede, com último usuário: entra sem token de acesso', async () => {
  const { session, lastUser } = setup(offline)
  await lastUser.write(USER)
  await session.restore()
  expect(session.getState()).toEqual({ status: 'signedIn', user: USER })
  expect(session.accessToken).toBeNull()
})

it('sem rede e sem último usuário: login', async () => {
  const { session } = setup(offline)
  await session.restore()
  expect(session.getState().status).toBe('signedOut')
})

it('com rede, refresh recusado: sai e apaga o último usuário', async () => {
  const { session, lastUser, storage } = setup(() =>
    json(401, { error: 'sessão expirada' })
  )
  await lastUser.write(USER)
  await session.restore()
  expect(session.getState().status).toBe('signedOut')
  expect(storage.data.has(KEY)).toBe(false)
})

it('a rede volta e o refresh é recusado: sai (fail secure)', async () => {
  let online = false
  const { session, lastUser, storage } = setup(() =>
    online ? json(401, { error: 'x' }) : offline()
  )
  await lastUser.write(USER)
  await session.restore()
  expect(session.getState().status).toBe('signedIn')
  online = true
  expect(await session.refresh()).toBe(false)
  expect(session.getState().status).toBe('signedOut')
  expect(storage.data.has(KEY)).toBe(false)
})

it('nativo sem refresh token guardado: login, mesmo com último usuário', async () => {
  const { session, lastUser, fetch } = setup(offline, null)
  await lastUser.write(USER)
  await session.restore()
  expect(session.getState().status).toBe('signedOut')
  expect(fetch).not.toHaveBeenCalled()
})

it('sair durante a restauração offline vence', async () => {
  let release: () => void = () => undefined
  const { session, lastUser } = setup(
    () =>
      new Promise<Response>((_, reject) => {
        release = () => reject(new Error('Network request failed'))
      })
  )
  await lastUser.write(USER)
  const restoring = session.restore()
  await Promise.resolve()
  await session.signOut()
  release()
  await restoring
  expect(session.getState().status).toBe('signedOut')
})

describe('último usuário no disco é conferido', () => {
  it.each([
    ['JSON quebrado', '{oi'],
    ['id que não é UUID', JSON.stringify({ id: 'x', username: 'ana' })],
    ['sem nome', JSON.stringify({ id: USER.id, username: '' })],
    ['nome enorme', JSON.stringify({ id: USER.id, username: 'a'.repeat(65) })],
    ['nulo', 'null'],
  ])('%s: descartado', async (_, text) => {
    const storage = createMemoryStorage()
    await storage.setItem(KEY, text)
    const store = createLastUserStore(storage)
    expect(await store.read()).toBeNull()
    expect(storage.data.has(KEY)).toBe(false)
  })

  it('campos a mais não passam', async () => {
    const storage = createMemoryStorage()
    await storage.setItem(KEY, JSON.stringify({ ...USER, token: 'x' }))
    expect(await createLastUserStore(storage).read()).toEqual(USER)
  })

  it('falha do storage não impede entrar nem sair', async () => {
    const broken = {
      read: jest.fn(async () => {
        throw new Error('disco')
      }),
      write: jest.fn(async () => {
        throw new Error('disco')
      }),
      clear: jest.fn(async () => {
        throw new Error('disco')
      }),
    }
    const session = new Session({
      apiUrl: 'http://api.test',
      store: memoryStore(true, 'refresh'),
      fetch: jest.fn(async () => tokens()),
      lastUser: broken,
    })
    await session.restore()
    expect(session.getState().status).toBe('signedIn')
    await session.signOut()
    expect(session.getState().status).toBe('signedOut')

    const offlineSession = new Session({
      apiUrl: 'http://api.test',
      store: memoryStore(true, 'refresh'),
      fetch: jest.fn(async () => offline()),
      lastUser: broken,
    })
    await offlineSession.restore()
    expect(offlineSession.getState().status).toBe('signedOut')
  })
})
