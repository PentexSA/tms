import { createHash } from 'node:crypto'
import type { DB } from '@tms/db'
import {
  applyBatch,
  isSafeText,
  type SheetData,
  type SheetEvent,
  xpLedgerFields,
} from '@tms/sheet-core'
import { Elysia, t } from 'elysia'
import type { Kysely, Transaction } from 'kysely'
import { audit } from '../audit'
import type { authGuard } from '../auth/guard'
import { requireUser } from '../auth/guard'
import { characterAccess, chronicleAccess } from '../authz'
import {
  findOperation,
  isUniqueViolation,
  type Locked,
  lockCharacters,
  MAX_TARGETS,
  notFound,
  writeBatch,
} from '../chronicles/operations'
import { ApiError } from '../http/errors'
import { idParams, uuid } from '../http/params'
import type { AppOptions } from '../options'
import { modelFor } from '../sheets/models'

// Extrato de experiência (doc/plano-v4.md, Etapa 6; §3.5). `xp_entries` é a
// fonte única do saldo; `xpTotal` e `xpSpent` da ficha são projeções da soma,
// gravadas na mesma transação, num lote do servidor ligado a uma operação
// da crônica (`xp-grant`, `xp-adjust`, `xp-spend`) que a reversão genérica
// recusa. Nenhum papel grava as projeções por /events.
//
// Concessão: só o narrador, até 20 fichas, tudo ou nada, fichas travadas em
// ordem de id, idempotente pela chave da operação. Vale em qualquer estado
// (criação, pendente, ativa, arquivada, fora de jogo, travada) e para ficha
// de dono ex-membro; só ficha excluída fica de fora (§2.3, definição 23).
// Ajuste/estorno: delta sobre o total, motivo, referência no estorno, e o
// total nunca abaixo do gasto.

export const MAX_XP = 1000
const REASON_MAX = 200

export interface Balance {
  readonly total: number
  readonly spent: number
  readonly available: number
}

/** O saldo de cada ficha, somado do extrato. */
export async function balances(
  trx: Kysely<DB> | Transaction<DB>,
  ids: readonly string[]
): Promise<Map<string, Balance>> {
  const out = new Map<string, Balance>()
  for (const id of ids) out.set(id, { total: 0, spent: 0, available: 0 })
  if (!ids.length) return out
  const rows = await trx
    .selectFrom('xp_entries')
    .select(eb => [
      'character_id',
      eb.fn.coalesce(eb.fn.sum<string>('total_delta'), eb.lit(0)).as('total'),
      eb.fn.coalesce(eb.fn.sum<string>('spent_delta'), eb.lit(0)).as('spent'),
    ])
    .where('character_id', 'in', ids)
    .groupBy('character_id')
    .execute()
  for (const r of rows) {
    const total = Number(r.total)
    const spent = Number(r.spent)
    out.set(r.character_id, { total, spent, available: total - spent })
  }
  return out
}

/** A intenção de uma operação: a mesma chave com outra intenção é conflito. */
export const intentHash = (intent: unknown): string =>
  createHash('sha256').update(JSON.stringify(intent)).digest('hex')

export const idempotencyConflict = () =>
  new ApiError(409, 'esta chave já foi usada para outra operação', {
    code: 'IDEMPOTENCY_CONFLICT',
  })

export const unsupported = (characterId: string) =>
  new ApiError(422, 'este sistema não tem extrato de XP', {
    code: 'XP_UNSUPPORTED',
    characterId,
  })

/** Motivo de uma linha, sem quebra de linha nem marcação. */
export function readReason(raw: string): string {
  const reason = raw.trim()
  if (
    !reason ||
    reason.length > REASON_MAX ||
    !isSafeText(reason) ||
    /[\t\n\r]/.test(reason)
  )
    throw new ApiError(422, 'motivo inválido', {
      issues: [{ path: 'reason', message: 'motivo de 1 a 200 caracteres' }],
    })
  return reason
}

