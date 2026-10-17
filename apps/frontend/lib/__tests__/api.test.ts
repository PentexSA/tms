import { fetchWithTimeout, REQUEST_TIMEOUT_MS, unwrap } from '../api'

/**
 * Testes do cliente HTTP (timeout e tratamento de erro do Eden)
 */

const TODOS_URL = 'http://localhost:3001/todos'

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
    const request = fetchWithTimeout(TODOS_URL)
    jest.advanceTimersByTime(REQUEST_TIMEOUT_MS)

    // Assert
    await expect(request).rejects.toThrow('aborted')
  })

  it('should not abort the request before the timeout', async () => {
    // Act
    const request = fetchWithTimeout(TODOS_URL)
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
    const request = fetchWithTimeout(TODOS_URL, { signal: controller.signal })
    controller.abort()

    // Assert
    await expect(request).rejects.toThrow('aborted')
  })

  it('should clear the timeout when the request finishes', async () => {
    // Arrange
    fetchMock.mockResolvedValueOnce({ ok: true })

    // Act
    await fetchWithTimeout(TODOS_URL)

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
