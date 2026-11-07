/// <reference types="bun-types" />

import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test'
import { createHash } from 'node:crypto'
import { createPGliteTestDb } from '@tms/db/testing'
import { SignJWT } from 'jose'
import { sql } from 'kysely'
import { REFRESH_REUSE_GRACE_MS } from '../auth/sessions'
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

const expectNoStore = (res: Response) => {
  expect(res.headers.get('cache-control')).toBe('no-store')
  expect(res.headers.get('pragma')).toBe('no-cache')
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
    // Depois da tolerância do token anterior (describe abaixo)
    ctx.clock.advance(REFRESH_REUSE_GRACE_MS + 1)
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

  // T-14: o jar.remove() mandava só Max-Age=0, sem Path=/auth; a remoção
  // dependia do default-path do navegador e o QA viu o cookie ficar
  const expectCleared = (res: Response, secure = false) => {
    const cleared = cookieOf(res) ?? ''
    expect(cleared).toMatch(/^tms_refresh=;/)
    expect(cleared).toMatch(/Max-Age=0/)
    expect(cleared).toMatch(/Expires=Thu, 01 Jan 1970/)
    expect(cleared).toMatch(/Path=\/auth/)
    expect(cleared).toMatch(/HttpOnly/)
    expect(cleared).toMatch(/SameSite=Strict/i)
    if (secure) expect(cleared).toMatch(/Secure/)
    else expect(cleared).not.toMatch(/Secure/)
  }

  it('logout web revoga a sessão e apaga o cookie com Path=/auth, HttpOnly, SameSite=Strict e Max-Age=0', async () => {
    const { res } = await register(ana, WEB)
    const cookie = `tms_refresh=${cookieValue(res)}`
    const out = await post('/auth/logout', undefined, { ...WEB, cookie })
    expect(out.status).toBe(204)
    expectCleared(out)
    expect(
      (await post('/auth/refresh', undefined, { ...WEB, cookie })).status
    ).toBe(401)
  })

  it('logout web sem cookie também manda apagar', async () => {
    const out = await post('/auth/logout', undefined, WEB)
    expect(out.status).toBe(204)
    expectCleared(out)
  })

  it('com secureCookies, o cookie apagado também é Secure', async () => {
    await setup({ secureCookies: true })
    const { res } = await register(ana, WEB)
    const cookie = `tms_refresh=${cookieValue(res)}`
    expectCleared(
      await post('/auth/logout', undefined, { ...WEB, cookie }),
      true
    )
  })

  it('refresh recusado apaga o cookie com os mesmos atributos', async () => {
    const res = await post('/auth/refresh', undefined, {
      ...WEB,
      cookie: `tms_refresh=${'x'.repeat(43)}`,
    })
    expect(res.status).toBe(401)
    expectCleared(res)
  })

  it('logout e refresh nativos não mexem em cookie', async () => {
    const { body } = await register()
    const out = await post(
      '/auth/logout',
      { refreshToken: body.refreshToken },
      NATIVE
    )
    expect(cookieOf(out)).toBeUndefined()
    const refused = await post(
      '/auth/refresh',
      { refreshToken: body.refreshToken },
      NATIVE
    )
    expect(refused.status).toBe(401)
    expect(cookieOf(refused)).toBeUndefined()
  })

  // T-14: um logout offline que não revogou deixa o cookie antigo vivo no
  // servidor; entrar de novo no mesmo navegador o sobrescreve, e ele morreria
  // órfão mas válido
  it('login no web revoga a sessão do cookie anterior', async () => {
    const { res } = await register(ana, WEB)
    const old = `tms_refresh=${cookieValue(res)}`
    const again = await post(
      '/auth/login',
      { email: ana.email, password: ana.password },
      { ...WEB, cookie: old }
    )
    expect(again.status).toBe(200)
    expect(cookieValue(again)).not.toBe(cookieValue(res))
    expect(
      (await post('/auth/refresh', undefined, { ...WEB, cookie: old })).status
    ).toBe(401)
    const fresh = `tms_refresh=${cookieValue(again)}`
    expect(
      (await post('/auth/refresh', undefined, { ...WEB, cookie: fresh })).status
    ).toBe(200)
  })

  it('cadastro no web revoga a sessão do cookie anterior', async () => {
    const { res } = await register(ana, WEB)
    const old = `tms_refresh=${cookieValue(res)}`
    const other = await post(
      '/auth/register',
      { ...ana, email: 'bia@example.test', username: 'bia' },
      { ...WEB, cookie: old }
    )
    expect(other.status).toBe(201)
    expect(
      (await post('/auth/refresh', undefined, { ...WEB, cookie: old })).status
    ).toBe(401)
  })

  it('login com cookie de outra origem não revoga nem é recusado', async () => {
    const { res } = await register(ana, WEB)
    const old = `tms_refresh=${cookieValue(res)}`
    const again = await post(
      '/auth/login',
      { email: ana.email, password: ana.password },
      { origin: 'https://evil.test', cookie: old }
    )
    expect(again.status).toBe(200)
    expect(
      (await post('/auth/refresh', undefined, { ...WEB, cookie: old })).status
    ).toBe(200)
  })

  it('login nativo não mexe em cookie', async () => {
    const { res } = await register(ana, WEB)
    const old = `tms_refresh=${cookieValue(res)}`
    const native = await post(
      '/auth/login',
      { email: ana.email, password: ana.password },
      { ...NATIVE, cookie: old }
    )
    expect(native.status).toBe(200)
    expect(cookieOf(native)).toBeUndefined()
    expect(
      (await post('/auth/refresh', undefined, { ...WEB, cookie: old })).status
    ).toBe(200)
  })

  // Sem rate limit no logout (revisão do padrão 8): ele só revoga com posse
  // do token, de alta entropia, e não serve para força bruta. Um 429 ali
  // deixava a família viva no servidor (falha aberta). Quem esgota os limites
  // de autenticação do IP não impede ninguém de sair
  it('logout não tem rate limit: com os limites de autenticação esgotados, revoga e apaga o cookie', async () => {
    const exhausted = () => createRateLimiter({ limit: 0, windowMs: MINUTE })
    await setup({
      limits: {
        ...defaultLimits(() => new Date()),
        login: exhausted(),
        refresh: exhausted(),
      },
    })
    const { res } = await register(ana, WEB)
    const cookie = `tms_refresh=${cookieValue(res)}`
    for (let n = 0; n < 30; n++)
      expect((await post('/auth/logout', {}, NATIVE)).status).toBe(204)
    const out = await post('/auth/logout', undefined, { ...WEB, cookie })
    expect(out.status).toBe(204)
    expectCleared(out)
    expect(Object.keys(defaultLimits(() => new Date()))).not.toContain('logout')
    // Revogou a família do cookie no servidor
    const alive = await ctx.db
      .selectFrom('refresh_tokens')
      .select('id')
      .where('revoked_at', 'is', null)
      .execute()
    expect(alive).toEqual([])
  })

  // T-14 e CSRF: com Origin fora da allowlist, o logout recusa (403) e não
  // mexe no cookie de ninguém
  it('logout web com Origin fora da allowlist: 403, sem apagar o cookie', async () => {
    const { res } = await register(ana, WEB)
    const cookie = `tms_refresh=${cookieValue(res)}`
    const evil = await post('/auth/logout', undefined, {
      origin: 'https://evil.test',
      cookie,
    })
    expect(evil.status).toBe(403)
    expect(cookieOf(evil)).toBeUndefined()
    expect(
      (await post('/auth/refresh', undefined, { ...WEB, cookie })).status
    ).toBe(200)
  })

  it('logout sem sessão é idempotente', async () => {
    expect((await post('/auth/logout', {}, NATIVE)).status).toBe(204)
  })
})

