/// <reference types="bun-types" />

import { afterEach, describe, expect, it } from 'bun:test'
import { sleep } from 'bun'
import { ApiError } from '../http/errors'
import {
  captureServerError,
  initTelemetry,
  resetTelemetry,
  scrubEvent,
} from '../telemetry'
import { createUser } from '../test/factories'
import { createTestContext, useTestDb } from '../test/helpers'
import {
  BEARER_TOKEN,
  BODY_VALUE,
  CANARIES,
  COOKIE,
  DB_PASSWORD,
  DSN,
  EMAIL,
  fakeTransport,
  HEADER_VALUE,
  JWT,
  NOTE,
  QUERY_VALUE,
} from '../test/telemetry-canary'

// A Fase 3 na app real: o que o Sentry recebe. O transporte falso guarda o
// envelope serializado (o que iria pela rede), e o canário prova que o texto
// marcado não está em lugar nenhum dele, nem nos campos que o SDK preenche.

useTestDb()

const { sent, transport } = fakeTransport()

const start = () => {
  sent.length = 0
  expect(initTelemetry({ dsn: DSN, transport })).toBe(true)
}

afterEach(async () => {
  await resetTelemetry()
})

/** O Sentry envia em segundo plano. */
const envelopes = async (expected: number): Promise<string[]> => {
  for (let i = 0; i < 100 && sent.length < expected; i++) await sleep(5)
  await sleep(20)
  return [...sent]
}

const appThatThrows = async (thrown: () => unknown) => {
  const ctx = await createTestContext()
  const app = ctx.app
    .all('/boom/:id', () => {
      throw thrown()
    })
    .all('/forbidden', () => {
      throw new ApiError(403, 'sem acesso')
    })
  // As rotas depois do guard exigem sessão: o token é de um usuário de verdade
  const { headers: session } = await createUser(ctx)
  return (path: string, init: RequestInit = {}) =>
    app.handle(
      new Request(`http://localhost${path}`, {
        ...init,
        headers: { ...session, ...(init.headers as Record<string, string>) },
      })
    )
}

// O JSON do evento, sem o envelope em volta
const eventOf = (envelope: string) => {
  const items = (JSON.parse(envelope) as unknown[])[1] as [unknown, unknown][]
  const [, payload] = items.find(
    ([header]) => (header as { type?: string }).type === 'event'
  ) as [unknown, Record<string, any>]
  return payload
}

describe('captura de 5xx', () => {
  it('sem init, não envia nada', async () => {
    sent.length = 0
    const handle = await appThatThrows(() => new Error('x'))
    expect((await handle('/boom/1')).status).toBe(500)
    expect(await envelopes(0)).toEqual([])
  })

  it('o 500 chega com as três tags, o release e o servidor fixo', async () => {
    start()
    const handle = await appThatThrows(() => new Error('falhou'))
    const res = await handle('/boom/abc', {
      headers: { 'x-tms-client-version': '1.2.3' },
    })
    const { requestId } = (await res.json()) as { requestId: string }
    const [envelope] = await envelopes(1)
    const event = eventOf(envelope as string)
    expect(event.tags).toEqual({
      'client.version': '1.2.3',
      route: '/boom/:id',
      request_id: requestId,
    })
    expect(event.server_name).toBe('tms-api')
    expect(event.release).toBe('dev')
    expect(event.exception.values.at(-1).type).toBe('Error')
    expect(event.exception.values.at(-1).value).toBe('falhou')
    expect(
      event.exception.values.at(-1).stacktrace.frames.length
    ).toBeGreaterThan(0)
  })

  it('versão inválida do cliente vira unknown', async () => {
    start()
    const handle = await appThatThrows(() => new Error('x'))
    await handle('/boom/1', {
      headers: { 'x-tms-client-version': `${EMAIL}` },
    })
    const event = eventOf((await envelopes(1))[0] as string)
    expect(event.tags['client.version']).toBe('unknown')
  })

  it.each([
    ['ApiError 403', '/forbidden'],
    ['404', '/nao-existe'],
  ])('%s não gera evento', async (_, path) => {
    start()
    const handle = await appThatThrows(() => new Error('x'))
    const res = await handle(path)
    expect(res.status).toBeLessThan(500)
    expect(await envelopes(0)).toEqual([])
  })

  it('valor lançado que não é erro: captura sem lançar nem vazar', async () => {
    start()
    expect(() =>
      captureServerError(NOTE, {
        clientVersion: 'unknown',
        route: null,
        requestId: undefined,
      })
    ).not.toThrow()
    const [envelope] = await envelopes(1)
    expect(envelope).not.toContain('vampiro')
  })
})

