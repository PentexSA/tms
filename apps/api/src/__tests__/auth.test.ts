/// <reference types="bun-types" />
import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test'
import { createPGliteTestDb } from '@tms/db/testing'
import { SignJWT } from 'jose'
import { sql } from 'kysely'
import { createRateLimiter } from '../http/rate-limit'
import { logger } from '../logger'
import { defaultLimits } from '../options'
import {
  createTestContext,
  createTestContextOn,
  destroyTestDb,
  makeRequest,
  type TestContext,
  useTestDb,
} from '../test/helpers'

// Um PGLite para o arquivo, restaurado a cada createTestContext
useTestDb()

// Autenticação (doc/plano-v0.md, Etapa 7): cadastro, login, JWT, rotação do
// refresh token, rate limit, CORS e cabeçalhos.

const ORIGIN = 'https://app.tms.test'
const SECRET = new TextEncoder().encode('s'.repeat(48))
const NATIVE = { 'x-tms-client': 'native' }
const WEB = { origin: ORIGIN }
const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE

const ana = {
  email: 'Ana@Example.test',
  username: 'ana',
  password: 'correct horse battery staple',
}

interface Session {
  accessToken: string
  refreshToken?: string
  expiresIn: number
  user: { id: string; username: string }
}

let ctx: TestContext
const tokens = (now: () => Date) => ({
  secret: SECRET,
  issuer: 'tms-api',
  audience: 'tms-app',
  ttlSeconds: 15 * 60,
  now,
})

async function setup(extra: Parameters<typeof createTestContext>[0] = {}) {
  await destroyTestDb()
  // O segredo é fixo nos testes para conseguir forjar tokens inválidos
  ctx = await createTestContext({
    corsOrigins: [ORIGIN],
    tokens: tokens(() => clockNow()),
    ...extra,
  })
}
let clockNow = () => new Date()

const post = (path: string, body?: unknown, headers = {}) =>
  makeRequest(ctx.app, 'POST', path, body, headers)
const get = (path: string, headers = {}) =>
  makeRequest(ctx.app, 'GET', path, undefined, headers)

async function register(user = ana, headers: Record<string, string> = NATIVE) {
  const res = await post('/auth/register', user, headers)
  return { res, body: (await res.json()) as Session }
}

const cookieOf = (res: Response) =>
  res.headers.getSetCookie().find(c => c.startsWith('tms_refresh='))
const cookieValue = (res: Response) =>
  cookieOf(res)?.split(';')[0]?.split('=')[1] ?? ''

beforeEach(async () => {
  await setup()
  clockNow = ctx.clock.now
})
afterEach(async () => {
  await destroyTestDb()
})

describe('POST /auth/register', () => {
  it('nativo: devolve tokens no corpo, sem cookie', async () => {
    const { res, body } = await register()
    expect(res.status).toBe(201)
    expect(body.user.username).toBe('ana')
    expect(body.expiresIn).toBe(900)
    expect(body.accessToken.split('.')).toHaveLength(3)
    expect(body.refreshToken?.length).toBeGreaterThan(40)
    expect(cookieOf(res)).toBeUndefined()
  })

  it('web: refresh só no cookie HttpOnly, SameSite=Strict e em /auth', async () => {
    const { res, body } = await register(ana, WEB)
    expect(res.status).toBe(201)
    expect(body.refreshToken).toBeUndefined()
    const cookie = cookieOf(res) ?? ''
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('SameSite=Strict')
    expect(cookie).toContain('Path=/auth')
  })

  it('guarda o e-mail normalizado e a senha só como hash argon2id', async () => {
    await register()
    const row = await ctx.db
      .selectFrom('users')
      .select(['email', 'hashed_password'])
      .executeTakeFirstOrThrow()
    expect(row.email).toBe('ana@example.test')
    expect(row.hashed_password).toStartWith('$argon2id$')
    expect(row.hashed_password).not.toContain(ana.password)
  })

  it('e-mail ou nome já usados recebem a mesma resposta genérica', async () => {
    await register()
    const sameEmail = await post(
      '/auth/register',
      { ...ana, email: 'ANA@example.test', username: 'outra' },
      NATIVE
    )
    const sameName = await post(
      '/auth/register',
      { ...ana, email: 'outra@example.test' },
      NATIVE
    )
    expect(sameEmail.status).toBe(409)
    expect(sameName.status).toBe(409)
    expect(await sameEmail.json()).toEqual(await sameName.json())
  })

  it.each([
    ['senha com 14 caracteres', { password: 'x'.repeat(14) }, '/password'],
    ['senha acima de 128', { password: 'x'.repeat(129) }, '/password'],
    ['nome com maiúscula', { username: 'Ana' }, '/username'],
    ['nome curto', { username: 'an' }, '/username'],
    ['e-mail inválido', { email: 'ana' }, '/email'],
  ])('400 sem repetir o valor: %s', async (_, patch, field) => {
    const body = { ...ana, ...patch }
    const res = await post('/auth/register', body, NATIVE)
    expect(res.status).toBe(400)
    const text = await res.text()
    expect(JSON.parse(text)).toMatchObject({
      error: 'dados inválidos',
      fields: [field],
    })
    expect(text).not.toContain(body.password)
  })

  it('rate limit por IP no cadastro', async () => {
    await setup({
      limits: {
        ...defaultLimits(() => new Date()),
        register: createRateLimiter({ limit: 2, windowMs: MINUTE }),
      },
    })
    for (const n of [1, 2])
      expect(
        (await register({ ...ana, email: `a${n}@x.test`, username: `ana${n}` }))
          .res.status
      ).toBe(201)
    const third = await post(
      '/auth/register',
      { ...ana, email: 'a3@x.test', username: 'ana3' },
      NATIVE
    )
    expect(third.status).toBe(429)
    expect(third.headers.get('retry-after')).toMatch(/^\d+$/)
  })
})

