import { createHash } from 'node:crypto'
import type { DB } from '@tms/db'
import {
  effectiveChronicleOptions,
  isSafeText,
  validateChronicleOptions,
} from '@tms/sheet-core'
import { Elysia, t } from 'elysia'
import { type Kysely, sql, type Transaction } from 'kysely'
import { audit } from '../audit'
import type { authGuard } from '../auth/guard'
import { requireUser } from '../auth/guard'
import { chronicleAccess } from '../authz'
import { ApiError } from '../http/errors'
import { idParams, uuid } from '../http/params'
import type { AppOptions } from '../options'
import { latestTemplate, modelFor } from '../sheets/models'

const DAY = 24 * 60 * 60 * 1000
const notFound = () => new ApiError(404, 'não encontrado')
const storytellerRequired = () =>
  new ApiError(403, 'Só o narrador pode fazer isso.', {
    code: 'STORYTELLER_REQUIRED',
  })
const unavailable = () =>
  new ApiError(409, 'A transferência não está mais disponível.', {
    code: 'TRANSFER_UNAVAILABLE',
  })
const revisionConflict = (revision: number) =>
  new ApiError(409, 'Os dados mudaram. Atualize para continuar.', {
    code: 'REVISION_CONFLICT',
    revision,
  })
const idempotencyConflict = () =>
  new ApiError(
    409,
    'Esta ação já foi enviada com outros dados. Atualize antes de tentar novamente.',
    { code: 'IDEMPOTENCY_CONFLICT' }
  )

const hashOf = (kind: string, value: unknown) =>
  createHash('sha256').update(JSON.stringify({ kind, value })).digest('hex')

const httpsUrl = (value: string | null | undefined) => {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

const safeText = (
  value: string,
  max: number,
  required = false,
  oneLine = false
) => {
  const result = value.trim()
  const hasUnsafeSeparator = Array.from(result).some(character => {
    const code = character.codePointAt(0)
    return code === 0 || code === 0x2028 || code === 0x2029
  })
  if (
    (required && !result) ||
    result.length > max ||
    !isSafeText(result) ||
    hasUnsafeSeparator ||
    (oneLine && /[\r\n]/.test(result))
  )
    throw new ApiError(422, 'texto inválido')
  return result
}

const civilDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new ApiError(422, 'data da sessão inválida')
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year as number, (month as number) - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  )
    throw new ApiError(422, 'data da sessão inválida')
  return value
}

async function command<R extends object>(
  trx: Transaction<DB>,
  args: {
    chronicleId: string
    key: string
    kind: string
    request: unknown
    actorId: string
    at: Date
  },
  run: () => Promise<R>
): Promise<R & { duplicate: boolean }> {
  const hash = hashOf(args.kind, args.request)
  const done = await trx
    .selectFrom('chronicle_commands')
    .select(['kind', 'request_hash', 'result', 'created_by'])
    .where('chronicle_id', '=', args.chronicleId)
    .where('client_command_id', '=', args.key)
    .executeTakeFirst()
  if (done) {
    if (
      done.kind !== args.kind ||
      done.request_hash !== hash ||
      done.created_by !== args.actorId
    )
      throw idempotencyConflict()
    return { ...(done.result as R), duplicate: true }
  }
  const result = await run()
  await trx
    .insertInto('chronicle_commands')
    .values({
      chronicle_id: args.chronicleId,
      client_command_id: args.key,
      kind: args.kind,
      request_hash: hash,
      result: JSON.stringify(result),
      created_by: args.actorId,
      created_at: args.at,
    })
    .execute()
  return { ...result, duplicate: false }
}

// A data da sessão é civil: o pg a converte em Date à meia-noite local (o dia
// muda conforme o fuso do servidor) e o PGLite, em UTC. Sai do banco já como
// AAAA-MM-DD, igual nos dois drivers.
export const sessionDate = sql<string>`to_char(session_date, 'YYYY-MM-DD')`.as(
  'session_date'
)

const publicSession = (row: {
  id: string
  session_date: string
  title: string
  public_summary: string
  revision: number
}) => ({
  id: row.id,
  date: row.session_date,
  title: row.title,
  summary: row.public_summary,
  revision: row.revision,
})

const cursorOf = (date: Date | string, source: string, id: string) =>
  Buffer.from(
    JSON.stringify([new Date(date).toISOString(), source, id])
  ).toString('base64url')

