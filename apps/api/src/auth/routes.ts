import type { DB } from '@tms/db'
import { Elysia, t } from 'elysia'
import type { Kysely } from 'kysely'
import { ApiError, unauthorized } from '../http/errors'
import { clientIp } from '../http/security'
import type { AppOptions } from '../options'
import { type authGuard, requireUser } from './guard'
import { hashPassword, verifyPassword } from './password'
import { createSession, revokeSession, rotateSession } from './sessions'
import { signAccessToken } from './tokens'

// Cadastro, login, refresh e logout (doc/plano-v0.md, Etapa 7).
//
// Transporte do refresh token: o app nativo manda `x-tms-client: native` e
// recebe o token no corpo (guarda no expo-secure-store); o web recebe um
// cookie HttpOnly, Secure e SameSite=Strict em /auth, e o token nunca aparece
// no corpo. O token de acesso fica só em memória nos dois.

export const REFRESH_COOKIE = 'tms_refresh'
const NATIVE = 'native'

const credentials = {
  email: t.String({ format: 'email', maxLength: 254 }),
  password: t.String({ minLength: 1, maxLength: 128 }),
}

const normalizeEmail = (email: string) => email.trim().toLowerCase()

interface CookieJar {
  value: unknown
  set(options: Record<string, unknown>): void
  remove(): void
}

export function authRoutes(
  db: Kysely<DB>,
  options: AppOptions,
  guard: ReturnType<typeof authGuard>
) {
  const ttl = options.tokens.ttlSeconds
  const refreshMaxAge = Math.floor(options.sessions.refreshTtlMs / 1000)

  const limit = (
    limiter: AppOptions['limits'][keyof AppOptions['limits']],
    key: string,
    set: { headers: Record<string, string | number> }
  ) => {
    const d = limiter.hit(key)
    if (!d.allowed) {
      set.headers['retry-after'] = String(d.retryAfterSeconds)
      throw new ApiError(429, 'muitas tentativas; tente de novo mais tarde')
    }
  }

  // Cookie só serve a uma origem da allowlist (defesa extra contra CSRF,
  // além do SameSite=Strict).
  const fromCookie = (request: Request, jar: CookieJar) => {
    const raw = typeof jar.value === 'string' ? jar.value : ''
    if (!raw) return ''
    const origin = request.headers.get('origin')
    if (!origin || !options.corsOrigins.includes(origin))
      throw new ApiError(403, 'origem não permitida')
    return raw
  }

  const respond = async (
    userId: string,
    username: string,
    refreshToken: string,
    request: Request,
    jar: CookieJar
  ) => {
    const accessToken = await signAccessToken(options.tokens, userId)
    const body = {
      accessToken,
      expiresIn: ttl,
      user: { id: userId, username },
    }
    if (request.headers.get('x-tms-client') === NATIVE)
      return { ...body, refreshToken }
    jar.set({
      value: refreshToken,
      httpOnly: true,
      secure: options.secureCookies,
      sameSite: 'strict',
      path: '/auth',
      maxAge: refreshMaxAge,
    })
    return body
  }

  return new Elysia({ prefix: '/auth' })
    .use(guard)
    .post(
      '/register',
      async ({ body, request, server, set, cookie }) => {
        limit(
          options.limits.register,
          clientIp(request, server, options.trustProxy),
          set
        )
        const email = normalizeEmail(body.email)
        const hashed = await hashPassword(body.password)
        const user = await db
          .insertInto('users')
          .values({
            email,
            username: body.username,
            hashed_password: hashed,
          })
          .onConflict(oc => oc.doNothing())
          .returning(['id', 'username'])
          .executeTakeFirst()
        // Mesma resposta para e-mail ou nome já usados: não diz qual existe
        if (!user)
          throw new ApiError(
            409,
            'não foi possível criar a conta com esses dados'
          )
        const refreshToken = await createSession(db, options.sessions, user.id)
        set.status = 201
        return respond(
          user.id,
          user.username,
          refreshToken,
          request,
          cookie[REFRESH_COOKIE] as unknown as CookieJar
        )
      },
      {
        body: t.Object({
          ...credentials,
          username: t.String({ pattern: '^[a-z0-9_]{3,24}$' }),
          // Sem regra de composição; 15 é o que o NIST 800-63B-4 pede para
          // senha como fator único (doc/plano-v0.md §7, decisão 1)
          password: t.String({ minLength: 15, maxLength: 128 }),
        }),
      }
    )
    .post(
      '/login',
      async ({ body, request, server, set, cookie }) => {
        const email = normalizeEmail(body.email)
        limit(
          options.limits.login,
          clientIp(request, server, options.trustProxy),
          set
        )
        const failures = options.limits.loginFailures.check(email)
        if (!failures.allowed) {
          set.headers['retry-after'] = String(failures.retryAfterSeconds)
          throw new ApiError(429, 'muitas tentativas; tente de novo mais tarde')
        }
        const user = await db
          .selectFrom('users')
          .select(['id', 'username', 'hashed_password'])
          .where(eb => eb(eb.fn('lower', ['email']), '=', email))
          .where('deleted_at', 'is', null)
          .executeTakeFirst()
        const ok = await verifyPassword(
          body.password,
          user?.hashed_password ?? null
        )
        if (!user || !ok) {
          options.limits.loginFailures.hit(email)
          throw new ApiError(401, 'e-mail ou senha incorretos')
        }
        const refreshToken = await createSession(db, options.sessions, user.id)
        return respond(
          user.id,
          user.username,
          refreshToken,
          request,
          cookie[REFRESH_COOKIE] as unknown as CookieJar
        )
      },
      { body: t.Object(credentials) }
    )
    .post(
      '/refresh',
      async ({ body, request, server, set, cookie }) => {
        limit(
          options.limits.refresh,
          clientIp(request, server, options.trustProxy),
          set
        )
        const jar = cookie[REFRESH_COOKIE] as unknown as CookieJar
        const raw = body?.refreshToken ?? fromCookie(request, jar)
        const rotated = raw
          ? await rotateSession(db, options.sessions, raw)
          : null
        if (!rotated) {
          jar.remove()
          throw unauthorized()
        }
        const user = await db
          .selectFrom('users')
          .select('username')
          .where('id', '=', rotated.userId)
          .executeTakeFirstOrThrow()
        return respond(
          rotated.userId,
          user.username,
          rotated.refreshToken,
          request,
          jar
        )
      },
      {
        body: t.Optional(
          t.Object({ refreshToken: t.Optional(t.String({ maxLength: 200 })) })
        ),
      }
    )
    .post(
      '/logout',
      async ({ body, request, set, cookie }) => {
        const jar = cookie[REFRESH_COOKIE] as unknown as CookieJar
        const raw = body?.refreshToken ?? fromCookie(request, jar)
        if (raw) await revokeSession(db, options.sessions, raw)
        jar.remove()
        set.status = 204
        return null
      },
      {
        body: t.Optional(
          t.Object({ refreshToken: t.Optional(t.String({ maxLength: 200 })) })
        ),
      }
    )
}

export function meRoutes(db: Kysely<DB>, guard: ReturnType<typeof authGuard>) {
  return new Elysia().use(guard).get('/me', async ({ userId }) => {
    const id = requireUser(userId)
    const user = await db
      .selectFrom('users')
      .select(['id', 'email', 'username'])
      .where('id', '=', id)
      .where('deleted_at', 'is', null)
      .executeTakeFirst()
    if (!user) throw unauthorized()
    return user
  })
}