const raw = (sheet: SheetData, id: string) =>
  Object.hasOwn(sheet.values, id) ? sheet.values[id] : null

/**
 * Grava um lançamento: o lote da projeção (o total ou o gasto vão para a
 * soma do extrato) e a linha do extrato. O lote passa pelo applyBatch do
 * narrador: projeção acima do máximo do campo é 422, sem nada gravado.
 */
export async function writeEntry(
  trx: Transaction<DB>,
  args: {
    readonly character: Locked
    readonly balance: Balance
    readonly kind: 'grant' | 'adjust'
    readonly delta: number
    readonly reason: string
    readonly reversesEntryId?: string
    readonly operationId: string
    readonly userId: string
    readonly now: Date
    readonly sessionId?: string
  }
) {
  const { character: c } = args
  const [totalField] = xpLedgerFields(c.model)
  if (!totalField) throw unsupported(c.id)
  const total = args.balance.total + args.delta
  const events: SheetEvent[] = [
    { path: `values.${totalField}`, from: raw(c.sheet, totalField), to: total },
  ]
  const result = applyBatch(c.model, c.sheet, { events }, ['storyteller'])
  if (!result.ok)
    throw new ApiError(422, 'o total passa do limite da ficha', {
      code: 'XP_LIMIT',
      characterId: c.id,
      issues: result.issues.map(i => ({ path: i.path, message: i.message })),
    })
  const written = await writeBatch(trx, {
    character: c,
    events,
    sheet: result.sheet,
    operationId: args.operationId,
    userId: args.userId,
    now: args.now,
    sessionId: args.sessionId,
  })
  const entry = await trx
    .insertInto('xp_entries')
    .values({
      character_id: c.id,
      kind: args.kind,
      total_delta: args.delta,
      reason: args.reason,
      reverses_entry_id: args.reversesEntryId ?? null,
      operation_id: args.operationId,
      batch_id: written.batchId,
      created_by: args.userId,
      created_at: args.now,
    })
    .returning('id')
    .executeTakeFirstOrThrow()
  return {
    characterId: c.id,
    entryId: entry.id,
    batchId: written.batchId,
    sheetVersion: written.sheetVersion,
    balance: {
      total,
      spent: args.balance.spent,
      available: total - args.balance.spent,
    },
  }
}

/** O resultado de uma operação de XP já gravada: o reenvio recebe o mesmo. */
async function storedEntries(
  trx: Kysely<DB> | Transaction<DB>,
  operationId: string
) {
  const rows = await trx
    .selectFrom('xp_entries as e')
    .innerJoin('character_batches as b', 'b.id', 'e.batch_id')
    .select(['e.id', 'e.character_id', 'e.batch_id', 'b.sheet_version'])
    .where('e.operation_id', '=', operationId)
    .orderBy('e.character_id')
    .execute()
  const sums = await balances(
    trx,
    rows.map(r => r.character_id)
  )
  return {
    operationId,
    duplicate: true,
    characters: rows.map(r => ({
      characterId: r.character_id,
      entryId: r.id,
      batchId: r.batch_id,
      sheetVersion: r.sheet_version,
      balance: sums.get(r.character_id),
    })),
  }
}

/** A operação gravada com esta chave, conferindo que a intenção é a mesma. */
async function replay(
  trx: Kysely<DB> | Transaction<DB>,
  chronicleId: string,
  key: string,
  hash: string
) {
  const done = await findOperation(trx, chronicleId, key)
  if (!done) return null
  const op = await trx
    .selectFrom('chronicle_operations')
    .select('request_hash')
    .where('id', '=', done.id)
    .executeTakeFirstOrThrow()
  if (op.request_hash !== hash) throw idempotencyConflict()
  return storedEntries(trx, done.id)
}