const readCursor = (
  raw: string | undefined
): readonly [string, string, string] | null => {
  if (!raw) return null
  try {
    const value = JSON.parse(Buffer.from(raw, 'base64url').toString())
    return Array.isArray(value) &&
      value.length === 3 &&
      value.every(item => typeof item === 'string') &&
      !Number.isNaN(new Date(value[0] as string).getTime())
      ? (value as [string, string, string])
      : null
  } catch {
    return null
  }
}

export function backstageRoutes(
  db: Kysely<DB>,
  options: AppOptions,
  guard: ReturnType<typeof authGuard>
) {
  return new Elysia()
    .use(guard)
    .get(
      '/chronicles/:id/sessions',
      async ({ params, userId }) => {
        const me = requireUser(userId)
        const role = await chronicleAccess(db, me, params.id)
        if (role === null || role === 'former') throw notFound()
        const rows = await db
          .selectFrom('chronicle_sessions')
          .select([
            'id',
            sessionDate,
            'title',
            'public_summary',
            'private_notes',
            'revision',
            'updated_at',
          ])
          .where('chronicle_id', '=', params.id)
          .orderBy('chronicle_sessions.session_date', 'desc')
          .orderBy('id', 'desc')
          .execute()
        return {
          items: rows.map(row => ({
            ...publicSession(row),
            ...(role === 'storyteller' && {
              privateNotes: row.private_notes,
              updatedAt: row.updated_at,
            }),
          })),
        }
      },
      { params: idParams }
    )
    .post(
      '/chronicles/:id/sessions',
      async ({ params, body, userId, set }) => {
        const me = requireUser(userId)
        const role = await chronicleAccess(db, me, params.id)
        if (role === null || role === 'former') throw notFound()
        if (role !== 'storyteller') throw storytellerRequired()
        const request = {
          date: civilDate(body.date),
          title: safeText(body.title, 120, true, true),
          summary: safeText(body.summary ?? '', 8000),
          privateNotes: safeText(body.privateNotes ?? '', 16000),
        }
        const result = await db.transaction().execute(async trx => {
          const chronicle = await trx
            .selectFrom('chronicles')
            .select('storyteller_id')
            .where('id', '=', params.id)
            .forUpdate()
            .executeTakeFirst()
          if (!chronicle) throw notFound()
          if (chronicle.storyteller_id !== me) throw storytellerRequired()
          const now = options.now()
          return command(
            trx,
            {
              chronicleId: params.id,
              key: body.clientCommandId,
              kind: 'chronicle.session.create',
              request,
              actorId: me,
              at: now,
            },
            async () => {
              const row = await trx
                .insertInto('chronicle_sessions')
                .values({
                  chronicle_id: params.id,
                  session_date: request.date,
                  title: request.title,
                  public_summary: request.summary,
                  private_notes: request.privateNotes,
                  created_by: me,
                  created_at: now,
                  updated_at: now,
                })
                .returning([
                  'id',
                  sessionDate,
                  'title',
                  'public_summary',
                  'private_notes',
                  'revision',
                ])
                .executeTakeFirstOrThrow()
              await audit(trx, {
                chronicleId: params.id,
                actorId: me,
                action: 'chronicle.session.create',
                payload: { sessionId: row.id },
                at: now,
              })
              return { ...publicSession(row), privateNotes: row.private_notes }
            }
          )
        })
        set.status = result.duplicate ? 200 : 201
        return result
      },
      {
        params: idParams,
        body: t.Object({
          clientCommandId: uuid,
          date: t.String({ pattern: '^\\d{4}-\\d{2}-\\d{2}$' }),
          title: t.String({ minLength: 1, maxLength: 120 }),
          summary: t.Optional(t.String({ maxLength: 8000 })),
          privateNotes: t.Optional(t.String({ maxLength: 16000 })),
        }),
      }
    )
    .get(
      '/chronicles/:id/sessions/:sessionId',
      async ({ params, userId }) => {
        const me = requireUser(userId)
        const role = await chronicleAccess(db, me, params.id)
        if (role === null || role === 'former') throw notFound()
        const row = await db
          .selectFrom('chronicle_sessions')
          .select([
            'id',
            sessionDate,
            'title',
            'public_summary',
            'private_notes',
            'revision',
            'updated_at',
          ])
          .where('chronicle_id', '=', params.id)
          .where('id', '=', params.sessionId)
          .executeTakeFirst()
        if (!row) throw notFound()
        return {
          ...publicSession(row),
          ...(role === 'storyteller' && {
            privateNotes: row.private_notes,
            updatedAt: row.updated_at,
          }),
        }
      },
      { params: t.Object({ id: uuid, sessionId: uuid }) }
    )
    .patch(
      '/chronicles/:id/sessions/:sessionId',
      async ({ params, body, userId }) => {
        const me = requireUser(userId)
        const role = await chronicleAccess(db, me, params.id)
        if (role === null || role === 'former') throw notFound()
        if (role !== 'storyteller') throw storytellerRequired()
        const request = {
          sessionId: params.sessionId,
          revision: body.revision,
          date: civilDate(body.date),
          title: safeText(body.title, 120, true, true),
          summary: safeText(body.summary ?? '', 8000),
          privateNotes: safeText(body.privateNotes ?? '', 16000),
        }
        return db.transaction().execute(async trx => {
          const chronicle = await trx
            .selectFrom('chronicles')
            .select('storyteller_id')
            .where('id', '=', params.id)
            .forUpdate()
            .executeTakeFirst()
          if (!chronicle || chronicle.storyteller_id !== me) throw notFound()
          const session = await trx
            .selectFrom('chronicle_sessions')
            .select('revision')
            .where('chronicle_id', '=', params.id)
            .where('id', '=', params.sessionId)
            .forUpdate()
            .executeTakeFirst()
          if (!session) throw notFound()
          const now = options.now()
          return command(
            trx,
            {
              chronicleId: params.id,
              key: body.clientCommandId,
              kind: 'chronicle.session.update',
              request,
              actorId: me,
              at: now,
            },
            async () => {
              if (session.revision !== body.revision)
                throw revisionConflict(session.revision)
              const revision = session.revision + 1
              const row = await trx
                .updateTable('chronicle_sessions')
                .set({
                  session_date: request.date,
                  title: request.title,
                  public_summary: request.summary,
                  private_notes: request.privateNotes,
                  revision,
                  updated_at: now,
                })
                .where('id', '=', params.sessionId)
                .returning([
                  'id',
                  sessionDate,
                  'title',
                  'public_summary',
                  'private_notes',
                  'revision',
                ])
                .executeTakeFirstOrThrow()
              await audit(trx, {
                chronicleId: params.id,
                actorId: me,
                action: 'chronicle.session.update',
                payload: { sessionId: row.id, revision },
                at: now,
              })
              return { ...publicSession(row), privateNotes: row.private_notes }
            }
          )
        })
      },
      {
        params: t.Object({ id: uuid, sessionId: uuid }),
        body: t.Object({
          clientCommandId: uuid,
          revision: t.Integer({ minimum: 0 }),
          date: t.String({ pattern: '^\\d{4}-\\d{2}-\\d{2}$' }),
          title: t.String({ minLength: 1, maxLength: 120 }),
          summary: t.Optional(t.String({ maxLength: 8000 })),
          privateNotes: t.Optional(t.String({ maxLength: 16000 })),
        }),
      }
    )
    .patch(
      '/chronicles/:id',
      async ({ params, body, userId }) => {
        const me = requireUser(userId)
        const role = await chronicleAccess(db, me, params.id)
        if (role === null || role === 'former') throw notFound()
        if (role !== 'storyteller') throw storytellerRequired()
        const imageUrl = httpsUrl(body.imageUrl)
        if (body.imageUrl && !imageUrl)
          throw new ApiError(422, 'use uma URL HTTPS para a imagem')
        return db.transaction().execute(async trx => {
          const chronicle = await trx
            .selectFrom('chronicles')
            .select([
              'storyteller_id',
              'system_id',
              'settings_revision',
              'name',
              'description',
              'image_url',
              'options',
            ])
            .where('id', '=', params.id)
            .forUpdate()
            .executeTakeFirst()
          if (!chronicle) throw notFound()
          if (chronicle.storyteller_id !== me) throw storytellerRequired()
          const template = await latestTemplate(trx, chronicle.system_id)
          if (!template)
            throw new ApiError(422, 'sistema sem template publicado')
          const model = await modelFor(
            trx,
            chronicle.system_id,
            template.version
          )
          const selected = body.options ?? chronicle.options
          const issues = validateChronicleOptions(model, selected)
          if (issues.length)
            throw new ApiError(
              422,
              'Escolha um valor permitido pelo template.',
              {
                code: 'CHRONICLE_OPTION_INVALID',
                issues,
              }
            )
          const request = {
            revision: body.revision,
            name:
              body.name === undefined
                ? chronicle.name
                : safeText(body.name, 80, true, true),
            description:
              body.description === undefined
                ? chronicle.description
                : safeText(body.description, 4000),
            imageUrl:
              body.imageUrl === undefined ? chronicle.image_url : imageUrl,
            options: selected,
          }
          const now = options.now()
          return command(
            trx,
            {
              chronicleId: params.id,
              key: body.clientCommandId,
              kind: 'chronicle.settings',
              request,
              actorId: me,
              at: now,
            },
            async () => {
              if (chronicle.settings_revision !== body.revision)
                throw revisionConflict(chronicle.settings_revision)
              const revision = chronicle.settings_revision + 1
              await trx
                .updateTable('chronicles')
                .set({
                  name: request.name,
                  description: request.description,
                  image_url: request.imageUrl,
                  options: JSON.stringify(request.options),
                  settings_revision: revision,
                  updated_at: now,
                })
                .where('id', '=', params.id)
                .execute()
              await audit(trx, {
                chronicleId: params.id,
                actorId: me,
                action: 'chronicle.settings',
                payload: { revision },
                at: now,
              })
              return {
                name: request.name,
                description: request.description,
                imageUrl: request.imageUrl,
                options: effectiveChronicleOptions(model, request.options),
                revision,
              }
            }
          )
        })
      },
      {
        params: idParams,
        body: t.Object({
          clientCommandId: uuid,
          revision: t.Integer({ minimum: 0 }),
          name: t.Optional(t.String({ minLength: 1, maxLength: 80 })),
          description: t.Optional(t.String({ maxLength: 4000 })),
          imageUrl: t.Optional(
            t.Union([t.String({ maxLength: 2048 }), t.Null()])
          ),
          options: t.Optional(
            t.Record(
              t.String({ maxLength: 64 }),
              t.Union([t.Boolean(), t.Integer(), t.String({ maxLength: 80 })]),
              { maxProperties: 30 }
            )
          ),
        }),
      }
    )
    .post(
      '/chronicles/:id/transfer',
      async ({ params, body, userId, set }) => {
        const me = requireUser(userId)
        const role = await chronicleAccess(db, me, params.id)
        if (role === null || role === 'former') throw notFound()
        if (role !== 'storyteller') throw storytellerRequired()
        const request = { recipientId: body.recipientId }
        const hash = hashOf('chronicle.transfer.request', request)
        const result = await db.transaction().execute(async trx => {
          const chronicle = await trx
            .selectFrom('chronicles')
            .select('storyteller_id')
            .where('id', '=', params.id)
            .forUpdate()
            .executeTakeFirst()
          if (!chronicle) throw notFound()
          if (chronicle.storyteller_id !== me) throw storytellerRequired()
          if (body.recipientId === me) throw unavailable()
          const replay = await trx
            .selectFrom('chronicle_transfers')
            .selectAll()
            .where('chronicle_id', '=', params.id)
            .where('client_command_id', '=', body.clientCommandId)
            .executeTakeFirst()
          if (replay) {
            if (
              replay.requested_by !== me ||
              replay.request_hash !== hash ||
              replay.recipient_id !== body.recipientId
            )
              throw idempotencyConflict()
            return {
              id: replay.id,
              expiresAt: replay.expires_at,
              duplicate: true,
            }
          }
          const now = options.now()
          // Ler não muda o estado; o pedido vencido só fecha numa escrita.
          // Sem isso, ele ocuparia o índice de pendente para sempre: nem
          // cancelar (vencido) nem propor outro passariam.
          await trx
            .updateTable('chronicle_transfers')
            .set({ status: 'expired', decided_at: now })
            .where('chronicle_id', '=', params.id)
            .where('status', '=', 'pending')
            .where('expires_at', '<=', now)
            .execute()
          const pending = await trx
            .selectFrom('chronicle_transfers')
            .select('id')
            .where('chronicle_id', '=', params.id)
            .where('status', '=', 'pending')
            .executeTakeFirst()
          if (pending) throw unavailable()
          const member = await trx
            .selectFrom('chronicle_members')
            .select('user_id')
            .where('chronicle_id', '=', params.id)
            .where('user_id', '=', body.recipientId)
            .executeTakeFirst()
          if (!member) throw unavailable()
          const expiresAt = new Date(now.getTime() + 7 * DAY)
          const row = await trx
            .insertInto('chronicle_transfers')
            .values({
              chronicle_id: params.id,
              requested_by: me,
              recipient_id: body.recipientId,
              client_command_id: body.clientCommandId,
              request_hash: hash,
              requested_at: now,
              expires_at: expiresAt,
            })
            .returning(['id', 'expires_at'])
            .executeTakeFirstOrThrow()
          await audit(trx, {
            chronicleId: params.id,
            actorId: me,
            action: 'chronicle.transfer.request',
            userId: body.recipientId,
            payload: { transferId: row.id },
            at: now,
          })
          return { id: row.id, expiresAt: row.expires_at, duplicate: false }
        })
        set.status = result.duplicate ? 200 : 201
        return result
      },
      {
        params: idParams,
        body: t.Object({ clientCommandId: uuid, recipientId: uuid }),
      }
    )
    .get(
      '/chronicles/:id/transfer',
      async ({ params, userId }) => {
        const me = requireUser(userId)
        const row = await db
          .selectFrom('chronicle_transfers as tr')
          .innerJoin('chronicles as c', 'c.id', 'tr.chronicle_id')
          .innerJoin('users as u', 'u.id', 'tr.recipient_id')
          .select([
            'tr.id',
            'tr.status',
            'tr.recipient_id',
            'tr.requested_at',
            'tr.expires_at',
            'tr.decided_at',
            'c.storyteller_id',
            'u.username',
          ])
          .where('tr.chronicle_id', '=', params.id)
          .where(eb =>
            eb.or([
              eb('c.storyteller_id', '=', me),
              eb('tr.recipient_id', '=', me),
            ])
          )
          .orderBy('tr.requested_at', 'desc')
          .executeTakeFirst()
        if (!row) throw notFound()
        return {
          id: row.id,
          status: row.status,
          recipient: { id: row.recipient_id, username: row.username },
          requestedAt: row.requested_at,
          expiresAt: row.expires_at,
          decidedAt: row.decided_at,
          available:
            row.status === 'pending' &&
            new Date(row.expires_at).getTime() > options.now().getTime(),
        }
      },
      { params: idParams }
    )
    .post(
      '/chronicles/:id/transfer/:transferId/accept',
      async ({ params, body, userId }) => {
        const me = requireUser(userId)
        return db.transaction().execute(async trx => {
          const chronicle = await trx
            .selectFrom('chronicles')
            .select('storyteller_id')
            .where('id', '=', params.id)
            .forUpdate()
            .executeTakeFirst()
          if (!chronicle) throw notFound()
          const transfer = await trx
            .selectFrom('chronicle_transfers')
            .selectAll()
            .where('id', '=', params.transferId)
            .where('chronicle_id', '=', params.id)
            .forUpdate()
            .executeTakeFirst()
          if (!transfer || transfer.recipient_id !== me) throw notFound()
          if (
            transfer.status === 'accepted' &&
            transfer.decision_key === body.clientCommandId &&
            chronicle.storyteller_id === me
          )
            return { accepted: true, duplicate: true }
          const member = await trx
            .selectFrom('chronicle_members')
            .select('user_id')
            .where('chronicle_id', '=', params.id)
            .where('user_id', '=', me)
            .forUpdate()
            .executeTakeFirst()
          const now = options.now()
          if (
            transfer.status !== 'pending' ||
            transfer.requested_by !== chronicle.storyteller_id ||
            !member ||
            new Date(transfer.expires_at).getTime() <= now.getTime()
          )
            throw unavailable()
          const old = chronicle.storyteller_id
          await trx
            .updateTable('chronicles')
            .set({ storyteller_id: me, updated_at: now })
            .where('id', '=', params.id)
            .execute()
          await trx
            .deleteFrom('chronicle_members')
            .where('chronicle_id', '=', params.id)
            .where('user_id', '=', me)
            .execute()
          await trx
            .insertInto('chronicle_members')
            .values({ chronicle_id: params.id, user_id: old })
            .onConflict(oc => oc.doNothing())
            .execute()
          await trx
            .updateTable('characters')
            .set({ user_id: me })
            .where('chronicle_id', '=', params.id)
            .where('kind', '=', 'npc')
            .execute()
          await trx
            .updateTable('chronicle_transfers')
            .set({
              status: 'accepted',
              decision_key: body.clientCommandId,
              decided_at: now,
            })
            .where('id', '=', params.transferId)
            .execute()
          await audit(trx, {
            chronicleId: params.id,
            actorId: me,
            action: 'chronicle.transfer.accept',
            userId: old,
            payload: { transferId: params.transferId },
            at: now,
          })
          return { accepted: true, duplicate: false }
        })
      },
      {
        params: t.Object({ id: uuid, transferId: uuid }),
        body: t.Object({ clientCommandId: uuid }),
      }
    )
    .post(
      '/chronicles/:id/transfer/:transferId/reject',
      async ({ params, body, userId }) =>
        decideTransfer(db, options, {
          chronicleId: params.id,
          transferId: params.transferId,
          actorId: requireUser(userId),
          key: body.clientCommandId,
          decision: 'rejected',
        }),
      {
        params: t.Object({ id: uuid, transferId: uuid }),
        body: t.Object({ clientCommandId: uuid }),
      }
    )
    .post(
      '/chronicles/:id/transfer/:transferId/cancel',
      async ({ params, body, userId }) =>
        decideTransfer(db, options, {
          chronicleId: params.id,
          transferId: params.transferId,
          actorId: requireUser(userId),
          key: body.clientCommandId,
          decision: 'cancelled',
        }),
      {
        params: t.Object({ id: uuid, transferId: uuid }),
        body: t.Object({ clientCommandId: uuid }),
      }
    )
    .get(
      '/chronicles/:id/history',
      async ({ params, query, userId }) => {
        const me = requireUser(userId)
        if ((await chronicleAccess(db, me, params.id)) !== 'storyteller')
          throw notFound()
        const cursor = readCursor(query.cursor)
        if (query.cursor && !cursor) throw new ApiError(422, 'cursor inválido')
        const limit = query.limit ?? 30
        let batches = db
          .selectFrom('character_batches as b')
          .innerJoin('characters as ch', 'ch.id', 'b.character_id')
          .leftJoin('users as u', 'u.id', 'b.created_by')
          .leftJoin('chronicle_operations as o', 'o.id', 'b.operation_id')
          .select([
            'b.id',
            'b.created_at',
            'b.character_id',
            'b.operation_id',
            'b.session_id',
            'b.by_role',
            'u.username',
            'o.kind as operation_kind',
          ])
          .where('ch.chronicle_id', '=', params.id)
        let audits = db
          .selectFrom('chronicle_audit as a')
          .leftJoin('users as u', 'u.id', 'a.actor_id')
          .select([
            'a.id',
            'a.created_at',
            'a.action',
            'a.target_character_id',
            'a.payload',
            'u.username',
          ])
          .where('a.chronicle_id', '=', params.id)
        if (query.characterId) {
          const belongs = await db
            .selectFrom('characters')
            .select('id')
            .where('id', '=', query.characterId)
            .where('chronicle_id', '=', params.id)
            .executeTakeFirst()
          if (!belongs) throw notFound()
          batches = batches.where('b.character_id', '=', query.characterId)
          audits = audits.where('a.target_character_id', '=', query.characterId)
        }
        if (query.authorId) {
          batches = batches.where('b.created_by', '=', query.authorId)
          audits = audits.where('a.actor_id', '=', query.authorId)
        }
        if (query.from) {
          const from = new Date(query.from)
          batches = batches.where('b.created_at', '>=', from)
          audits = audits.where('a.created_at', '>=', from)
        }
        if (query.to) {
          const to = new Date(query.to)
          batches = batches.where('b.created_at', '<=', to)
          audits = audits.where('a.created_at', '<=', to)
        }
        if (cursor) {
          const at = new Date(cursor[0])
          const source = cursor[1]
          const id = cursor[2]
          batches = batches.where(eb =>
            eb.or([
              eb('b.created_at', '<', at),
              eb.and([
                eb('b.created_at', '=', at),
                source > 'batch'
                  ? eb.val(true)
                  : source === 'batch'
                    ? eb('b.id', '<', id)
                    : eb.val(false),
              ]),
            ])
          )
          audits = audits.where(eb =>
            eb.or([
              eb('a.created_at', '<', at),
              eb.and([
                eb('a.created_at', '=', at),
                source > 'audit'
                  ? eb.val(true)
                  : source === 'audit'
                    ? eb('a.id', '<', id)
                    : eb.val(false),
              ]),
            ])
          )
        }
        const [batchRows, auditRows] = await Promise.all([
          batches
            .orderBy('b.created_at', 'desc')
            .orderBy('b.id', 'desc')
            .limit(limit + 1)
            .execute(),
          audits
            .orderBy('a.created_at', 'desc')
            .orderBy('a.id', 'desc')
            .limit(limit + 1)
            .execute(),
        ])
        const all = [
          ...batchRows.map(row => ({
            source: 'batch' as const,
            id: row.id,
            at: row.created_at,
            characterId: row.character_id,
            operationId: row.operation_id,
            sessionId: row.session_id,
            action: row.operation_kind ?? 'sheet.change',
            by: row.username === null ? null : { username: row.username },
          })),
          ...auditRows.map(row => ({
            source: 'audit' as const,
            id: row.id,
            at: row.created_at,
            characterId: row.target_character_id,
            operationId: null,
            sessionId:
              row.payload &&
              typeof row.payload === 'object' &&
              !Array.isArray(row.payload) &&
              typeof (row.payload as { sessionId?: unknown }).sessionId ===
                'string'
                ? ((row.payload as { sessionId: string }).sessionId ?? null)
                : null,
            action: row.action,
            by: row.username === null ? null : { username: row.username },
          })),
        ].sort((a, b) => {
          const date = new Date(b.at).getTime() - new Date(a.at).getTime()
          if (date) return date
          // Mesma ordem do banco (uuid compara como o texto em minúsculas);
          // localeCompare dependeria do locale e divergiria do cursor
          if (a.source !== b.source) return a.source < b.source ? 1 : -1
          return a.id < b.id ? 1 : a.id > b.id ? -1 : 0
        })
        const page = all.slice(0, limit)
        const last = page.at(-1)
        return {
          items: page,
          nextCursor:
            all.length > limit && last
              ? cursorOf(last.at, last.source, last.id)
              : null,
        }
      },
      {
        params: idParams,
        query: t.Object({
          limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
          cursor: t.Optional(t.String({ maxLength: 500 })),
          characterId: t.Optional(uuid),
          authorId: t.Optional(uuid),
          from: t.Optional(t.String({ format: 'date-time' })),
          to: t.Optional(t.String({ format: 'date-time' })),
        }),
      }
    )
}

