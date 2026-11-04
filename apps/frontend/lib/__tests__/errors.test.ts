import {
  classifyError,
  isNetworkError,
  messageOf,
  requestIdOf,
  statusOf,
  withErrorCode,
} from '../errors'

// O Eden não lança em erro de rede: devolve status 503 com o erro do fetch em
// `value` (e `response` indefinido). Um 503 de verdade traz o corpo da API.

const network = { status: 503, value: new TypeError('Failed to fetch') }
const server503 = { status: 503, value: { error: 'Serviço indisponível' } }

it('sem resposta é rede, não servidor', () => {
  expect(isNetworkError(network)).toBe(true)
  expect(isNetworkError({ status: 0 })).toBe(true)
  expect(isNetworkError({})).toBe(true)
  expect(isNetworkError(server503)).toBe(false)
  expect(isNetworkError(null)).toBe(false)
  expect(statusOf(network)).toBeUndefined()
  expect(statusOf(server503)).toBe(503)
  expect(statusOf({ status: 404, value: { error: 'x' } })).toBe(404)
})

it('a mensagem vem da API; sem resposta, é a conexão', () => {
  expect(messageOf(network)).toBe(
    'Não foi possível falar com o servidor. Verifique a conexão.'
  )
  expect(messageOf(server503)).toBe('Serviço indisponível')
  expect(messageOf({ status: 500, value: 'texto' }, 'Falhou')).toBe('Falhou')
  expect(messageOf('qualquer')).toBe('Algo deu errado')
})

describe('código do erro', () => {
  const ID = '3f2a9c1e-7b4d-4a10-9e2f-0123456789ab'

  it('500 com id válido: acrescenta os 8 primeiros caracteres', () => {
    expect(
      messageOf({
        status: 500,
        value: { error: 'erro interno', requestId: ID },
      })
    ).toBe('erro interno (código do erro: 3f2a9c1e)')
  })

  it('outro 5xx com id válido também', () => {
    expect(
      messageOf({ status: 503, value: { error: 'fora', requestId: ID } })
    ).toBe('fora (código do erro: 3f2a9c1e)')
  })

  it.each([
    ['sem id', { error: 'erro interno' }],
    ['id que não é UUID', { error: 'erro interno', requestId: 'abc' }],
    ['id com texto', { error: 'erro interno', requestId: `${ID} <b>x</b>` }],
    ['id que não é texto', { error: 'erro interno', requestId: 42 }],
  ])('500 %s: a mensagem fica como está', (_name, value) => {
    expect(messageOf({ status: 500, value })).toBe('erro interno')
  })

  it('502 do proxy, sem corpo da API: o fallback', () => {
    expect(messageOf({ status: 502, value: '<html>' }, 'Falhou')).toBe('Falhou')
  })

  it('4xx nunca leva o código', () => {
    expect(
      messageOf({
        status: 404,
        value: { error: 'não encontrado', requestId: ID },
      })
    ).toBe('não encontrado')
  })

  it('o erro de rede continua primeiro', () => {
    expect(messageOf(network)).toBe(
      'Não foi possível falar com o servidor. Verifique a conexão.'
    )
  })

  it('withErrorCode sem status numérico não muda nada', () => {
    expect(withErrorCode('m', undefined, { requestId: ID })).toBe('m')
    expect(withErrorCode('m', 500, null)).toBe('m')
  })
})

// Fase 3: o que vale enviar ao error tracking
describe('classifyError', () => {
  const ID = '123e4567-e89b-42d3-a456-426614174000'

  it.each([
    ['4xx', { status: 404, value: { error: 'x' } }],
    ['401', { status: 401, value: { error: 'x' } }],
    ['falha de rede do Eden', network],
    ['status 0', { status: 0, value: null }],
    [
      '5xx sem requestId (o 502 do proxy)',
      { status: 502, value: 'Bad Gateway' },
    ],
    [
      '5xx com requestId que não é UUID',
      { status: 500, value: { requestId: 'abc' } },
    ],
    ['5xx com value nulo', { status: 500, value: null }],
    ['AbortError', Object.assign(new Error('x'), { name: 'AbortError' })],
    ['DOMException de abort', { name: 'AbortError', message: 'x' }],
    ['fetch fora do Eden (Chrome)', new TypeError('Failed to fetch')],
    ['fetch fora do Eden (Safari)', new TypeError('Load failed')],
    [
      'fetch fora do Eden (Firefox)',
      new TypeError('NetworkError when attempting to fetch resource.'),
    ],
  ])('%s: ignore', (_, error) => {
    expect(classifyError(error)).toBe('ignore')
  })

  it('5xx com requestId válido é http', () => {
    expect(classifyError({ status: 500, value: { requestId: ID } })).toBe(
      'http'
    )
    expect(classifyError({ status: 503, value: { requestId: ID } })).toBe(
      'http'
    )
  })

  it.each([
    ['Error comum', new Error('x')],
    [
      'TypeError de código',
      new TypeError('Cannot read properties of undefined'),
    ],
    ['valor lançado que não é erro', 'texto'],
    ['null', null],
    ['undefined', undefined],
  ])('%s: bug', (_, error) => {
    expect(classifyError(error)).toBe('bug')
  })

  it('requestIdOf só aceita UUID', () => {
    expect(requestIdOf({ requestId: ID })).toBe(ID)
    expect(requestIdOf({ requestId: 'x' })).toBeUndefined()
    expect(requestIdOf(null)).toBeUndefined()
    expect(requestIdOf('texto')).toBeUndefined()
  })
})
