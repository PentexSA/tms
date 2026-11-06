import {
  authMessage,
  edenAuthMessage,
  SERVER_ERROR,
  TOO_MANY,
} from '../authMessages'
import { usernameError, validateLogin } from '../validation'

// T-73 (P12): a frase pela situação, genérica contra enumeração.
const REQUEST_ID = '123e4567-e89b-42d3-a456-426614174000'

describe('authMessage', () => {
  it('sem resposta: o texto de conexão que veio', () => {
    expect(authMessage('login', 0, 'sem conexão')).toBe('sem conexão')
    expect(authMessage('join', undefined, 'sem conexão')).toBe('sem conexão')
  })

  it('429 é o mesmo em toda tela', () => {
    for (const screen of ['login', 'register', 'join'] as const)
      expect(authMessage(screen, 429, 'x')).toBe(TOO_MANY)
  })

  it('5xx: a frase do servidor, com o código do erro que já veio', () => {
    expect(
      authMessage('login', 500, 'erro interno (código do erro: 123e4567)')
    ).toBe(`${SERVER_ERROR} (código do erro: 123e4567)`)
    expect(authMessage('register', 503, 'erro')).toBe(SERVER_ERROR)
  })

  it('o status sem frase própria fica com o texto que veio', () => {
    expect(authMessage('login', 418, 'texto')).toBe('texto')
  })
})

describe('edenAuthMessage (o aceite do convite)', () => {
  it('404, 400 e 5xx', () => {
    expect(
      edenAuthMessage('join', { status: 404, value: { error: 'x' } }, 'f')
    ).toMatch(/^Este convite não vale mais/)
    expect(
      edenAuthMessage('join', { status: 400, value: { error: 'x' } }, 'f')
    ).toBe('Confira o código: ele tem letras e números.')
    expect(
      edenAuthMessage(
        'join',
        { status: 500, value: { error: 'x', requestId: REQUEST_ID } },
        'f'
      )
    ).toBe(`${SERVER_ERROR} (código do erro: 123e4567)`)
  })

  it('sem rede: o aviso de conexão', () => {
    expect(
      edenAuthMessage('join', { status: 503, value: new TypeError('x') }, 'f')
    ).toMatch(/conexão/)
  })
})

describe('usernameError', () => {
  it.each([
    ['Lucas Novato', 'Use só letras minúsculas.'],
    ['lucas novato', 'Sem espaços: use _ no lugar.'],
    ['lucás', 'Use letras sem acento, números e _.'],
    ['lu', 'De 3 a 24 caracteres.'],
    ['a'.repeat(25), 'De 3 a 24 caracteres.'],
    ['lucas_novato', undefined],
  ])('%p → %p', (input, expected) => {
    expect(usernameError(input)).toBe(expected)
  })
})

describe('validateLogin', () => {
  it('o e-mail e a senha', () => {
    expect(validateLogin({ email: 'nome@', password: '' })).toEqual({
      email: 'Informe um e-mail válido.',
      password: 'Informe a senha.',
    })
    expect(
      validateLogin({ email: ' nome@example.test ', password: 'x' })
    ).toEqual({})
  })
})