describe('canário de privacidade', () => {
  const leaks = (envelope: string) =>
    CANARIES.filter(canary => envelope.includes(canary))

  const run = async (
    thrown: () => unknown,
    init?: RequestInit
  ): Promise<string> => {
    start()
    const handle = await appThatThrows(thrown)
    expect((await handle(`/boom/abc?q=${QUERY_VALUE}`, init)).status).toBe(500)
    const [envelope] = await envelopes(1)
    expect(envelope).toBeDefined()
    return envelope as string
  }

  const request = {
    method: 'POST',
    headers: {
      cookie: COOKIE,
      'x-segredo': HEADER_VALUE,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ senha: BODY_VALUE }),
  }

  it('e-mail, JWT, Bearer e senha da URL na mensagem; cookie, header, query e corpo', async () => {
    const envelope = await run(
      () =>
        new Error(
          `falhou ${EMAIL} com ${JWT} e Bearer ${BEARER_TOKEN} em postgres://usuario:${DB_PASSWORD}@db/tms`
        ),
      request
    )
    expect(envelope).toContain('falhou')
    expect(leaks(envelope)).toEqual([])
  })

  it('Key (email)=(...) do Postgres: só o SQLSTATE', async () => {
    const envelope = await run(
      () =>
        Object.assign(new Error(`Key (email)=(${EMAIL}) already exists`), {
          code: '23505',
          detail: `Key (email)=(${EMAIL}) already exists.`,
        }),
      request
    )
    expect(leaks(envelope)).toEqual([])
    expect(envelope).not.toContain('Key (email)')
    expect(eventOf(envelope).exception.values.at(-1).value).toBe('23505')
  })

  it('SyntaxError real do JSON.parse, que repete a entrada', async () => {
    const envelope = await run(() => {
      try {
        JSON.parse(NOTE)
      } catch (error) {
        return error
      }
      return new Error('o parse deveria falhar')
    }, request)
    expect(leaks(envelope)).toEqual([])
    expect(eventOf(envelope).exception.values.at(-1).type).toBe('SyntaxError')
  })

  it('cause encadeado, em todos os níveis', async () => {
    const envelope = await run(() => {
      const inner = new Error(`dentro ${EMAIL} ${JWT}`)
      const middle = new Error(`meio Bearer ${BEARER_TOKEN}`, { cause: inner })
      return new Error(`fora ${NOTE}`, { cause: middle })
    }, request)
    expect(leaks(envelope.replace(NOTE, ''))).toEqual([])
    const values = eventOf(envelope).exception.values
    expect(values).toHaveLength(3)
  })

  it('nenhum campo fora da lista: request, user, contexts, extra, breadcrumbs', async () => {
    const envelope = await run(() => new Error('x'), request)
    const event = eventOf(envelope)
    for (const field of [
      'request',
      'user',
      'contexts',
      'extra',
      'breadcrumbs',
      'modules',
    ])
      expect(event).not.toHaveProperty(field)
    const frame = event.exception.values.at(-1).stacktrace.frames[0]
    expect(Object.keys(frame).sort()).toEqual(
      expect.arrayContaining(['filename'])
    )
    for (const field of ['vars', 'context_line', 'pre_context', 'abs_path'])
      expect(frame).not.toHaveProperty(field)
  })
})

describe('scrubEvent', () => {
  it('descarta o que o SDK trouxe e não está na lista', () => {
    const event = scrubEvent(
      {
        type: undefined,
        event_id: 'abc',
        message: NOTE,
        request: { cookies: { s: COOKIE }, url: `/x?q=${QUERY_VALUE}` },
        user: { email: EMAIL },
        extra: { corpo: BODY_VALUE },
        tags: { 'client.version': '1.0.0', outra: HEADER_VALUE },
        exception: { values: [{ type: 'Error', value: NOTE }] },
      },
      { originalException: new Error(`oi ${EMAIL}`) }
    )
    const json = JSON.stringify(event)
    for (const canary of CANARIES) expect(json).not.toContain(canary)
    expect(event.tags).toEqual({ 'client.version': '1.0.0' })
    expect(event.server_name).toBe('tms-api')
  })

  it('valor lançado que não é erro não quebra', () => {
    const event = scrubEvent({ type: undefined }, { originalException: NOTE })
    expect(JSON.stringify(event)).not.toContain(NOTE)
  })
})
