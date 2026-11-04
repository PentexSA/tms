/// <reference types="bun-types" />

import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test'
import { sleep } from 'bun'
import { ApiError } from '../http/errors'
import { logger } from '../logger'
import { createUser } from '../test/factories'
import { createTestContext, type TestContext, useTestDb } from '../test/helpers'

// A Fase 2 na app real (createApp): o id em toda resposta, o log de um 500 e o
// canário de privacidade. O spy vê o objeto logado antes de qualquer filtro do
// Pino, e o JSON.stringify prova que o texto marcado não está em lugar nenhum.

useTestDb()

const ORIGIN = 'https://app.tms.test'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

const EMAIL = 'pessoa.canario@example.test'
const JWT =
  'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJjYW5hcmlvIn0.c2VncmVkby1kby1jYW5hcmlv'
const BEARER_TOKEN = 'tokencanario123'
const DB_PASSWORD = 'senha-canario'
const NOTE = 'o vampiro esconde a carta da Camarilla'
const CANARIES = [EMAIL, JWT, BEARER_TOKEN, DB_PASSWORD, NOTE, 'vampiro']

const LEVELS = ['error', 'warn', 'info', 'debug'] as const
type Level = (typeof LEVELS)[number]
type Call = readonly [Line, string?]
interface Spy {
  readonly mock: { readonly calls: readonly Call[] }
  mockClear(): void
  mockRestore(): void
}
type Spies = Record<Level, Spy>
type Line = Record<string, unknown>

let spies: Spies

beforeEach(() => {
  spies = Object.fromEntries(
    LEVELS.map(level => [level, spyOn(logger, level)])
  ) as unknown as Spies
})

afterEach(() => {
  for (const level of LEVELS) spies[level].mockRestore()
})

const allLogged = () =>
  JSON.stringify(LEVELS.map(level => spies[level].mock.calls))

/** As linhas de acesso (as que têm `method`) de um nível. */
const accessLines = (level: Level): Line[] =>
  spies[level].mock.calls
    .map(call => call[0])
    .filter(line => line?.method !== undefined)

/** O onAfterResponse roda depois de o `handle` devolver a resposta. */
const accessLine = async (level: Level): Promise<Line> => {
  for (let i = 0; i < 50 && accessLines(level).length === 0; i++) await sleep(1)
  const line = accessLines(level).at(-1)
  if (!line) throw new Error(`sem linha de acesso em ${level}`)
  return line
}

/** A linha do onError, separada da de acesso. */
const detailLine = (): Line => {
  const call = spies.error.mock.calls.find(c => c[1] === 'erro interno')
  if (!call) throw new Error('sem a linha do onError')
  return call[0]
}

const settle = () => sleep(5)

const request = (path: string, init?: RequestInit) =>
  new Request(`http://localhost${path}`, init)

/**
 * As rotas depois do guard exigem sessão, inclusive as que o teste acrescenta:
 * este `handle` manda o token de um usuário de verdade.
 */
const signedIn = async (ctx: TestContext) => {
  const { headers } = await createUser(ctx)
  return (path: string, init: RequestInit = {}) =>
    request(path, {
      ...init,
      headers: { ...headers, ...(init.headers as Record<string, string>) },
    })
}

const appThatThrows = async (thrown: () => unknown) => {
  const ctx = await createTestContext({ corsOrigins: [ORIGIN] })
  const app = ctx.app.get('/boom/:id', () => {
    throw thrown()
  })
  const signed = await signedIn(ctx)
  return {
    handle: (path: string, init?: RequestInit) =>
      app.handle(signed(path, init)),
  }
}