export function ledgerRoutes(
  db: Kysely<DB>,
  options: AppOptions,
  guard: ReturnType<typeof authGuard>
) {
  const requireStoryteller = async (userId: string, chronicleId: string) => {
    const role = await chronicleAccess(db, userId, chronicleId)
    if (role === null || role === 'former') throw notFound()
    if (role !== 'storyteller')
      throw new ApiError(403, 'só o narrador concede XP')
  }

  // A mesma chave por outro caminho (dois envios simultâneos): o índice
  // único é a última barreira, e o reenvio recebe o resultado gravado
  const recover = async <T>(
    chronicleId: string,
    key: string,
    hash: string,
    run: () => Promise<T>
  ) => {
    try {
      return await run()
    } catch (e) {
      if (!isUniqueViolation(e, 'chronicle_operations_client_key')) throw e
      const done = await replay(db, chronicleId, key, hash)
      if (!done) throw e
      return done
    }
  }

  return new Elysia()
    .use(guard)
    .post(
      '/chronicles/:id/xp',
      async ({ params, body, userId, set }) => {
        const me = requireUser(userId)
        await requireStoryteller(me, params.id)
        const reason = readReason(body.reason)
        const ids = body.targets.map(x => x.characterId)
        const hash = intentHash({
          kind: 'xp-grant',
          amount: body.amount,
          reason,
          characters: [...ids].sort(),
          sessionId: body.sessionId ?? null,
        })
        const key = body.clientOperationId
        const result = await recover(params.id, key, hash, () =>
          db.transaction().execute(async trx => {
            const locked = await lockCharacters(db, trx, params.id, ids)
            // Depois das travas: o reenvio simultâneo espera o primeiro gravar
            const done = await replay(trx, params.id, key, hash)
            if (done) return done
            if (body.sessionId) {
              const session = await trx
                .selectFrom('chronicle_sessions')
                .select('id')
                .where('id', '=', body.sessionId)
                .where('chronicle_id', '=', params.id)
                .executeTakeFirst()
              if (!session) throw notFound()
            }
            for (const c of locked.values())
              if (!xpLedgerFields(c.model).length) throw unsupported(c.id)
            const sums = await balances(trx, [...locked.keys()])
            const now = options.now()
            const operation = await trx
              .insertInto('chronicle_operations')
              .values({
                chronicle_id: params.id,
                client_operation_id: key,
                kind: 'xp-grant',
                created_by: me,
                created_at: now,
                request_hash: hash,
                session_id: body.sessionId ?? null,
              })
              .returning('id')
              .executeTakeFirstOrThrow()
            const characters = []
            for (const c of locked.values())
              characters.push(
                await writeEntry(trx, {
                  character: c,
                  balance: sums.get(c.id) as Balance,
                  kind: 'grant',
                  delta: body.amount,
                  reason,
                  operationId: operation.id,
                  userId: me,
                  now,
                  sessionId: body.sessionId,
                })
              )
            await audit(trx, {
              chronicleId: params.id,
              actorId: me,
              action: 'xp.grant',
              payload: {
                operationId: operation.id,
                amount: String(body.amount),
                characters: [...locked.keys()],
              },
              at: now,
            })
            return { operationId: operation.id, duplicate: false, characters }
          })
        )
        set.status = result.duplicate ? 200 : 201
        return result
      },
      {
        params: idParams,
        body: t.Object({
          clientOperationId: uuid,
          amount: t.Integer({ minimum: 1, maximum: MAX_XP }),
          reason: t.String({ minLength: 1, maxLength: REASON_MAX }),
          targets: t.Array(t.Object({ characterId: uuid }), {
            minItems: 1,
            maxItems: MAX_TARGETS,
          }),
          sessionId: t.Optional(uuid),
        }),
      }
    )
    .post(
      '/characters/:id/xp-adjustments',
      async ({ params, body, userId, set }) => {
        const me = requireUser(userId)
        const access = await characterAccess(db, me, params.id)
        if (!access || access.roles.has('viewer')) throw notFound()
        if (!access.roles.has('storyteller'))
          throw new ApiError(403, 'só o narrador ajusta o XP')
        const reason = readReason(body.reason)
        const chronicleId = access.character.chronicleId
        const hash = intentHash({
          kind: 'xp-adjust',
          characterId: params.id,
          delta: body.delta,
          reason,
          reverses: body.reversesEntryId ?? null,
          sessionId: body.sessionId ?? null,
        })
        const key = body.clientOperationId
        const result = await recover(chronicleId, key, hash, () =>
          db.transaction().execute(async trx => {
            const locked = await lockCharacters(db, trx, chronicleId, [
              params.id,
            ])
            const done = await replay(trx, chronicleId, key, hash)
            if (done) return done
            if (body.sessionId) {
              const session = await trx
                .selectFrom('chronicle_sessions')
                .select('id')
                .where('id', '=', body.sessionId)
                .where('chronicle_id', '=', chronicleId)
                .executeTakeFirst()
              if (!session) throw notFound()
            }
            const c = locked.get(params.id) as Locked
            if (!xpLedgerFields(c.model).length) throw unsupported(c.id)
            if (body.delta === 0)
              throw new ApiError(422, 'o ajuste precisa mudar o total', {
                issues: [{ path: 'delta', message: 'diferente de zero' }],
              })
            if (body.reversesEntryId !== undefined) {
              const grant = await trx
                .selectFrom('xp_entries')
                .select(['total_delta'])
                .where('id', '=', body.reversesEntryId)
                .where('character_id', '=', params.id)
                .where('kind', '=', 'grant')
                .executeTakeFirst()
              if (!grant || body.delta > 0)
                throw new ApiError(422, 'o estorno aponta uma concessão', {
                  code: 'XP_REVERSAL_INVALID',
                })
              const reversed = await trx
                .selectFrom('xp_entries')
                .select(eb =>
                  eb.fn
                    .coalesce(eb.fn.sum<string>('total_delta'), eb.lit(0))
                    .as('sum')
                )
                .where('reverses_entry_id', '=', body.reversesEntryId)
                .executeTakeFirstOrThrow()
              const remaining = grant.total_delta + Number(reversed.sum)
              if (-body.delta > remaining)
                throw new ApiError(409, 'o estorno passa do que resta', {
                  code: 'XP_REVERSAL_EXCEEDS',
                  remaining,
                })
            }
            const balance = (await balances(trx, [c.id])).get(c.id) as Balance
            if (balance.total + body.delta < balance.spent)
              // Crédito já consumido: o limite atual, sem desfazer evolução
              throw new ApiError(
                409,
                'o total não pode ficar abaixo do gasto',
                {
                  code: 'XP_ADJUST_LIMIT',
                  total: balance.total,
                  spent: balance.spent,
                  minDelta: balance.spent - balance.total,
                }
              )
            const now = options.now()
            const operation = await trx
              .insertInto('chronicle_operations')
              .values({
                chronicle_id: chronicleId,
                client_operation_id: key,
                kind: 'xp-adjust',
                created_by: me,
                created_at: now,
                request_hash: hash,
                session_id: body.sessionId ?? null,
              })
              .returning('id')
              .executeTakeFirstOrThrow()
            const entry = await writeEntry(trx, {
              character: c,
              balance,
              kind: 'adjust',
              delta: body.delta,
              reason,
              ...(body.reversesEntryId && {
                reversesEntryId: body.reversesEntryId,
              }),
              operationId: operation.id,
              userId: me,
              now,
              sessionId: body.sessionId,
            })
            await audit(trx, {
              chronicleId,
              actorId: me,
              action: 'xp.adjust',
              characterId: c.id,
              userId: access.character.userId,
              payload: {
                operationId: operation.id,
                delta: String(body.delta),
                reversesEntryId: body.reversesEntryId ?? null,
              },
              at: now,
            })
            return {
              operationId: operation.id,
              duplicate: false,
              characters: [entry],
            }
          })
        )
        set.status = result.duplicate ? 200 : 201
        return result
      },
      {
        params: idParams,
        body: t.Object({
          clientOperationId: uuid,
          delta: t.Integer({ minimum: -9999, maximum: 9999 }),
          reason: t.String({ minLength: 1, maxLength: REASON_MAX }),
          reversesEntryId: t.Optional(uuid),
          sessionId: t.Optional(uuid),
        }),
      }
    )
    .get(
      '/characters/:id/xp',
      async ({ params, query, userId }) => {
        const me = requireUser(userId)
        // Dono e narrador; outro jogador não tem papel na ficha (404)
        const access = await characterAccess(db, me, params.id)
        if (!access || access.roles.has('viewer')) throw notFound()
        const model = await modelFor(
          db,
          access.character.systemId,
          access.character.templateVersion
        )
        if (!xpLedgerFields(model).length)
          return { supported: false, balance: null, items: [], next: null }
        const limit = query.limit ?? 20
        let q = db
          .selectFrom('xp_entries as e')
          .leftJoin('users as u', 'u.id', 'e.created_by')
          .leftJoin('xp_requests as r', 'r.id', 'e.request_id')
          .select(eb => [
            'e.id',
            'e.kind',
            'e.total_delta',
            'e.spent_delta',
            'e.reason',
            'e.reverses_entry_id',
            'e.batch_id',
            'e.operation_id',
            'e.request_id',
            'e.created_at',
            'u.username',
            'r.target_field',
            'r.target_item',
            'r.target_name',
            'r.from_value',
            'r.to_value',
            // Quanto da concessão ainda pode ser estornado
            eb
              .selectFrom('xp_entries as x')
              .select(x =>
                x.fn
                  .coalesce(x.fn.sum<string>('x.total_delta'), x.lit(0))
                  .as('s')
              )
              .whereRef('x.reverses_entry_id', '=', 'e.id')
              .as('reversed'),
          ])
          .where('e.character_id', '=', params.id)
        if (query.before) {
          const [at, id] = query.before.split('_')
          const when = new Date(at ?? '')
          if (Number.isNaN(when.getTime()) || !id)
            throw new ApiError(400, 'dados inválidos')
          q = q.where(eb =>
            eb.or([
              eb('e.created_at', '<', when),
              eb.and([eb('e.created_at', '=', when), eb('e.id', '<', id)]),
            ])
          )
        }
        const rows = await q
          .orderBy('e.created_at', 'desc')
          .orderBy('e.id', 'desc')
          .limit(limit)
          .execute()
        const balance = (await balances(db, [params.id])).get(params.id)
        const last = rows.at(-1)
        return {
          supported: true,
          balance,
          items: rows.map(r => ({
            id: r.id,
            kind: r.kind,
            totalDelta: r.total_delta,
            spentDelta: r.spent_delta,
            reason: r.reason,
            reversesEntryId: r.reverses_entry_id,
            batchId: r.batch_id,
            operationId: r.operation_id,
            at: r.created_at,
            by: r.username === null ? null : { username: r.username },
            ...(r.kind === 'grant' && {
              reversible: r.total_delta + Number(r.reversed ?? 0),
            }),
            ...(r.request_id && {
              request: {
                id: r.request_id,
                field: r.target_field,
                label:
                  model.fields.get(r.target_field ?? '')?.def.label ?? null,
                item: r.target_item,
                name: r.target_name,
                from: r.from_value,
                to: r.to_value,
              },
            }),
          })),
          next:
            rows.length === limit && last
              ? `${new Date(last.created_at).toISOString()}_${last.id}`
              : null,
        }
      },
      {
        params: idParams,
        query: t.Object({
          before: t.Optional(t.String({ maxLength: 80 })),
          limit: t.Optional(t.Numeric({ minimum: 1, maximum: 50 })),
        }),
      }
    )
}
