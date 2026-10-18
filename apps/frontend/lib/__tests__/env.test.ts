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