// O app encerrado com um refresh em voo (onda 5, seção 11.6): a API girou o
// token, e o app reaberto apresenta o anterior. Até 30 s depois do giro, e só
// se o sucessor nunca foi usado nem revogado, o anterior ganha um novo
// sucessor uma vez; fora disso, o reuso revoga a família como sempre.
describe('POST /auth/refresh: tolerância do token anterior', () => {
  const SECOND = 1000
  const refresh = (refreshToken: string) =>
    post('/auth/refresh', { refreshToken }, NATIVE)
  const tokenOf = async (res: Response) => {
    expect(res.status).toBe(200)
    return ((await res.json()) as Session).refreshToken ?? ''
  }
  const rowOf = (raw: string) =>
    ctx.db
      .selectFrom('refresh_tokens')
      .selectAll()
      .where('token_hash', '=', createHash('sha256').update(raw).digest('hex'))
      .executeTakeFirstOrThrow()
  const alive = async () =>
    (
      await ctx.db
        .selectFrom('refresh_tokens')
        .select('id')
        .where('revoked_at', 'is', null)
        .execute()
    ).length
  // O token T do login e o sucessor S, que o app não chegou a receber
  const rotated = async () => {
    const { body } = await register()
    const old = body.refreshToken ?? ''
    const successor = await tokenOf(await refresh(old))
    return { old, successor }
  }

  it('o token anterior, com o sucessor sem uso, ganha um novo sucessor na mesma família', async () => {
    const info = spyOn(logger, 'info')
    try {
      const { old, successor } = await rotated()
      ctx.clock.advance(5 * SECOND)
      const res = await refresh(old)
      const fresh = await tokenOf(res)
      expect(fresh).not.toBe(successor)
      expect(fresh).not.toBe(old)
      const [t, s, n] = await Promise.all([
        rowOf(old),
        rowOf(successor),
        rowOf(fresh),
      ])
      expect(n.family_id).toBe(t.family_id)
      // O anterior continua apontando para S; S sai revogado e sem sucessor
      expect(t.replaced_by).toBe(s.id)
      expect(s.revoked_at).not.toBeNull()
      expect(s.replaced_by).toBeNull()
      expect(n.revoked_at).toBeNull()
      expect(await alive()).toBe(1)
      // O novo token segue a rotação normal
      expect((await refresh(fresh)).status).toBe(200)
      // Mensagem fixa, sem token, hash nem id
      const calls = info.mock.calls.filter(
        c => c[1] === 'refresh dentro da tolerância'
      )
      expect(calls).toEqual([
        [{ event: 'auth.refresh_grace' }, 'refresh dentro da tolerância'],
      ])
      const logged = JSON.stringify(info.mock.calls)
      for (const secret of [old, successor, fresh, t.token_hash, t.user_id])
        expect(logged).not.toContain(secret)
    } finally {
      info.mockRestore()
    }
  })

  it('a janela é de 30 s contados do giro: no limite entra', async () => {
    const { old } = await rotated()
    ctx.clock.advance(REFRESH_REUSE_GRACE_MS)
    expect(REFRESH_REUSE_GRACE_MS).toBe(30 * SECOND)
    expect((await refresh(old)).status).toBe(200)
  })

  it('1 ms depois da janela, o reuso revoga a família', async () => {
    const { old, successor } = await rotated()
    ctx.clock.advance(REFRESH_REUSE_GRACE_MS + 1)
    expect((await refresh(old)).status).toBe(401)
    expect((await refresh(successor)).status).toBe(401)
    expect(await alive()).toBe(0)
  })

  it('um token revogado por logout nunca entra na tolerância', async () => {
    const { body } = await register()
    const token = body.refreshToken ?? ''
    expect(
      (await post('/auth/logout', { refreshToken: token }, NATIVE)).status
    ).toBe(204)
    expect((await rowOf(token)).replaced_by).toBeNull()
    expect((await refresh(token)).status).toBe(401)
  })

  it('o sucessor revogado por logout: o anterior não entra na tolerância', async () => {
    const { old, successor } = await rotated()
    expect(
      (await post('/auth/logout', { refreshToken: successor }, NATIVE)).status
    ).toBe(204)
    ctx.clock.advance(SECOND)
    expect((await refresh(old)).status).toBe(401)
    expect(await alive()).toBe(0)
  })

  it('o sucessor já usado: o anterior revoga a família, mesmo dentro da janela', async () => {
    const { old, successor } = await rotated()
    ctx.clock.advance(SECOND)
    const next = await tokenOf(await refresh(successor))
    ctx.clock.advance(SECOND)
    expect((await refresh(old)).status).toBe(401)
    expect((await refresh(next)).status).toBe(401)
    expect(await alive()).toBe(0)
  })

  it('a tolerância é de uso único: a segunda apresentação do anterior revoga a família', async () => {
    const { old } = await rotated()
    ctx.clock.advance(SECOND)
    const fresh = await tokenOf(await refresh(old))
    ctx.clock.advance(SECOND)
    expect((await refresh(old)).status).toBe(401)
    expect((await refresh(fresh)).status).toBe(401)
    expect(await alive()).toBe(0)
  })

  it('o sucessor apresentado depois da tolerância revoga a família (detecção de roubo)', async () => {
    const { old, successor } = await rotated()
    ctx.clock.advance(SECOND)
    const fresh = await tokenOf(await refresh(old))
    // Quem tinha S (o cliente legítimo ou um atacante) derruba a família
    ctx.clock.advance(SECOND)
    expect((await refresh(successor)).status).toBe(401)
    expect((await refresh(fresh)).status).toBe(401)
    expect(await alive()).toBe(0)
  })

  it('a tolerância não estende a sessão: mesma family_expires_at, e o novo token não vive mais que S', async () => {
    const { body } = await register()
    const family = (await rowOf(body.refreshToken ?? '')).family_expires_at
    let token = body.refreshToken ?? ''
    for (let i = 0; i < 3; i++) {
      ctx.clock.advance(29 * DAY)
      token = await tokenOf(await refresh(token))
    }
    // 10 s antes do limite absoluto: T gira para S, e o app não recebe S
    ctx.clock.advance(3 * DAY - 10 * SECOND)
    const successor = await tokenOf(await refresh(token))
    ctx.clock.advance(5 * SECOND)
    const fresh = await tokenOf(await refresh(token))
    const [s, n] = await Promise.all([rowOf(successor), rowOf(fresh)])
    expect(n.family_expires_at).toEqual(family)
    expect(s.family_expires_at).toEqual(family)
    expect(n.expires_at.getTime()).toBeLessThanOrEqual(s.expires_at.getTime())
    expect(n.expires_at.getTime()).toBeLessThanOrEqual(family.getTime())
    // Ainda dentro dos 30 s do giro, mas a família venceu
    ctx.clock.advance(6 * SECOND)
    expect((await refresh(fresh)).status).toBe(401)
  })

  it('o sucessor substituído não vive mais que S, mesmo longe do limite da família', async () => {
    const { old, successor } = await rotated()
    ctx.clock.advance(20 * SECOND)
    const fresh = await tokenOf(await refresh(old))
    const [s, n] = await Promise.all([rowOf(successor), rowOf(fresh)])
    expect(n.expires_at).toEqual(s.expires_at)
  })

  it('o token anterior vencido não entra na tolerância', async () => {
    const { body } = await register()
    const old = body.refreshToken ?? ''
    // T vence em 30 dias: gira 10 s antes e é reapresentado depois de vencer
    ctx.clock.advance(30 * DAY - 10 * SECOND)
    const successor = await tokenOf(await refresh(old))
    ctx.clock.advance(15 * SECOND)
    expect((await refresh(old)).status).toBe(401)
    expect((await refresh(successor)).status).toBe(401)
  })

  it('no web, o cookie anterior também tem a tolerância', async () => {
    const { res } = await register(ana, WEB)
    const old = `tms_refresh=${cookieValue(res)}`
    const ok = await post('/auth/refresh', undefined, { ...WEB, cookie: old })
    expect(ok.status).toBe(200)
    ctx.clock.advance(SECOND)
    const again = await post('/auth/refresh', undefined, {
      ...WEB,
      cookie: old,
    })
    expect(again.status).toBe(200)
    expect(cookieValue(again)).not.toBe(cookieValue(ok))
    const stale = `tms_refresh=${cookieValue(ok)}`
    expect(
      (await post('/auth/refresh', undefined, { ...WEB, cookie: stale })).status
    ).toBe(401)
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

  // T-86: quem acrescenta o X-Forwarded-For é o proxy, nunca o navegador
  const preflightHeaders = async (
    extra: Parameters<typeof createTestContext>[0]
  ) => {
    await setup(extra)
    const res = await makeRequest(
      ctx.app,
      'OPTIONS',
      '/auth/login',
      undefined,
      {
        origin: ORIGIN,
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type',
      }
    )
    return (res.headers.get('access-control-allow-headers') ?? '').toLowerCase()
  }

  it('o preflight nunca libera x-forwarded-for, nem com TRUST_PROXY', async () => {
    for (const trustProxy of [false, true]) {
      const allowed = await preflightHeaders({ trustProxy })
      expect(allowed).toContain('content-type')
      expect(allowed).not.toContain('x-forwarded-for')
      expect(allowed).not.toContain('x-tms-test-client-ip')
    }
  })

  it('com TEST_CLIENT_IP, libera só o header de teste', async () => {
    const allowed = await preflightHeaders({ testClientIp: true })
    expect(allowed).toContain('x-tms-test-client-ip')
    expect(allowed).not.toContain('x-forwarded-for')
  })

  it('sem proxy confiável, X-Forwarded-For forjado não escapa do limite de cadastro', async () => {
    await setup({ trustProxy: false, testClientIp: false })
    const statuses: number[] = []
    for (let n = 1; n <= 6; n++)
      statuses.push(
        (
          await post(
            '/auth/register',
            { ...ana, email: `f${n}@x.test`, username: `forjado${n}` },
            { ...NATIVE, 'x-forwarded-for': `203.0.113.${n}` }
          )
        ).status
      )
    expect(statuses).toEqual([201, 201, 201, 201, 201, 429])
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
      expectNoStore(res)
    }
  )

  // T-13: o cache HTTP do iOS (NSURLCache) e do Android (OkHttp) gravava em
  // disco, em claro, as respostas com tokens e dados ocultos
  it('toda resposta sai com no-store, inclusive erro, preflight e swagger', async () => {
    const { body } = await register()
    const responses: [string, Response, number][] = [
      [
        'login 200 com tokens',
        await post(
          '/auth/login',
          { email: ana.email, password: ana.password },
          NATIVE
        ),
        200,
      ],
      [
        'refresh recusado',
        await post('/auth/refresh', { refreshToken: 'x'.repeat(43) }, NATIVE),
        401,
      ],
      ['validação', await post('/auth/login', { email: 'ana' }, NATIVE), 400],
      [
        'corpo que não é JSON',
        await ctx.app.handle(
          new Request('http://localhost/auth/login', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: '{ não é json',
          })
        ),
        400,
      ],
      [
        'preflight',
        await makeRequest(ctx.app, 'OPTIONS', '/auth/login', undefined, {
          origin: ORIGIN,
          'access-control-request-method': 'POST',
          'access-control-request-headers': 'content-type',
        }),
        204,
      ],
      [
        'logout',
        await post('/auth/logout', { refreshToken: body.refreshToken }, NATIVE),
        204,
      ],
    ]
    for (const [name, res, status] of responses) {
      expect({ name, status: res.status }).toEqual({ name, status })
      expectNoStore(res)
    }

    await setup({
      swagger: true,
      limits: {
        ...defaultLimits(() => new Date()),
        login: createRateLimiter({ limit: 1, windowMs: MINUTE }),
      },
    })
    const swaggerUi = await get('/swagger')
    expect(swaggerUi.status).toBe(200)
    expectNoStore(swaggerUi)
    await post('/auth/login', { email: ana.email, password: 'x' }, NATIVE)
    const limited = await post(
      '/auth/login',
      { email: ana.email, password: 'x' },
      NATIVE
    )
    expect(limited.status).toBe(429)
    expectNoStore(limited)
  })

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
      expect(JSON.parse(text)).toEqual({
        error: 'erro interno',
        requestId: res.headers.get('x-request-id'),
      })
      expect(text).not.toContain('at ')
      expectNoStore(res)
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