describe('x-request-id em toda resposta', () => {
  it('200', async () => {
    const { app } = await createTestContext()
    const res = await app.handle(request('/health'))
    expect(res.status).toBe(200)
    expect(res.headers.get('x-request-id')).toMatch(UUID)
  })

  it('400 (PARSE)', async () => {
    const { app } = await createTestContext()
    const res = await app.handle(
      request('/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{ não é json',
      })
    )
    expect(res.status).toBe(400)
    expect(res.headers.get('x-request-id')).toMatch(UUID)
    expect(await res.json()).toEqual({ error: 'corpo inválido' })
  })

  it('400 (VALIDATION)', async () => {
    const { app } = await createTestContext()
    const res = await app.handle(
      request('/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 1 }),
      })
    )
    expect(res.status).toBe(400)
    expect(res.headers.get('x-request-id')).toMatch(UUID)
  })

  it('404 em rota inexistente, com id no log e tempo de resposta', async () => {
    const { app } = await createTestContext()
    const res = await app.handle(request('/nao-existe'))
    expect(res.status).toBe(404)
    const id = res.headers.get('x-request-id')
    expect(id).toMatch(UUID)
    const line = await accessLine('info')
    expect(line.requestId).toBe(id)
    expect(line.responseTime).toBeNumber()
  })

  it('500: o id do header, do corpo e das duas linhas de log é o mesmo', async () => {
    const app = await appThatThrows(() => new TypeError('falhou'))
    const res = await app.handle('/boom/abc')
    expect(res.status).toBe(500)

    const id = res.headers.get('x-request-id')
    expect(id).toMatch(UUID)
    expect(await res.json()).toEqual({ error: 'erro interno', requestId: id })

    const access = await accessLine('error')
    expect(access.requestId).toBe(id)
    expect(access.status).toBe(500)

    const detail = detailLine()
    expect(detail.requestId).toBe(id)
    const error = detail.error as Line
    expect(error.name).toBe('TypeError')
    expect(error.message).toBe('falhou')
    expect(error.stack).toContain('at ')
    expect(detail.err).toBeUndefined()
  })

  it('só o 500 leva o id no corpo', async () => {
    const app = await appThatThrows(() => new ApiError(403, 'proibido'))
    const res = await app.handle('/boom/abc')
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'proibido' })
    const notFound = await app.handle('/nao-existe')
    expect(await notFound.json()).toEqual({ error: 'não encontrado' })
  })

  it('cada requisição tem o seu id', async () => {
    const { app } = await createTestContext()
    const [a, b] = await Promise.all([
      app.handle(request('/health')),
      app.handle(request('/health')),
    ])
    expect(a.headers.get('x-request-id')).not.toBe(
      b.headers.get('x-request-id')
    )
  })

  it('o id do cliente não é aceito', async () => {
    const { app } = await createTestContext()
    const res = await app.handle(
      request('/health', { headers: { 'x-request-id': 'id-do-cliente' } })
    )
    expect(res.headers.get('x-request-id')).toMatch(UUID)
  })
})

