import type { DB } from '@tms/db'
import { isSafeText } from '@tms/sheet-core'
import { Elysia, t } from 'elysia'
import type { Kysely } from 'kysely'
import { audit } from '../audit'
import type { authGuard } from '../auth/guard'
import { requireUser } from '../auth/guard'
import { chronicleAccess } from '../authz'
import { ApiError } from '../http/errors'
import { idParams, uuid } from '../http/params'
import { clientIp } from '../http/security'
import type { AppOptions } from '../options'
import { hashInviteCode, newInviteCode } from './invite-code'

// Crônicas, convites e membros (doc/plano-v0.md, Etapa 10; doc/plano-v3.md,
// Etapa 7). Quem cria a crônica é o narrador; os jogadores entram por convite
// e saem sozinhos ou removidos. Sem vínculo, 404. O ex-membro (`former`) lê a
// crônica e as fichas dele; o resto responde como para quem não tem vínculo.

const DAY = 24 * 60 * 60 * 1000
const notFound = () => new ApiError(404, 'não encontrado')
const storytellerOnly = () => new ApiError(403, 'só o narrador pode fazer isso')
const INVALID_INVITE = 'convite inválido ou expirado'
export const CONFIRM_DELETE =
  'a crônica tem fichas de outros jogadores: confirme com o nome da crônica'

// Nome exibido a outras pessoas: texto seguro de uma linha (sem HTML, controle
// nem bidi, que permitiria falsificar o texto).
function chronicleName(raw: string): string {
  const name = raw.trim()
  if (!name || name.length > 80 || !isSafeText(name) || /[\t\n\r]/.test(name))
    throw new ApiError(400, 'dados inválidos', { fields: ['/name'] })
  return name
}

