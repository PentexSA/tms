import { close } from '@sentry/react'

import { captureError, initTelemetry } from '../telemetry.web'

// A Fase 3 no web: o que o Sentry recebe. O transporte falso guarda o envelope
// serializado, e o canário prova que o texto marcado não está em lugar nenhum.

const EMAIL = 'pessoa.canario@example.test'
const JWT =
  'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJjYW5hcmlvIn0.c2VncmVkby1kby1jYW5hcmlv'
const BEARER_TOKEN = 'tokencanario123'
const NOTE = 'o vampiro esconde a carta da Camarilla'
const BODY_VALUE = 'corpocanario666'
const INVITE = 'convitecanario555'
const CANARIES = [EMAIL, JWT, BEARER_TOKEN, NOTE, 'vampiro', BODY_VALUE, INVITE]

const REQUEST_ID = '123e4567-e89b-42d3-a456-426614174000'

const sent: string[] = []
const transport = () => ({
  send: async (envelope: unknown) => {
    sent.push(JSON.stringify(envelope))
    return {}
  },
  flush: async () => true,
})

const settle = () => new Promise(resolve => setTimeout(resolve, 50))

const eventOf = (envelope: string) => {
  const items = (JSON.parse(envelope) as unknown[])[1] as [unknown, unknown][]
  const found = items.find(
    ([header]) => (header as { type?: string }).type === 'event'
  )
  return found?.[1] as Record<string, any>
}

beforeAll(() => {
  initTelemetry({
    dsn: 'https://chave@o0.ingest.sentry.test/1',
    transport,
  })
})
// O cliente guarda timers (envio de client reports): sem fechar, o Jest não sai
afterAll(() => close())
beforeEach(() => {
  sent.length = 0
})

// O mesmo formato do EdenFetchError: um Error com status e value
class EdenError extends Error {
  constructor(
    readonly status: number,
    readonly value: unknown
  ) {
    super(String(status))
  }
}
const edenError = (status: number, value: unknown) =>
  new EdenError(status, value)

describe('captura', () => {
  it('erro comum chega com a tag da origem e sem campo fora da lista', async () => {
    captureError(
      new Error(`falhou ${EMAIL} com ${JWT} e Bearer ${BEARER_TOKEN}`),
      {
        source: 'boundary',
      }
    )
    await settle()
    expect(sent).toHaveLength(1)
    const envelope = sent[0] as string
    for (const canary of CANARIES) expect(envelope).not.toContain(canary)
    const event = eventOf(envelope)
    expect(event.tags).toEqual({ source: 'boundary' })
    for (const field of ['request', 'user', 'contexts', 'extra', 'modules'])
      expect(event).not.toHaveProperty(field)
    expect(event.exception.values[0].value).toContain('falhou')
  })

  it('5xx do Eden não vai cru: Error HTTP 500, sem o corpo, com o requestId', async () => {
    captureError(
      edenError(500, {
        error: 'erro interno',
        requestId: REQUEST_ID,
        corpo: BODY_VALUE,
        nota: NOTE,
      }),
      { source: 'query', queryKey: ['characters', EMAIL] }
    )
    await settle()
    expect(sent).toHaveLength(1)
    const envelope = sent[0] as string
    for (const canary of CANARIES) expect(envelope).not.toContain(canary)
    const event = eventOf(envelope)
    expect(event.exception.values[0].type).toBe('HttpError')
    expect(event.exception.values[0].value).toBe('HTTP 500')
    expect(event.fingerprint).toEqual(['http', '500', 'characters'])
    expect(event.tags).toEqual({ source: 'query', request_id: REQUEST_ID })
  })

  it('a chave da query com texto livre não entra no agrupamento', async () => {
    captureError(edenError(500, { requestId: REQUEST_ID }), {
      source: 'query',
      queryKey: [EMAIL],
    })
    await settle()
    expect(eventOf(sent[0] as string).fingerprint).toEqual([
      'http',
      '500',
      'unknown',
    ])
  })

  it.each([
    ['4xx', () => edenError(404, { error: 'não encontrado' })],
    ['5xx sem requestId (o 502 do proxy)', () => edenError(502, 'Bad Gateway')],
    ['falha de rede', () => edenError(503, new TypeError('Failed to fetch'))],
    [
      'AbortError',
      () => Object.assign(new Error('aborted'), { name: 'AbortError' }),
    ],
    ['fetch fora do Eden', () => new TypeError('Failed to fetch')],
  ])('%s não gera evento', async (_, make) => {
    captureError(make(), { source: 'query' })
    await settle()
    expect(sent).toEqual([])
  })

  it('sync: só o status e a quantidade de eventos', async () => {
    captureError(new Error('sync recusado: 422'), {
      source: 'sync',
      tags: { status: '422', events: '3', caminho: `values.${NOTE}` },
      fingerprint: ['sync', 'rejected', '422'],
    })
    await settle()
    const envelope = sent[0] as string
    expect(envelope).not.toContain('vampiro')
    expect(eventOf(envelope).tags).toEqual({
      source: 'sync',
      status: '422',
      events: '3',
    })
  })

  it('SyntaxError do JSON.parse: a mensagem, que repete a entrada, não sai', async () => {
    let error: unknown
    try {
      JSON.parse(NOTE)
    } catch (e) {
      error = e
    }
    captureError(error, { source: 'boundary' })
    await settle()
    const envelope = sent[0] as string
    expect(envelope).not.toContain('vampiro')
    expect(eventOf(envelope).exception.values[0].type).toBe('SyntaxError')
  })

  it('o frame sem query nem hash, e UUID vira :id', async () => {
    const error = new Error('x')
    error.stack = `Error: x\n    at f (https://app.test/_expo/static/js/web/entry.js?convite=${INVITE}#${INVITE}:10:5)`
    captureError(error, { source: 'boundary' })
    await settle()
    const envelope = sent[0] as string
    expect(envelope).not.toContain(INVITE)
  })
})