describe('POST /auth/login', () => {
  beforeEach(async () => {
    await register()
  })

  it('entra com o e-mail em qualquer caixa', async () => {
    const res = await post(
      '/auth/login',
      { email: 'ANA@example.TEST', password: ana.password },
      NATIVE
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as Session
    expect(body.user.username).toBe('ana')
  })

  it('senha errada e e-mail inexistente: mesma resposta', async () => {
    const wrong = await post(
      '/auth/login',
      { email: ana.email, password: 'senha errada mas longa' },
      NATIVE
    )
    const missing = await post(
      '/auth/login',
      { email: 'ninguem@example.test', password: ana.password },
      NATIVE
    )
    expect(wrong.status).toBe(401)
    expect(missing.status).toBe(401)
    expect(await wrong.json()).toEqual(await missing.json())
  })

  it('10 falhas no mesmo e-mail bloqueiam por 15 minutos', async () => {
    const attempt = (password: string) =>
      post('/auth/login', { email: ana.email, password }, NATIVE)
    for (let i = 0; i < 10; i++)
      expect((await attempt(`errada ${i} com tamanho`)).status).toBe(401)
    const blocked = await attempt(ana.password)
    expect(blocked.status).toBe(429)
    expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0)
    ctx.clock.advance(15 * MINUTE + 1)
    expect((await attempt(ana.password)).status).toBe(200)
  })

  it('rate limit por IP', async () => {
    await setup({
      limits: {
        ...defaultLimits(() => new Date()),
        login: createRateLimiter({ limit: 1, windowMs: MINUTE }),
      },
    })
    await post('/auth/login', { email: ana.email, password: 'x' }, NATIVE)
    const res = await post(
      '/auth/login',
      { email: ana.email, password: 'x' },
      NATIVE
    )
    expect(res.status).toBe(429)
  })

  it('usuário excluído não entra', async () => {
    await ctx.db.updateTable('users').set({ deleted_at: new Date() }).execute()
    const res = await post(
      '/auth/login',
      { email: ana.email, password: ana.password },
      NATIVE
    )
    expect(res.status).toBe(401)
  })
})

