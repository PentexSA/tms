import { fetchWithTimeout, REQUEST_TIMEOUT_MS, unwrap } from '../api'

/**
 * Testes do cliente HTTP (timeout e tratamento de erro do Eden)
 */

const HEALTH_URL = 'http://localhost:3001/health'

describe('fetchWithTimeout', () => {
  const originalFetch = global.fetch
  let fetchMock: jest.Mock

  beforeEach(() => {
    jest.useFakeTimers()
    // fetch que só termina quando o signal é abortado
    fetchMock = jest.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new Error('aborted'))
          )
        })
    )
    global.fetch = fetchMock as unknown as typeof fetch
  })

  afterEach(() => {
    jest.useRealTimers()
    global.fetch = originalFetch
  })

  it('should abort the request after the timeout', async () => {
    // Act
    const request = fetchWithTimeout(HEALTH_URL)
    jest.advanceTimersByTime(REQUEST_TIMEOUT_MS)

    // Assert
    await expect(request).rejects.toThrow('aborted')
  })

  it('should not abort the request before the timeout', async () => {
    // Act
    const request = fetchWithTimeout(HEALTH_URL)
    jest.advanceTimersByTime(REQUEST_TIMEOUT_MS - 1)

    // Assert
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.signal?.aborted).toBe(false)

    jest.advanceTimersByTime(1)
    await expect(request).rejects.toThrow('aborted')
  })

  it('should abort the request when the caller signal aborts', async () => {
    // Arrange
    const controller = new AbortController()

    // Act
    const request = fetchWithTimeout(HEALTH_URL, { signal: controller.signal })
    controller.abort()

    // Assert
    await expect(request).rejects.toThrow('aborted')
  })

  it('should clear the timeout when the request finishes', async () => {
    // Arrange
    fetchMock.mockResolvedValueOnce({ ok: true })

    // Act
    await fetchWithTimeout(HEALTH_URL)

    // Assert
    expect(jest.getTimerCount()).toBe(0)
  })
})

describe('unwrap', () => {
  it('should return data when there is no error', () => {
    expect(unwrap({ data: [1, 2], error: null })).toEqual([1, 2])
  })

  it('should throw the Eden error', () => {
    // Arrange
    const error = { status: 500, value: 'Internal Server Error' }

    // Act & Assert
    expect(() => unwrap({ data: null, error })).toThrow(
      expect.objectContaining({ status: 500 })
    )
  })
})

describe('cliente Eden (T-16)', () => {
  type Client = {
    sessions: { get: () => Promise<{ data: Record<string, unknown> }> }
  }
  const body = {
    date: '2026-11-01',
    title: '01/11/2026',
    at: '2026-11-01T15:04:05.000Z',
  }
  const fetcher = (() =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        headers: { 'content-type': 'application/json' },
      })
    )) as unknown as typeof fetch
  const realTreaty = () =>
    jest.requireActual<typeof import('@elysiajs/eden')>('@elysiajs/eden').treaty

  it('should create the client with parseDate off', () => {
    jest.isolateModules(() => {
      // Arrange: o mock do test/setup.ts guarda a chamada
      const { treaty } = jest.requireMock<{ treaty: jest.Mock }>(
        '@elysiajs/eden'
      )

      // Act
      require('../api')

      // Assert
      expect(treaty).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ parseDate: false })
      )
    })
  })

  it('should keep civil dates and free text as text with parseDate off', async () => {
    // Arrange: o Eden de verdade; só o fetch é falso
    const client = realTreaty()<never>('http://localhost:3001', {
      fetcher,
      parseDate: false,
    }) as unknown as Client

    // Act
    const { data } = await client.sessions.get()

    // Assert
    expect(data).toEqual(body)
  })

  it('should turn the same texts into Date with the Eden default (the cause)', async () => {
    // Arrange
    const client = realTreaty()<never>('http://localhost:3001', {
      fetcher,
    }) as unknown as Client

    // Act
    const { data } = await client.sessions.get()

    // Assert
    expect(data.date).toBeInstanceOf(Date)
    expect(data.title).toBeInstanceOf(Date)
  })
})
