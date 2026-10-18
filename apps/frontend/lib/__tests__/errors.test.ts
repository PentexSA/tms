import { isNetworkError, messageOf, statusOf } from '../errors'

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