describe('JWT de acesso e GET /me', () => {
  let session: Session
  beforeEach(async () => {
    session = (await register()).body
  })
  const me = (token: string) => get('/me', { authorization: `Bearer ${token}` })
  const forge = (claims: {
    sub?: string
    iss?: string
    aud?: string
    alg?: string
    exp?: number
  }) =>
    new SignJWT({})
      .setProtectedHeader({ alg: claims.alg ?? 'HS256', typ: 'JWT' })
      .setSubject(claims.sub ?? session.user.id)
      .setIssuer(claims.iss ?? 'tms-api')
      .setAudience(claims.aud ?? 'tms-app')
      .setIssuedAt(Math.floor(ctx.clock.now().getTime() / 1000))
      .setExpirationTime(
        claims.exp ?? Math.floor(ctx.clock.now().getTime() / 1000) + 60
      )
      .setJti(crypto.randomUUID())
      .sign(SECRET)

  it('com token válido, devolve o usuário', async () => {
    const res = await me(session.accessToken)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      id: session.user.id,
      email: 'ana@example.test',
      username: 'ana',
    })
  })

  it('sem token, com lixo ou com outro esquema: 401', async () => {
    expect((await get('/me')).status).toBe(401)
    expect((await me('lixo')).status).toBe(401)
    expect(
      (await get('/me', { authorization: `Basic ${session.accessToken}` }))
        .status
    ).toBe(401)
  })

  it('alg none é recusado', async () => {
    const enc = (o: unknown) =>
      Buffer.from(JSON.stringify(o)).toString('base64url')
    const now = Math.floor(ctx.clock.now().getTime() / 1000)
    const unsigned = `${enc({ alg: 'none', typ: 'JWT' })}.${enc({
      sub: session.user.id,
      iss: 'tms-api',
      aud: 'tms-app',
      iat: now,
      exp: now + 60,
      jti: 'x',
    })}.`
    expect((await me(unsigned)).status).toBe(401)
  })

  it('outro algoritmo, mesmo com o segredo certo, é recusado', async () => {
    expect((await me(await forge({ alg: 'HS512' }))).status).toBe(401)
    expect((await me(await forge({}))).status).toBe(200)
  })

  it('issuer, audience ou sub errados são recusados', async () => {
    expect((await me(await forge({ iss: 'outro' }))).status).toBe(401)
    expect((await me(await forge({ aud: 'outro' }))).status).toBe(401)
    expect((await me(await forge({ sub: 'admin' }))).status).toBe(401)
  })

  it('assinatura adulterada é recusada', async () => {
    const [h, p, s] = session.accessToken.split('.')
    const tampered = `${h}.${p}.${s?.slice(0, -2)}${s?.endsWith('AA') ? 'BB' : 'AA'}`
    expect((await me(tampered)).status).toBe(401)
  })

  it('expira em 15 minutos', async () => {
    ctx.clock.advance(14 * MINUTE)
    expect((await me(session.accessToken)).status).toBe(200)
    ctx.clock.advance(2 * MINUTE)
    expect((await me(session.accessToken)).status).toBe(401)
  })
})

describe('POST /auth/refresh e /auth/logout', () => {
  const refresh = (refreshToken: string) =>
    post('/auth/refresh', { refreshToken }, NATIVE)

  it('troca o refresh token a cada uso', async () => {
    const { body } = await register()
    const res = await refresh(body.refreshToken ?? '')
    expect(res.status).toBe(200)
    const next = (await res.json()) as Session
    expect(next.refreshToken).not.toBe(body.refreshToken)
    expect(next.accessToken).toBeTruthy()
  })

  it('reusar um token já trocado revoga a família inteira', async () => {
    const { body } = await register()
    const first = body.refreshToken ?? ''
    const second = ((await (await refresh(first)).json()) as Session)
      .refreshToken
    expect((await refresh(first)).status).toBe(401)
    // O token novo também morreu: quem roubou e quem tinha perdem a sessão
    expect((await refresh(second ?? '')).status).toBe(401)
  })

  it('token desconhecido, vazio ou grande demais: 401', async () => {
    expect((await refresh('inexistente')).status).toBe(401)
    expect((await post('/auth/refresh', {}, NATIVE)).status).toBe(401)
    expect((await refresh('x'.repeat(201))).status).toBe(400)
  })

  it('expira em 30 dias sem uso', async () => {
    const { body } = await register()
    ctx.clock.advance(30 * DAY + 1)
    expect((await refresh(body.refreshToken ?? '')).status).toBe(401)
  })

  it('a sessão tem limite absoluto de 90 dias, mesmo trocando sempre', async () => {
    const { body } = await register()
    let token = body.refreshToken ?? ''
    for (let i = 0; i < 3; i++) {
      ctx.clock.advance(29 * DAY)
      const res = await refresh(token)
      expect(res.status).toBe(200)
      token = ((await res.json()) as Session).refreshToken ?? ''
    }
    ctx.clock.advance(4 * DAY)
    expect((await refresh(token)).status).toBe(401)
  })

  it('usuário excluído perde a sessão', async () => {
    const { body } = await register()
    await ctx.db.updateTable('users').set({ deleted_at: new Date() }).execute()
    expect((await refresh(body.refreshToken ?? '')).status).toBe(401)
  })

  it('web: cookie só com Origin da allowlist', async () => {
    const { res } = await register(ana, WEB)
    const cookie = `tms_refresh=${cookieValue(res)}`
    const ok = await post('/auth/refresh', undefined, { ...WEB, cookie })
    expect(ok.status).toBe(200)
    expect(cookieValue(ok)).not.toBe(cookieValue(res))
    const next = `tms_refresh=${cookieValue(ok)}`
    expect(
      (await post('/auth/refresh', undefined, { cookie: next })).status
    ).toBe(403)
    expect(
      (
        await post('/auth/refresh', undefined, {
          cookie: next,
          origin: 'https://evil.test',
        })
      ).status
    ).toBe(403)
  })

  it('logout nativo revoga a sessão', async () => {
    const { body } = await register()
    const out = await post(
      '/auth/logout',
      { refreshToken: body.refreshToken },
      NATIVE
    )
    expect(out.status).toBe(204)
    expect((await refresh(body.refreshToken ?? '')).status).toBe(401)
  })

  it('logout web revoga a sessão e apaga o cookie', async () => {
    const { res } = await register(ana, WEB)
    const cookie = `tms_refresh=${cookieValue(res)}`
    const out = await post('/auth/logout', undefined, { ...WEB, cookie })
    expect(out.status).toBe(204)
    const cleared = cookieOf(out) ?? ''
    expect(cleared).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/)
    expect(
      (await post('/auth/refresh', undefined, { ...WEB, cookie })).status
    ).toBe(401)
  })

  it('logout sem sessão é idempotente', async () => {
    expect((await post('/auth/logout', {}, NATIVE)).status).toBe(204)
  })
})

