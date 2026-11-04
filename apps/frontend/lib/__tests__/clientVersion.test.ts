import { json, memoryStore, tokens } from '../../test/session'
import { createAuthFetch, fetchWithTimeout } from '../http'
import { Session } from '../session/session'

// O header sai nos dois caminhos do app (Eden, pelo createAuthFetch, e os POST
// de sessão), sem perder o resto dos headers nem o transporte do refresh.

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '7.8.9' } },
}))

const URL_API = 'http://api.test/chronicles'
const HEADER = 'x-tms-client-version'

const originalFetch = global.fetch
let fetchMock: jest.Mock

const sentHeaders = (call = 0) => {
  const [, init] = fetchMock.mock.calls[call] as [string, RequestInit]
  return new Headers(init.headers)
}

beforeEach(() => {
  fetchMock = jest.fn(async () => json(200, tokens()))
  global.fetch = fetchMock as unknown as typeof fetch
})

afterEach(() => {
  global.fetch = originalFetch
})

describe('fetchWithTimeout', () => {
  it('sem headers: só a versão', async () => {
    await fetchWithTimeout(URL_API)
    expect(sentHeaders().get(HEADER)).toBe('7.8.9')
  })

  it.each([
    ['objeto', { 'x-tms-client': 'native', authorization: 'Bearer t' }],
    [
      'Headers',
      new Headers({ 'x-tms-client': 'native', authorization: 'Bearer t' }),
    ],
    [
      'lista',
      [
        ['x-tms-client', 'native'],
        ['authorization', 'Bearer t'],
      ] as [string, string][],
    ],
  ])('preserva os headers recebidos em %s', async (_name, headers) => {
    await fetchWithTimeout(URL_API, { headers })
    const sent = sentHeaders()
    expect(sent.get(HEADER)).toBe('7.8.9')
    expect(sent.get('x-tms-client')).toBe('native')
    expect(sent.get('authorization')).toBe('Bearer t')
  })

  it('Request sem init.headers: os headers dele continuam', async () => {
    const input = new Request(URL_API, { headers: { 'x-outro': 'valor' } })
    await fetchWithTimeout(input)
    const sent = sentHeaders()
    expect(sent.get('x-outro')).toBe('valor')
    expect(sent.get(HEADER)).toBe('7.8.9')
  })

  it('Request com init.headers: valem os do init, como no fetch', async () => {
    const input = new Request(URL_API, { headers: { 'x-outro': 'valor' } })
    await fetchWithTimeout(input, { headers: { 'x-do-init': 'sim' } })
    const sent = sentHeaders()
    expect(sent.get('x-outro')).toBeNull()
    expect(sent.get('x-do-init')).toBe('sim')
    expect(sent.get(HEADER)).toBe('7.8.9')
  })

  it('mantém o resto do init', async () => {
    await fetchWithTimeout(URL_API, { method: 'POST', body: 'corpo' })
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.method).toBe('POST')
    expect(init.body).toBe('corpo')
    expect(init.signal).toBeDefined()
  })
})

describe('caminho do Eden (createAuthFetch)', () => {
  const session = (refresh = jest.fn(async () => true)) => {
    let token = 'velho'
    return {
      refresh: jest.fn(async () => {
        token = 'novo'
        return refresh()
      }),
      credentials: 'omit' as const,
      headers: () => ({
        authorization: `Bearer ${token}`,
        'x-tms-client': 'native',
      }),
    }
  }

  it('leva a versão, o token e o x-tms-client', async () => {
    const authFetch = createAuthFetch(session())
    await authFetch(URL_API, {
      headers: { 'content-type': 'application/json' },
    })
    const sent = sentHeaders()
    expect(sent.get(HEADER)).toBe('7.8.9')
    expect(sent.get('authorization')).toBe('Bearer velho')
    expect(sent.get('x-tms-client')).toBe('native')
    expect(sent.get('content-type')).toBe('application/json')
  })

  it('no 401, a repetição também leva a versão, com o token novo', async () => {
    fetchMock
      .mockResolvedValueOnce(json(401, { error: 'sessão' }))
      .mockResolvedValueOnce(json(200, {}))
    const authFetch = createAuthFetch(session())
    const res = await authFetch(URL_API)
    expect(res.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(sentHeaders(1).get(HEADER)).toBe('7.8.9')
    expect(sentHeaders(1).get('authorization')).toBe('Bearer novo')
  })

  it('o cliente Eden de verdade passa por ele', async () => {
    const { treaty } =
      jest.requireActual<typeof import('@elysiajs/eden')>('@elysiajs/eden')
    const client = treaty<never>('http://api.test', {
      fetcher: createAuthFetch(session()) as typeof fetch,
    }) as unknown as { chronicles: { get: () => Promise<unknown> } }
    await client.chronicles.get()
    expect(sentHeaders().get(HEADER)).toBe('7.8.9')
    expect(sentHeaders().get('authorization')).toBe('Bearer velho')
  })
})

describe('caminho da sessão (POST sem createAuthFetch)', () => {
  const sessionWith = (store: ReturnType<typeof memoryStore>) =>
    new Session({
      apiUrl: 'http://api.test',
      store,
      fetch: fetchWithTimeout,
    })

  it('nativo: login leva a versão e o x-tms-client', async () => {
    await sessionWith(memoryStore()).login('a@b.test', 'senha')
    const sent = sentHeaders()
    expect(sent.get(HEADER)).toBe('7.8.9')
    expect(sent.get('x-tms-client')).toBe('native')
    expect(sent.get('content-type')).toBe('application/json')
  })

  it('nativo: o refresh continua no corpo', async () => {
    await sessionWith(memoryStore(true, 'refresh-0')).refresh()
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://api.test/auth/refresh')
    expect(JSON.parse(String(init.body))).toEqual({ refreshToken: 'refresh-0' })
    expect(init.credentials).toBe('omit')
    expect(sentHeaders().get(HEADER)).toBe('7.8.9')
    expect(sentHeaders().get('x-tms-client')).toBe('native')
  })

  it('web: o refresh vai no cookie, sem x-tms-client', async () => {
    await sessionWith(memoryStore(false)).refresh()
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.body).toBeUndefined()
    expect(init.credentials).toBe('include')
    expect(sentHeaders().get(HEADER)).toBe('7.8.9')
    expect(sentHeaders().get('x-tms-client')).toBeNull()
  })
})
