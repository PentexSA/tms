import type { DB } from '@tms/db'
import {
  applyBatch,
  manualResult,
  type PoolPlan,
  type PoolResult,
  parsePath,
  planPool,
  poolRollOf,
  rollPool,
  type SheetData,
  type SheetModel,
  stripRestricted,
  withEffectiveFrom,
} from '@tms/sheet-core'
import { Elysia, t } from 'elysia'
import type { Kysely, Transaction } from 'kysely'
import type { authGuard } from '../auth/guard'
import { requireUser } from '../auth/guard'
import { characterAccess } from '../authz'
import { ApiError } from '../http/errors'
import { idParams, uuid } from '../http/params'
import type { AppOptions } from '../options'
import { modelFor } from '../sheets/models'

// Rolagem de dados no servidor (doc/plano-v0.md, Etapa 21). O cliente manda só
// o pedido (slots, atalho, dificuldade, especialização, boosts); o servidor monta a
// parada da ficha gravada, rola com CSPRNG e grava. Resultado de dado vindo do
// cliente nunca é aceito: o corpo não tem onde pô-lo, e o parser descarta o
// que sobra. "Rolei na mão" é a única entrada de resultado, e fica marcada
// como manual. O custo (FdV) é um lote do histórico, na mesma transação, com
// a ficha travada.

const notFound = () => new ApiError(404, 'não encontrado')

type Row = {
  id: string
  created_at: Date | string
  by_role: string
  manual: boolean
  label: string
  request: unknown
  result: unknown
  // Null: a conta de quem rolou foi excluída (migration 0013)
  username: string | null
}

interface StoredRequest {
  readonly slots: Readonly<Record<string, string>>
  readonly difficulty: number
  readonly specialty: boolean
  readonly boosts: readonly string[]
  // Atalho do template (roll.presets); o servidor o resolve do seu modelo
  readonly preset?: string
}

interface StoredResult extends PoolResult {
  readonly dice: number
  readonly die: number
  readonly penalty: number
  readonly specialty: boolean
  readonly modifiers: readonly { label: string; change: string }[]
}

const rollOut = (row: Row) => {
  const request = row.request as StoredRequest
  const result = row.result as StoredResult
  return {
    id: row.id,
    at: row.created_at,
    by: row.username === null ? null : { username: row.username },
    byRole: row.by_role,
    label: row.label,
    manual: row.manual,
    difficulty: request.difficulty,
    specialty: result.specialty,
    dice: result.dice,
    die: result.die,
    penalty: result.penalty,
    auto: result.auto,
    faces: result.faces,
    total: result.total,
    outcome: result.outcome,
    text: result.text,
    modifiers: result.modifiers,
  }
}

const planFailure = (plan: Extract<PoolPlan, { ok: false }>) =>
  new ApiError(422, plan.reason, { kind: plan.kind })

/** O custo dos boosts como um lote do histórico (o mesmo da Etapa 15). */
async function recordCost(
  trx: Transaction<DB>,
  args: {
    characterId: string
    userId: string
    byRole: string
    model: SheetModel
    before: SheetData
    sheet: SheetData
    sheetVersion: number
    events: Extract<PoolPlan, { ok: true }>['events']
    now: Date
  }
): Promise<string> {
  await trx
    .updateTable('characters')
    .set({
      sheet_data: JSON.stringify(args.sheet),
      sheet_version: args.sheetVersion,
      updated_at: args.now,
    })
    .where('id', '=', args.characterId)
    .execute()
  const batch = await trx
    .insertInto('character_batches')
    .values({
      character_id: args.characterId,
      // O lote é do servidor: o id do cliente fica na rolagem
      client_batch_id: crypto.randomUUID(),
      created_by: args.userId,
      by_role: args.byRole,
      sheet_version: args.sheetVersion,
      created_at: args.now,
    })
    .returning('id')
    .executeTakeFirstOrThrow()
  await trx
    .insertInto('character_events')
    .values(
      // O "de" efetivo, como no endpoint de eventos ("FdV 7 → 6" com a FdV
      // ainda no padrão)
      withEffectiveFrom(args.model, args.before, args.events).map((e, seq) => ({
        batch_id: batch.id,
        seq,
        path: e.path,
        from_value: JSON.stringify(e.from ?? null),
        to_value: JSON.stringify(e.to ?? null),
      }))
    )
    .execute()
  return batch.id
}

