import { outcomeUnknown } from '../commandKey'

// T-02: a chave do comando só muda quando a intenção termina. Um 502/504 do
// proxy não diz se o servidor gravou: trocar a chave criaria a crônica ou a
// ficha duas vezes na nova tentativa.

const http = (status: number) => ({ status, value: { error: 'x' } })

describe('outcomeUnknown', () => {
  it.each([500, 502, 503, 504, 408, 429])('%i: mantém a chave', status => {
    expect(outcomeUnknown(http(status))).toBe(true)
  })

  it('erro de rede e timeout sem status: mantém a chave', () => {
    expect(
      outcomeUnknown({
        status: 0,
        value: new TypeError('Network request failed'),
      })
    ).toBe(true)
    expect(outcomeUnknown(new Error('timeout'))).toBe(true)
  })

  it.each([400, 401, 403, 404, 409, 422])(
    '%i (recusa terminal): troca a chave',
    status => {
      expect(outcomeUnknown(http(status))).toBe(false)
    }
  )
})
