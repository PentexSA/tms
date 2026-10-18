import type { DB } from '@tms/db'
import { Elysia, t } from 'elysia'
import type { Kysely } from 'kysely'
import { type authGuard, requireUser } from '../auth/guard'
import { verifyPassword } from '../auth/password'
import { REFRESH_COOKIE } from '../auth/routes'
import { ApiError } from '../http/errors'
import { clientIp } from '../http/security'
import { logger } from '../logger'
import type { AppOptions } from '../options'

// Exclusão de conta (LGPD art. 18, VI; doc/plano-v0.md, Etapa 22). A linha do
// usuário sai de verdade (e-mail, nome, hash), numa transação:
// - o que é só dele vai junto: fichas (com histórico e rolagens), vínculos,
//   convites e sessões (migration 0013);
// - o que ele fez em fichas de outras pessoas fica, anônimo (created_by null,
//   "Conta excluída" no histórico);
// - crônica que ele narra: sem mais ninguém, é apagada; com outros membros ou
//   fichas de outras pessoas, a exclusão é recusada (409) com a lista. Dado de
//   outra pessoa nunca é apagado em silêncio.

export const BLOCKED_BY_CHRONICLES =
  'Passe a narração ou exclua a crônica antes'

interface CookieJar {
  set(options: Record<string, unknown>): void
}

type Headers = { headers: Record<string, string | number> }

export function accountRoutes(
  db: Kysely<DB>,
  options: AppOptions,
  guard: ReturnType<typeof authGuard>
) {
  const limit = (key: string, set: Headers) => {
    const d = options.limits.accountDeletion.hit(key)
    if (!d.allowed) {
      set.headers['retry-after'] = String(d.retryAfterSeconds)
      throw new ApiError(429, 'muitas tentativas; tente de novo mais tarde')
    }
  }

  return new Elysia().use(guard).delete(
    '/me',
    async ({ body, userId, request, server, set, cookie }) => {
      const me = requireUser(userId)
      // Força bruta na senha com um token roubado: por usuário e por IP
      limit(`user:${me}`, set as Headers)
      limit(
        `ip:${clientIp(request, server, options.trustProxy)}`,
        set as Headers
      )
      // Operação sensível: pede a senha de novo, mesmo com sessão válida
      const user = await db
        .selectFrom('users')
        .select('hashed_password')
        .where('id', '=', me)
        .executeTakeFirst()
      const ok = await verifyPassword(
        body.password,
        user?.hashed_password ?? null
      )
      // Senha errada ou conta que já não existe: o mesmo 401
      if (!user || !ok)
        throw new ApiError(401, 'não foi possível confirmar a senha')

      const summary = await db.transaction().execute(async trx => {
        await trx
          .selectFrom('users')
          .select('id')
          .where('id', '=', me)
          .forUpdate()
          .executeTakeFirst()
        const narrated = await trx
          .selectFrom('chronicles as c')
          .select(eb => [
            'c.id',
            'c.name',
            // Outras pessoas na crônica: membros e fichas que não são dele
            eb
              .selectFrom('chronicle_members as m')
              .select(eb.fn.countAll<string>().as('n'))
              .whereRef('m.chronicle_id', '=', 'c.id')
              .where('m.user_id', '!=', me)
              .as('members'),
            eb
              .selectFrom('characters as ch')
              .select(eb.fn.countAll<string>().as('n'))
              .whereRef('ch.chronicle_id', '=', 'c.id')
              .where('ch.user_id', '!=', me)
              .as('others'),
          ])
          .where('c.storyteller_id', '=', me)
          .orderBy('c.name')
          .execute()
        const blocking = narrated.filter(
          c => Number(c.members) > 0 || Number(c.others) > 0
        )
        if (blocking.length)
          throw new ApiError(409, BLOCKED_BY_CHRONICLES, {
            chronicles: blocking.map(c => ({ id: c.id, name: c.name })),
          })
        const characters = await trx
          .deleteFrom('characters')
          .where('user_id', '=', me)
          .returning('id')
          .execute()
        if (narrated.length)
          await trx
            .deleteFrom('chronicles')
            .where(
              'id',
              'in',
              narrated.map(c => c.id)
            )
            .execute()
        // Sessões, vínculos e convites vão por cascata; o que ele fez em
        // fichas de outras pessoas fica sem autor (migration 0013)
        await trx.deleteFrom('users').where('id', '=', me).execute()
        return { chronicles: narrated.length, characters: characters.length }
      })

      // Como no logout: o cookie do refresh (web) sai junto
      ;(cookie[REFRESH_COOKIE] as unknown as CookieJar).set({
        value: '',
        httpOnly: true,
        secure: options.secureCookies,
        sameSite: 'strict',
        path: '/auth',
        maxAge: 0,
      })
      // Sem PII: só o id (que não liga a mais nada) e contagens
      logger.info(
        { event: 'account.deleted', userId: me, ...summary },
        'conta excluída'
      )
      set.status = 204
      return null
    },
    { body: t.Object({ password: t.String({ minLength: 1, maxLength: 128 }) }) }
  )
}