export function chronicleRoutes(
  db: Kysely<DB>,
  options: AppOptions,
  guard: ReturnType<typeof authGuard>
) {
  const requireStoryteller = async (userId: string, chronicleId: string) => {
    const role = await chronicleAccess(db, userId, chronicleId)
    if (role === null || role === 'former') throw notFound()
    if (role !== 'storyteller') throw storytellerOnly()
  }

  /**
   * Tira `userId` da crônica (remover ou sair), pelo protocolo de trava da
   * Etapa 7: primeiro o vínculo, depois as fichas da pessoa, em ordem de id.
   * As fichas vão para `archived` (sem trava), o vínculo sai e o registro
   * ganha uma linha. Sem vínculo: 404.
   */
  const removeMember = (
    chronicleId: string,
    userId: string,
    by: { readonly actorId: string; readonly revokeInvites: boolean }
  ) =>
    db.transaction().execute(async trx => {
      const member = await trx
        .selectFrom('chronicle_members')
        .select('user_id')
        .where('chronicle_id', '=', chronicleId)
        .where('user_id', '=', userId)
        .forUpdate()
        .executeTakeFirst()
      if (!member) throw notFound()
      // Lidas depois da trava do vínculo: incluem a de uma criação que
      // terminou antes
      const characters = await trx
        .selectFrom('characters')
        .select('id')
        .where('chronicle_id', '=', chronicleId)
        .where('user_id', '=', userId)
        .where('deleted_at', 'is', null)
        .orderBy('id')
        .forUpdate()
        .execute()
      const now = options.now()
      const ids = characters.map(c => c.id)
      if (ids.length)
        await trx
          .updateTable('characters')
          .set({ status: 'archived', locked_at: null, updated_at: now })
          .where('id', 'in', ids)
          .execute()
      await trx
        .deleteFrom('chronicle_members')
        .where('chronicle_id', '=', chronicleId)
        .where('user_id', '=', userId)
        .execute()
      // O removido não volta sozinho com um convite que já tinha (§7, decisão 4)
      if (by.revokeInvites)
        await trx
          .updateTable('chronicle_invites')
          .set({ revoked_at: now })
          .where('chronicle_id', '=', chronicleId)
          .where('revoked_at', 'is', null)
          .execute()
      await audit(trx, {
        chronicleId,
        actorId: by.actorId,
        action: by.actorId === userId ? 'member.leave' : 'member.remove',
        userId,
        payload: {
          characters: ids,
          ...(by.revokeInvites && { invitesRevoked: true }),
        },
        at: now,
      })
      return { archived: ids }
    })

  return new Elysia()
    .use(guard)
    .get('/systems', async () =>
      db
        .selectFrom('game_systems as g')
        .innerJoin('trait_templates as t', 't.system_id', 'g.id')
        .select(['g.code', 'g.name', 'g.family'])
        .groupBy(['g.id', 'g.code', 'g.name', 'g.family'])
        .orderBy('g.name')
        .execute()
    )
    .post(
      '/chronicles',
      async ({ body, userId, set }) => {
        const me = requireUser(userId)
        const name = chronicleName(body.name)
        const system = await db
          .selectFrom('game_systems as g')
          .select(['g.id', 'g.code', 'g.name'])
          .where('g.code', '=', body.systemCode)
          .where(eb =>
            eb.exists(
              eb
                .selectFrom('trait_templates')
                .select('trait_templates.id')
                .whereRef('trait_templates.system_id', '=', 'g.id')
            )
          )
          .executeTakeFirst()
        if (!system)
          throw new ApiError(422, 'sistema sem template publicado', {
            fields: ['/systemCode'],
          })
        const chronicle = await db
          .insertInto('chronicles')
          .values({ storyteller_id: me, system_id: system.id, name })
          .returning(['id', 'name'])
          .executeTakeFirstOrThrow()
        set.status = 201
        return {
          id: chronicle.id,
          name: chronicle.name,
          system: { code: system.code, name: system.name },
          role: 'storyteller' as const,
        }
      },
      {
        body: t.Object({
          name: t.String({ minLength: 1, maxLength: 120 }),
          systemCode: t.String({
            maxLength: 64,
            pattern: '^[a-z0-9]+(-[a-z0-9]+)*$',
          }),
        }),
      }
    )
    .get('/chronicles', async ({ userId }) => {
      const me = requireUser(userId)
      const rows = await db
        .selectFrom('chronicles as c')
        .innerJoin('game_systems as g', 'g.id', 'c.system_id')
        .innerJoin('users as st', 'st.id', 'c.storyteller_id')
        .leftJoin('chronicle_members as m', join =>
          join.onRef('m.chronicle_id', '=', 'c.id').on('m.user_id', '=', me)
        )
        // O ex-membro continua vendo a crônica em que tem ficha ("Você saiu")
        .where(eb =>
          eb.or([
            eb('c.storyteller_id', '=', me),
            eb('m.user_id', '=', me),
            eb.exists(
              eb
                .selectFrom('characters as mine')
                .select('mine.id')
                .whereRef('mine.chronicle_id', '=', 'c.id')
                .where('mine.user_id', '=', me)
                .where('mine.deleted_at', 'is', null)
            ),
          ])
        )
        .select(eb => [
          'c.id',
          'c.name',
          'c.storyteller_id',
          'm.user_id as member',
          'c.created_at',
          'g.code as systemCode',
          'g.name as systemName',
          'st.username as storyteller',
          // Só o que quem pergunta vê: o narrador, todas; o jogador, as dele
          eb
            .selectFrom('characters as ch')
            .select(eb.fn.countAll<string>().as('n'))
            .whereRef('ch.chronicle_id', '=', 'c.id')
            .where('ch.deleted_at', 'is', null)
            .where(eb =>
              eb.or([
                eb('ch.user_id', '=', me),
                eb('c.storyteller_id', '=', me),
              ])
            )
            .as('characterCount'),
        ])
        .orderBy('c.created_at', 'desc')
        .execute()
      return rows.map(r => ({
        id: r.id,
        name: r.name,
        system: { code: r.systemCode, name: r.systemName },
        role:
          r.storyteller_id === me
            ? ('storyteller' as const)
            : r.member
              ? ('player' as const)
              : ('former' as const),
        storyteller: { username: r.storyteller },
        characterCount: Number(r.characterCount ?? 0),
      }))
    })
    .get(
      '/chronicles/:id',
      async ({ params, userId }) => {
        const me = requireUser(userId)
        const role = await chronicleAccess(db, me, params.id)
        if (role === null) throw notFound()
        const c = await db
          .selectFrom('chronicles as c')
          .innerJoin('game_systems as g', 'g.id', 'c.system_id')
          .innerJoin('users as st', 'st.id', 'c.storyteller_id')
          .select([
            'c.id',
            'c.name',
            'g.code as systemCode',
            'g.name as systemName',
            'st.id as storytellerId',
            'st.username as storyteller',
            'c.character_approval',
            'c.creation_defaults',
            'c.creation_settings_revision',
          ])
          .where('c.id', '=', params.id)
          .executeTakeFirstOrThrow()
        const head = {
          id: c.id,
          name: c.name,
          system: { code: c.systemCode, name: c.systemName },
          storyteller: { id: c.storytellerId, username: c.storyteller },
        }
        // O ex-membro não recebe os membros
        if (role === 'former')
          return { ...head, role: 'former' as const, members: [] }
        const members = await db
          .selectFrom('chronicle_members as m')
          .innerJoin('users as u', 'u.id', 'm.user_id')
          .select(['u.id', 'u.username', 'm.joined_at as joinedAt'])
          .where('m.chronicle_id', '=', params.id)
          .orderBy('m.joined_at')
          .execute()
        return {
          ...head,
          // Configuração da criação (v4): o narrador ajusta; o jogador vê se
          // a ficha nova passa por aprovação e o orçamento padrão
          creation: {
            approval: c.character_approval,
            defaults: c.creation_defaults,
            revision: c.creation_settings_revision,
          },
          // O rótulo da crônica para o app; o papel na ficha é outro
          role:
            role === 'storyteller'
              ? ('storyteller' as const)
              : ('player' as const),
          members,
        }
      },
      { params: idParams }
    )
    .delete(
      '/chronicles/:id',
      async ({ params, body, userId, set }) => {
        const me = requireUser(userId)
        await requireStoryteller(me, params.id)
        await db.transaction().execute(async trx => {
          const chronicle = await trx
            .selectFrom('chronicles')
            .select('name')
            .where('id', '=', params.id)
            .forUpdate()
            .executeTakeFirst()
          if (!chronicle) throw notFound()
          // Fichas de outras pessoas só saem com confirmação explícita: o
          // nome da crônica digitado (não é um toque por engano). Membros sem
          // ficha perdem só o vínculo
          const { n } = await trx
            .selectFrom('characters')
            .select(eb => eb.fn.countAll<string>().as('n'))
            .where('chronicle_id', '=', params.id)
            .where('user_id', '!=', me)
            .where('deleted_at', 'is', null)
            .executeTakeFirstOrThrow()
          const others = Number(n)
          if (others > 0 && body?.confirm?.trim() !== chronicle.name)
            throw new ApiError(409, CONFIRM_DELETE, { otherCharacters: others })
          await trx
            .deleteFrom('characters')
            .where('chronicle_id', '=', params.id)
            .execute()
          // Vínculos e convites vão por cascata
          await trx
            .deleteFrom('chronicles')
            .where('id', '=', params.id)
            .execute()
        })
        set.status = 204
        return null
      },
      {
        params: idParams,
        body: t.Optional(
          t.Object({ confirm: t.Optional(t.String({ maxLength: 80 })) })
        ),
      }
    )
    .post(
      '/chronicles/:id/invites',
      async ({ params, body, userId, set }) => {
        const me = requireUser(userId)
        await requireStoryteller(me, params.id)
        const code = newInviteCode()
        const expiresAt = new Date(
          options.now().getTime() + (body?.expiresInDays ?? 7) * DAY
        )
        const invite = await db
          .insertInto('chronicle_invites')
          .values({
            chronicle_id: params.id,
            code_hash: hashInviteCode(code),
            created_by: me,
            created_at: options.now(),
            expires_at: expiresAt,
            max_uses: body?.maxUses ?? 10,
          })
          .returning(['id', 'expires_at', 'max_uses'])
          .executeTakeFirstOrThrow()
        set.status = 201
        // O código só aparece nesta resposta; o banco guarda o hash
        return {
          id: invite.id,
          code,
          expiresAt: invite.expires_at,
          maxUses: invite.max_uses,
        }
      },
      {
        params: idParams,
        body: t.Optional(
          t.Object({
            expiresInDays: t.Optional(t.Integer({ minimum: 1, maximum: 30 })),
            maxUses: t.Optional(t.Integer({ minimum: 1, maximum: 50 })),
          })
        ),
      }
    )
    .get(
      '/chronicles/:id/invites',
      async ({ params, userId }) => {
        const me = requireUser(userId)
        await requireStoryteller(me, params.id)
        const now = options.now()
        const rows = await db
          .selectFrom('chronicle_invites')
          .select([
            'id',
            'created_at',
            'expires_at',
            'max_uses',
            'uses',
            'revoked_at',
          ])
          .where('chronicle_id', '=', params.id)
          .orderBy('created_at', 'desc')
          .limit(50)
          .execute()
        return rows.map(r => ({
          id: r.id,
          createdAt: r.created_at,
          expiresAt: r.expires_at,
          maxUses: r.max_uses,
          uses: r.uses,
          active:
            r.revoked_at === null && r.expires_at > now && r.uses < r.max_uses,
        }))
      },
      { params: idParams }
    )
    .delete(
      '/chronicles/:id/invites/:inviteId',
      async ({ params, userId, set }) => {
        const me = requireUser(userId)
        await requireStoryteller(me, params.id)
        const revoked = await db
          .updateTable('chronicle_invites')
          .set({ revoked_at: options.now() })
          .where('id', '=', params.inviteId)
          // O convite precisa ser desta crônica (IDOR)
          .where('chronicle_id', '=', params.id)
          .where('revoked_at', 'is', null)
          .returning('id')
          .executeTakeFirst()
        if (!revoked) throw notFound()
        set.status = 204
        return null
      },
      { params: t.Object({ id: uuid, inviteId: uuid }) }
    )
    .delete(
      '/chronicles/:id/members/me',
      async ({ params, userId, set }) => {
        const me = requireUser(userId)
        const role = await chronicleAccess(db, me, params.id)
        if (role === null || role === 'former') throw notFound()
        if (role === 'storyteller')
          throw new ApiError(
            403,
            'o narrador não sai da crônica: só deixa de narrar transferindo'
          )
        await removeMember(params.id, me, {
          actorId: me,
          revokeInvites: false,
        })
        set.status = 204
        return null
      },
      { params: idParams }
    )
    .delete(
      '/chronicles/:id/members/:userId',
      async ({ params, body, userId, set }) => {
        const me = requireUser(userId)
        await requireStoryteller(me, params.id)
        // O narrador não está em chronicle_members: removê-lo dá 404
        await removeMember(params.id, params.userId, {
          actorId: me,
          revokeInvites: body?.revokeInvites ?? true,
        })
        set.status = 204
        return null
      },
      {
        params: t.Object({ id: uuid, userId: uuid }),
        body: t.Optional(t.Object({ revokeInvites: t.Optional(t.Boolean()) })),
      }
    )
    .post(
      '/invites/accept',
      async ({ body, userId, request, server, set }) => {
        const me = requireUser(userId)
        for (const key of [
          `user:${me}`,
          `ip:${clientIp(request, server, options.trustProxy)}`,
        ]) {
          const d = options.limits.invites.hit(key)
          if (!d.allowed) {
            set.headers['retry-after'] = String(d.retryAfterSeconds)
            throw new ApiError(
              429,
              'muitas tentativas; tente de novo mais tarde'
            )
          }
        }
        const now = options.now()
        return db.transaction().execute(async trx => {
          const invite = await trx
            .selectFrom('chronicle_invites')
            .select([
              'id',
              'chronicle_id',
              'expires_at',
              'max_uses',
              'uses',
              'revoked_at',
            ])
            .where('code_hash', '=', hashInviteCode(body.code))
            .forUpdate()
            .executeTakeFirst()
          // Mesma resposta para inexistente, revogado, expirado ou esgotado
          if (
            !invite ||
            invite.revoked_at !== null ||
            invite.expires_at <= now ||
            invite.uses >= invite.max_uses
          )
            throw new ApiError(404, INVALID_INVITE)
          const role = await chronicleAccess(trx, me, invite.chronicle_id)
          // O ex-membro volta como membro, e gasta um uso; as fichas dele
          // continuam arquivadas até o narrador reativar (§7, decisão 4)
          if (role === 'storyteller' || role === 'member')
            return {
              chronicleId: invite.chronicle_id,
              role:
                role === 'storyteller'
                  ? ('storyteller' as const)
                  : ('player' as const),
            }
          await trx
            .insertInto('chronicle_members')
            .values({ chronicle_id: invite.chronicle_id, user_id: me })
            .execute()
          await trx
            .updateTable('chronicle_invites')
            .set(eb => ({ uses: eb('uses', '+', 1) }))
            .where('id', '=', invite.id)
            .execute()
          return { chronicleId: invite.chronicle_id, role: 'player' as const }
        })
      },
      { body: t.Object({ code: t.String({ minLength: 1, maxLength: 64 }) }) }
    )
}