async function decideTransfer(
  db: Kysely<DB>,
  options: AppOptions,
  args: {
    chronicleId: string
    transferId: string
    actorId: string
    key: string
    decision: 'rejected' | 'cancelled'
  }
) {
  return db.transaction().execute(async trx => {
    const chronicle = await trx
      .selectFrom('chronicles')
      .select('storyteller_id')
      .where('id', '=', args.chronicleId)
      .forUpdate()
      .executeTakeFirst()
    if (!chronicle) throw notFound()
    const transfer = await trx
      .selectFrom('chronicle_transfers')
      .selectAll()
      .where('id', '=', args.transferId)
      .where('chronicle_id', '=', args.chronicleId)
      .forUpdate()
      .executeTakeFirst()
    if (!transfer) throw notFound()
    const allowed =
      args.decision === 'rejected'
        ? transfer.recipient_id === args.actorId
        : chronicle.storyteller_id === args.actorId
    if (!allowed) throw notFound()
    if (transfer.status === args.decision && transfer.decision_key === args.key)
      return { status: args.decision, duplicate: true }
    const now = options.now()
    if (
      transfer.status !== 'pending' ||
      new Date(transfer.expires_at).getTime() <= now.getTime()
    )
      throw unavailable()
    await trx
      .updateTable('chronicle_transfers')
      .set({ status: args.decision, decision_key: args.key, decided_at: now })
      .where('id', '=', args.transferId)
      .execute()
    await audit(trx, {
      chronicleId: args.chronicleId,
      actorId: args.actorId,
      action:
        args.decision === 'rejected'
          ? 'chronicle.transfer.reject'
          : 'chronicle.transfer.cancel',
      payload: { transferId: args.transferId },
      at: now,
    })
    return { status: args.decision, duplicate: false }
  })
}