describe('canário de privacidade', () => {
  const expectNoLeak = () => {
    const logged = allLogged()
    for (const canary of CANARIES) expect(logged).not.toContain(canary)
  }

  it('erro comum', async () => {
    const app = await appThatThrows(
      () =>
        new Error(
          `falhou ${EMAIL} com ${JWT} e Bearer ${BEARER_TOKEN} em postgres://usuario:${DB_PASSWORD}@db/tms`
        )
    )
    const res = await app.handle('/boom/abc')
    expect(res.status).toBe(500)
    await accessLine('error')
    expect(allLogged()).toContain('falhou')
    expectNoLeak()
    expect(await res.text()).not.toContain('falhou')
  })

  it('SyntaxError real do JSON.parse', async () => {
    const app = await appThatThrows(() => {
      try {
        JSON.parse(NOTE)
      } catch (e) {
        return e
      }
    })
    await app.handle('/boom/abc')
    await accessLine('error')
    expect(allLogged()).toContain('SyntaxError')
    expectNoLeak()
  })

  it('cause aninhado', async () => {
    const app = await appThatThrows(
      () =>
        new Error('camada de fora', {
          cause: new Error(`meio: ${EMAIL}`, {
            cause: (() => {
              try {
                JSON.parse(NOTE)
              } catch (e) {
                return e
              }
            })(),
          }),
        })
    )
    await app.handle('/boom/abc')
    await accessLine('error')
    const logged = allLogged()
    expect(logged).toContain('camada de fora')
    expect(logged).toContain('SyntaxError')
    expectNoLeak()
  })

  it('valor que não é Error e getter que lança não derrubam a resposta', async () => {
    // Em `code` não dá para testar aqui: o próprio Elysia lê essa propriedade
    // antes de chamar o onError. safe-error.test.ts cobre o filtro sozinho
    const app = await appThatThrows(() =>
      Object.defineProperty(new Error('x'), 'stack', {
        get() {
          throw new Error(NOTE)
        },
      })
    )
    const res = await app.handle('/boom/abc')
    expect(res.status).toBe(500)
    await accessLine('error')
    expectNoLeak()

    const text = await appThatThrows(() => NOTE)
    expect((await text.handle('/boom/abc')).status).toBe(500)
    await settle()
    expectNoLeak()
  })

  it('constraint única real em PGLite: sai o 23505 e nada do valor', async () => {
    const ctx = await createTestContext()
    const user = {
      email: EMAIL,
      username: 'canario',
      hashed_password: 'hash',
    }
    const app = ctx.app.get('/dup', async () => {
      await ctx.db.insertInto('users').values(user).execute()
      await ctx.db.insertInto('users').values(user).execute()
    })

    const signed = await signedIn(ctx)
    const res = await app.handle(signed('/dup'))
    expect(res.status).toBe(500)
    await accessLine('error')

    const error = detailLine().error as Line
    expect(error.code).toBe('23505')
    expect(error.message).toBeUndefined()
    const logged = allLogged()
    expect(logged).not.toContain('duplicate')
    expect(logged).not.toContain('Key (')
    expectNoLeak()
  })

  it('a requisição não vai para o log: nem header nem corpo', async () => {
    const { app } = await createTestContext()
    await app.handle(
      request(`/auth/login`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${BEARER_TOKEN}`,
        },
        body: JSON.stringify({ email: EMAIL, password: DB_PASSWORD }),
      })
    )
    await settle()
    expectNoLeak()
  })
})

describe('log de acesso', () => {
  it.each([
    ['500', () => new Error('x'), 500, 'error'],
    ['503 (ApiError)', () => new ApiError(503, 'fora'), 503, 'error'],
    ['429', () => new ApiError(429, 'calma'), 429, 'warn'],
    ['403', () => new ApiError(403, 'não'), 403, 'info'],
    ['404', () => new ApiError(404, 'não'), 404, 'info'],
  ] as const)('%s', async (_name, thrown, status, level) => {
    const app = await appThatThrows(thrown)
    await app.handle('/boom/abc')
    const line = await accessLine(level)
    expect(line.status).toBe(status)
    for (const other of LEVELS.filter(l => l !== level))
      expect(accessLines(other)).toEqual([])
  })

  it('429 real do rate limit', async () => {
    const { app } = await createTestContext({ corsOrigins: [ORIGIN] })
    const login = () =>
      app.handle(
        request('/auth/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            email: EMAIL,
            password: 'senha-errada-longa',
          }),
        })
      )
    let res = await login()
    for (let i = 0; i < 40 && res.status !== 429; i++) res = await login()
    expect(res.status).toBe(429)
    expect((await accessLine('warn')).status).toBe(429)
  })

  it('status por nome vira número', async () => {
    const ctx = await createTestContext()
    const signed = await signedIn(ctx)
    const route = ctx.app
      .get('/nome', ({ set }) => {
        set.status = 'Service Unavailable'
        return 'fora'
      })
      .get('/texto', ({ set }) => {
        ;(set as { status: unknown }).status = 'qualquer coisa'
        return 'ok'
      })
    await route.handle(signed('/nome'))
    expect((await accessLine('error')).status).toBe(503)

    await route.handle(signed('/texto'))
    const line = await accessLine('info')
    expect(line.status).toBeNull()
  })

  it('route traz o template; em rota inexistente, null', async () => {
    const app = await appThatThrows(() => new ApiError(404, 'não'))
    await app.handle('/boom/uuid-de-verdade')
    const line = await accessLine('info')
    expect(line.route).toBe('/boom/:id')
    expect(line.path).toBe('/boom/uuid-de-verdade')

    spies.info.mockClear()
    await app.handle('/nao-existe')
    const missing = await accessLine('info')
    expect(missing.route).toBeNull()
    expect(missing.status).toBe(404)
  })

  it('200 sai em info, com o status numérico', async () => {
    const ctx = await createTestContext()
    const signed = await signedIn(ctx)
    const res = await ctx.app.handle(signed('/me'))
    expect(res.status).toBe(200)
    const line = await accessLine('info')
    expect(line.status).toBe(200)
    expect(line.route).toBe('/me')
  })

  it('/health fica de fora, mesmo com o resto logado', async () => {
    const { app } = await createTestContext()
    await app.handle(request('/health'))
    await settle()
    expect(accessLines('info')).toEqual([])
    await app.handle(request('/nao-existe'))
    expect((await accessLine('info')).path).toBe('/nao-existe')
  })

  it.each([
    ['válida', { 'x-tms-client-version': '1.2.1' }, '1.2.1'],
    ['ausente', {}, 'unknown'],
    ['fora do formato', { 'x-tms-client-version': 'v1.2' }, 'unknown'],
    ['longa demais', { 'x-tms-client-version': '12345.1.1' }, 'unknown'],
    [
      'com injeção',
      { 'x-tms-client-version': '1.2.3 {"level":60}' },
      'unknown',
    ],
  ] as const)('clientVersion %s', async (_name, headers, expected) => {
    const { app } = await createTestContext()
    const res = await app.handle(request('/nao-existe', { headers }))
    expect(res.status).toBe(404)
    expect((await accessLine('info')).clientVersion).toBe(expected)
  })
})

describe('CORS', () => {
  const preflight = (origin: string, headers: string) =>
    request('/auth/login', {
      method: 'OPTIONS',
      headers: {
        origin,
        'access-control-request-method': 'POST',
        'access-control-request-headers': headers,
      },
    })

  it('o preflight aceita x-tms-client-version', async () => {
    const { app } = await createTestContext({ corsOrigins: [ORIGIN] })
    const res = await app.handle(preflight(ORIGIN, 'x-tms-client-version'))
    expect(res.status).toBe(204)
    expect(res.headers.get('access-control-allow-origin')).toBe(ORIGIN)
    expect(res.headers.get('access-control-allow-headers')).toContain(
      'x-tms-client-version'
    )
  })

  it('os headers que o navegador manda continuam aceitos', async () => {
    const { app } = await createTestContext({ corsOrigins: [ORIGIN] })
    const res = await app.handle(preflight(ORIGIN, 'authorization'))
    const allowed = res.headers.get('access-control-allow-headers')
    for (const header of ['content-type', 'authorization', 'x-tms-client'])
      expect(allowed).toContain(header)
  })

  it('o 500 de outra origem traz o id, legível pelo navegador', async () => {
    const app = await appThatThrows(() => new Error('x'))
    const res = await app.handle('/boom/abc', { headers: { origin: ORIGIN } })
    expect(res.status).toBe(500)
    expect(res.headers.get('x-request-id')).toMatch(UUID)
    expect(res.headers.get('access-control-allow-origin')).toBe(ORIGIN)
    expect(res.headers.get('access-control-expose-headers')).toContain(
      'x-request-id'
    )
  })

  it('o 404 de outra origem também', async () => {
    const { app } = await createTestContext({ corsOrigins: [ORIGIN] })
    const res = await app.handle(
      request('/nao-existe', { headers: { origin: ORIGIN } })
    )
    expect(res.status).toBe(404)
    expect(res.headers.get('x-request-id')).toMatch(UUID)
    expect(res.headers.get('access-control-expose-headers')).toContain(
      'x-request-id'
    )
  })
})