describe('CORS, cabeçalhos e erros', () => {
  it('preflight da origem permitida recebe credenciais; a outra, não', async () => {
    const preflight = (origin: string) =>
      makeRequest(ctx.app, 'OPTIONS', '/auth/login', undefined, {
        origin,
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type',
      })
    const ok = await preflight(ORIGIN)
    expect(ok.headers.get('access-control-allow-origin')).toBe(ORIGIN)
    expect(ok.headers.get('access-control-allow-credentials')).toBe('true')
    const evil = await preflight('https://evil.test')
    expect(evil.headers.get('access-control-allow-origin')).not.toBe(
      'https://evil.test'
    )
    expect(evil.headers.get('access-control-allow-origin')).not.toBe('*')
  })

  it.each([
    ['GET', '/health', 200],
    ['GET', '/me', 401],
    ['GET', '/nao-existe', 404],
  ])(
    '%s %s (%i) tem os cabeçalhos de segurança',
    async (method, path, status) => {
      const res = await makeRequest(ctx.app, method, path)
      expect(res.status).toBe(status)
      expect(res.headers.get('x-content-type-options')).toBe('nosniff')
      expect(res.headers.get('x-frame-options')).toBe('DENY')
      expect(res.headers.get('content-security-policy')).toContain(
        "frame-ancestors 'none'"
      )
      expect(res.headers.get('strict-transport-security')).toContain('max-age=')
    }
  )

  it('swagger só fora de produção', async () => {
    await setup({ swagger: false })
    expect((await get('/swagger')).status).toBe(404)
    await setup({ swagger: true })
    expect((await get('/swagger')).status).toBe(200)
  })

  it('erro interno sem stack trace nem mensagem', async () => {
    // Falha de banco no meio da rota, num banco só deste teste: o do arquivo
    // continua inteiro para os próximos
    const own = await createPGliteTestDb()
    try {
      ctx = createTestContextOn(own.db, {
        corsOrigins: [ORIGIN],
        tokens: tokens(() => clockNow()),
      })
      await sql`drop table users cascade`.execute(own.db)
      const res = await post(
        '/auth/login',
        { email: ana.email, password: ana.password },
        NATIVE
      )
      expect(res.status).toBe(500)
      const text = await res.text()
      expect(JSON.parse(text)).toEqual({ error: 'erro interno' })
      expect(text).not.toContain('at ')
    } finally {
      await own.destroy()
    }
  })

  it('corpo que não é JSON: 400 genérico', async () => {
    const res = await ctx.app.handle(
      new Request('http://localhost/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{ não é json',
      })
    )
    expect(res.status).toBe(400)
  })

  it('o log nunca tem senha, e-mail nem token', async () => {
    const info = spyOn(logger, 'info')
    try {
      const { body } = await register()
      await post(
        '/auth/login',
        { email: ana.email, password: ana.password },
        NATIVE
      )
      await get('/me', { authorization: `Bearer ${body.accessToken}` })
      await new Promise(r => setTimeout(r, 10))
      const logged = JSON.stringify(info.mock.calls)
      expect(info).toHaveBeenCalled()
      for (const secret of [
        ana.password,
        'ana@example.test',
        body.accessToken,
        body.refreshToken ?? '',
      ])
        expect(logged).not.toContain(secret)
    } finally {
      info.mockRestore()
    }
  })
})
