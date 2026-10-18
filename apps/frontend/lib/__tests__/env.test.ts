import { apiUrlOf } from '../env'

describe('apiUrlOf', () => {
  it('sem valor, a API local', () => {
    expect(apiUrlOf(undefined)).toBe('http://localhost:3001')
  })

  it('fica só com a origem', () => {
    expect(apiUrlOf('https://api.tms.test/v1/')).toBe('https://api.tms.test')
  })

  it.each(['javascript:alert(1)', 'ftp://x.test'])('recusa %p', raw => {
    expect(() => apiUrlOf(raw)).toThrow('http(s)')
  })
})

describe('shouldRetry', () => {
  const { shouldRetry } =
    require('../queryClient') as typeof import('../queryClient')
  it.each([
    [0, { status: 404 }, false],
    [0, { status: 401 }, false],
    [0, { status: 500 }, true],
    [1, new TypeError('offline'), true],
    [2, { status: 503 }, false],
  ])('tentativa %i com %p → %p', (count, error, expected) => {
    expect(shouldRetry(count, error)).toBe(expected)
  })
})
