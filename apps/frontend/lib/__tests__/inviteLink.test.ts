import { Platform } from 'react-native'

import { WEB_URL, webUrlOf } from '../env'
import { inviteLink, parseInviteFragment, webOrigin } from '../invite/link'

// P12, D-14. Códigos fictícios: nenhum convite real em teste.
const CODE = 'ABCD2345EFGH6789JKMN0PQRST'

describe('parseInviteFragment', () => {
  it('o código depois do #', () => {
    expect(parseInviteFragment(`#${CODE}`)).toBe(CODE)
    expect(parseInviteFragment('#abcd-efgh')).toBe('abcd-efgh')
  })

  it.each([
    ['vazio', ''],
    ['só #', '#'],
    ['sem #', CODE],
    ['barra', '#/chronicles/x'],
    ['query', '#a?b=1'],
    ['por cento', '#a%2Fb'],
    ['espaço', '#ABCD EFGH'],
    ['mais de 64', `#${'A'.repeat(65)}`],
    ['nulo', null],
  ])('%s → null (nada vira caminho)', (_, hash) => {
    expect(parseInviteFragment(hash)).toBeNull()
  })

  it('aceita até 64, o teto do aceite', () => {
    expect(parseInviteFragment(`#${'A'.repeat(64)}`)).toBe('A'.repeat(64))
  })
})

describe('inviteLink', () => {
  it('o código cru no fragmento de /join', () => {
    expect(inviteLink(CODE, 'https://tms.test')).toBe(
      `https://tms.test/join#${CODE}`
    )
  })

  it('tira os espaços do formato da tela', () => {
    expect(inviteLink('ABCD EFGH JK', 'https://tms.test')).toBe(
      'https://tms.test/join#ABCDEFGHJK'
    )
  })
})

describe('origem do web', () => {
  it('sem EXPO_PUBLIC_WEB_URL, a origem da API', () => {
    expect(webUrlOf(undefined, 'https://api.tms.test')).toBe(
      'https://api.tms.test'
    )
  })

  it('com a variável, só a origem', () => {
    expect(webUrlOf('https://tms.test/qualquer/', 'https://api.tms.test')).toBe(
      'https://tms.test'
    )
  })

  it.each(['javascript:alert(1)', 'tms://join'])('recusa %p', raw => {
    expect(() => webUrlOf(raw, 'https://api.tms.test')).toThrow('http(s)')
  })

  it('no app, a do build; no web, a da página', () => {
    expect(webOrigin()).toBe(WEB_URL)
    const os = Platform.OS
    const page = globalThis as { location?: unknown }
    const before = page.location
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true })
    page.location = { origin: 'https://pagina.tms.test' }
    try {
      expect(webOrigin()).toBe('https://pagina.tms.test')
    } finally {
      page.location = before
      Object.defineProperty(Platform, 'OS', { value: os, configurable: true })
    }
  })
})