export function rollRoutes(
  db: Kysely<DB>,
  options: AppOptions,
  guard: ReturnType<typeof authGuard>
) {
  const selectRoll = (q: Kysely<DB> | Transaction<DB>) =>
    q
      .selectFrom('character_rolls as r')
      // Left: rolagem de conta excluída continua na lista, sem autor
      .leftJoin('users as u', 'u.id', 'r.created_by')
      .select([
        'r.id',
        'r.created_at',
        'r.by_role',
        'r.manual',
        'r.label',
        'r.request',
        'r.result',
        'u.username',
      ])

  return new Elysia()
    .use(guard)
    .post(
      '/characters/:id/rolls',
      async ({ params, body, userId, set }) => {
        const me = requireUser(userId)
        const access = await characterAccess(db, me, params.id)
        if (!access) throw notFound()
        const roles = access.roles
        // Rolar gasta recurso e entra no histórico: só quem escreve na ficha
        if (!roles.has('owner') && !roles.has('storyteller'))
          throw new ApiError(403, 'só o dono da ficha e o narrador rolam')
        for (const key of [`user:${me}`, `character:${params.id}`]) {
          const d = options.limits.rolls.hit(key)
          if (!d.allowed) {
            set.headers['retry-after'] = String(d.retryAfterSeconds)
            throw new ApiError(
              429,
              'muitas rolagens seguidas; tente de novo em instantes'
            )
          }
        }
        const model = await modelFor(
          db,
          access.character.systemId,
          access.character.templateVersion
        )
        if (!poolRollOf(model))
          throw new ApiError(422, 'este sistema não usa parada de dados', {
            kind: 'unsupported',
          })
        const byRole = roles.has('owner') ? 'owner' : 'storyteller'

        return db.transaction().execute(async trx => {
          const character = await trx
            .selectFrom('characters')
            .select(['sheet_data', 'sheet_version', 'deleted_at'])
            .where('id', '=', params.id)
            .forUpdate()
            .executeTakeFirstOrThrow()
          if (character.deleted_at !== null) throw notFound()
          const current = character.sheet_data as unknown as SheetData

          // Reenvio: a mesma rolagem não rola de novo nem cobra duas vezes
          const done = await selectRoll(trx)
            .where('r.character_id', '=', params.id)
            .where('r.client_roll_id', '=', body.clientRollId)
            .executeTakeFirst()
          if (done)
            return {
              duplicate: true,
              roll: rollOut(done),
              sheetVersion: character.sheet_version,
              sheet: stripRestricted(model, current, roles),
            }

          const request: StoredRequest = {
            slots: body.slots,
            difficulty: body.difficulty,
            specialty: body.specialty ?? false,
            boosts: body.boosts ?? [],
            ...(body.preset ? { preset: body.preset } : {}),
          }
          const plan = planPool(model, current, request, roles)
          if (!plan.ok) throw planFailure(plan)
          const result = body.manual
            ? manualResult(
                body.manual.successes,
                body.manual.botch ?? false,
                plan.auto
              )
            : rollPool(plan, options.random)
          if (!result)
            throw new ApiError(422, 'resultado manual inválido', {
              kind: 'invalid',
            })

          let sheet = current
          let sheetVersion = character.sheet_version
          let batchId: string | null = null
          if (plan.events.length) {
            const applied = applyBatch(model, current, plan, roles)
            if (!applied.ok)
              throw new ApiError(422, 'não foi possível pagar o custo', {
                kind: 'cost',
                issues: applied.issues
                  .filter(i => parsePath(i.path))
                  .map(i => ({ path: i.path, message: i.message })),
              })
            sheet = applied.sheet
            sheetVersion += 1
            batchId = await recordCost(trx, {
              characterId: params.id,
              userId: me,
              byRole,
              model,
              before: current,
              sheet,
              sheetVersion,
              events: plan.events,
              now: options.now(),
            })
          }

          const stored: StoredResult = {
            ...result,
            dice: plan.dice,
            die: plan.die,
            penalty: plan.penalty,
            specialty: plan.specialty,
            modifiers: plan.modifiers,
          }
          const inserted = await trx
            .insertInto('character_rolls')
            .values({
              character_id: params.id,
              client_roll_id: body.clientRollId,
              created_by: me,
              by_role: byRole,
              manual: Boolean(body.manual),
              label: plan.label,
              request: JSON.stringify(request),
              result: JSON.stringify(stored),
              batch_id: batchId,
              created_at: options.now(),
            })
            .returning('id')
            .executeTakeFirstOrThrow()
          const row = await selectRoll(trx)
            .where('r.id', '=', inserted.id)
            .executeTakeFirstOrThrow()
          set.status = 201
          return {
            duplicate: false,
            roll: rollOut(row),
            sheetVersion,
            sheet: stripRestricted(model, sheet, roles),
          }
        })
      },
      {
        params: idParams,
        body: t.Object({
          clientRollId: uuid,
          // slot → chave da opção; o core confere contra o template
          slots: t.Record(
            t.String({ minLength: 1, maxLength: 40 }),
            t.String({ minLength: 1, maxLength: 120 }),
            { maxProperties: 8 }
          ),
          difficulty: t.Integer({ minimum: 1, maximum: 100 }),
          specialty: t.Optional(t.Boolean()),
          boosts: t.Optional(
            t.Array(t.String({ minLength: 1, maxLength: 40 }), {
              maxItems: 4,
            })
          ),
          // Atalho do template ("Conjurar efeito"): fixa os slots dele
          preset: t.Optional(t.String({ minLength: 1, maxLength: 40 })),
          // "Rolei na mão": os sucessos dos dados, informados pela pessoa
          manual: t.Optional(
            t.Object({
              successes: t.Integer({ minimum: 0, maximum: 50 }),
              botch: t.Optional(t.Boolean()),
            })
          ),
        }),
      }
    )
    .get(
      '/characters/:id/rolls',
      async ({ params, query, userId }) => {
        const me = requireUser(userId)
        const access = await characterAccess(db, me, params.id)
        if (!access) throw notFound()
        const rows = await selectRoll(db)
          .where('r.character_id', '=', params.id)
          .orderBy('r.created_at', 'desc')
          .orderBy('r.id', 'desc')
          .limit(query.limit ?? 20)
          .execute()
        return { items: rows.map(rollOut) }
      },
      {
        params: idParams,
        query: t.Object({
          limit: t.Optional(t.Numeric({ minimum: 1, maximum: 50 })),
        }),
      }
    )
}
