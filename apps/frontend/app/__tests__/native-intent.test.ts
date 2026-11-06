import { clearPendingInvite, peekPendingInvite } from '../../lib/invite/pending'
import { redirectSystemPath } from '../+native-intent'

// P12, D-14: o deep link do app. Códigos fictícios.
const CODE = 'ABCD2345EFGH6789JKMN0PQRST'
const UUID = '123e4567-e89b-42d3-a456-426614174000'

beforeEach(() => clearPendingInvite())

describe('redirectSystemPath', () => {
  it.each([
    `tms://join#${CODE}`,
    `tms:///join#${CODE}`,
    `tms://join/#${CODE}`,
    `https://tms.test/join#${CODE}`,
  ])('%s → /join, com o código na memória', path => {
    expect(redirectSystemPath({ path, initial: true })).toBe('/join')
    expect(peekPendingInvite()).toBe(CODE)
  })

  it('join com fragmento inválido: /join, sem guardar', () => {
    expect(redirectSystemPath({ path: 'tms://join#a/b' })).toBe('/join')
    expect(peekPendingInvite()).toBeNull()
  })

  it('outra rota: sem o fragmento e sem guardar o código', () => {
    expect(
      redirectSystemPath({ path: `tms://chronicles/${UUID}#${CODE}` })
    ).toBe(`tms://chronicles/${UUID}`)
    expect(peekPendingInvite()).toBeNull()
  })

  it('sem fragmento, a URL passa como veio', () => {
    expect(redirectSystemPath({ path: `tms://chronicles/${UUID}` })).toBe(
      `tms://chronicles/${UUID}`
    )
    expect(redirectSystemPath({ path: '/join' })).toBe('/join')
  })

  it('o caminho de join não pega rota parecida', () => {
    expect(redirectSystemPath({ path: `tms://joinx#${CODE}` })).toBe(
      'tms://joinx'
    )
    expect(peekPendingInvite()).toBeNull()
  })
})
