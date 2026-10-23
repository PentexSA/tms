import type { DB } from '@tms/db'
import {
  type ActionPlan,
  applyBatch,
  type ChangeLabel,
  classifyBatch,
  type GroupDamage,
  type HistoryEvent,
  invertBatch,
  parsePath,
  planGroupDamage,
  planRecovery,
  type SheetData,
  type SheetEvent,
  type SheetModel,
  withEffectiveFrom,
  writePolicy,
} from '@tms/sheet-core'
import { Elysia, t } from 'elysia'
import type { Kysely, Transaction } from 'kysely'
import type { authGuard } from '../auth/guard'
import { requireUser } from '../auth/guard'
import { chronicleAccess } from '../authz'
import { ApiError } from '../http/errors'
import { idParams, uuid } from '../http/params'
import type { AppOptions } from '../options'
import { modelFor } from '../sheets/models'

// Operações em grupo do narrador (doc/painel-narrador.md §5.4; doc/plano-v3.md,
// Etapa 11): dano ou cura em várias fichas de uma vez, e a reversão de uma
// operação ou de um lote. O contrato:
// - as fichas são travadas com FOR UPDATE em ordem de id, sempre (duas
//   operações que se cruzam nunca esperam uma pela outra em ciclo);
// - DEPOIS das travas, a idempotência: a mesma `clientOperationId` devolve o
//   resultado original (`duplicate: true`) e nada se aplica;
// - qualquer `sheetVersion` diferente da prévia: 409 com a prévia nova;
// - cada lote passa pelo applyBatch e pela política; uma ficha recusada, ou
//   de outra crônica, recusa a operação inteira.

const notFound = () => new ApiError(404, 'não encontrado')
export const MAX_TARGETS = 20

type Kind = 'damage' | 'heal' | 'recovery'
type Operation =
  | Omit<GroupDamage, 'field'>
  | { readonly kind: 'recovery'; readonly recoveryId: string }

function readOperation(body: {
  kind: string
  amount?: number
  type?: string
  recoveryId?: string
}): Operation {
  if (body.kind === 'recovery') {
    if (!body.recoveryId)
      throw new ApiError(422, 'escolha o período de recuperação')
    return { kind: 'recovery', recoveryId: body.recoveryId }
  }
  if (body.amount === undefined) throw new ApiError(422, 'diga a quantidade')
  return {
    kind: body.kind as 'damage' | 'heal',
    amount: body.amount,
    ...(body.type && { type: body.type }),
  }
}

interface Locked {
  readonly id: string
  readonly name: string
  readonly sheet: SheetData
  readonly sheetVersion: number
  readonly status: string
  readonly lockedAt: Date | null
  readonly model: SheetModel
}

// text e longText entram no histórico sem conteúdo (contrato §10)
const contentFree = (model: SheetModel, path: string) => {
  const p = parsePath(path)
  const type = p ? model.fields.get(p.fieldId)?.def.type : undefined
  return type === 'text' || type === 'longText' || p?.scope === 'specialties'
}

/** Trava as fichas em ordem de id. Outra crônica, excluída ou ausente: 404. */
async function lockCharacters(
  db: Kysely<DB>,
  trx: Transaction<DB>,
  chronicleId: string,
  ids: readonly string[]
): Promise<Map<string, Locked>> {
  const unique = [...new Set(ids)].sort()
  if (unique.length !== ids.length)
    throw new ApiError(422, 'cada ficha deve aparecer uma vez')
  const rows = await trx
    .selectFrom('characters')
    .select([
      'id',
      'name',
      'chronicle_id',
      'system_id',
      'template_version',
      'sheet_data',
      'sheet_version',
      'deleted_at',
      'status',
      'locked_at',
    ])
    .where('id', 'in', unique)
    .orderBy('id')
    .forUpdate()
    .execute()
  if (
    rows.length !== unique.length ||
    rows.some(r => r.chronicle_id !== chronicleId || r.deleted_at !== null)
  )
    throw notFound()
  const out = new Map<string, Locked>()
  for (const r of rows)
    out.set(r.id, {
      id: r.id,
      name: r.name,
      sheet: r.sheet_data as unknown as SheetData,
      sheetVersion: r.sheet_version,
      status: r.status,
      lockedAt: r.locked_at === null ? null : new Date(r.locked_at),
      model: await modelFor(db, r.system_id, r.template_version),
    })
  return out
}

interface Planned {
  readonly characterId: string
  readonly name: string
  readonly sheetVersion: number
  readonly plan: ActionPlan
}

const planAll = (
  locked: ReadonlyMap<string, Locked>,
  targets: readonly { readonly characterId: string; readonly field?: string }[],
  op: Operation
): Planned[] =>
  targets.map(target => {
    const c = locked.get(target.characterId) as Locked
    return {
      characterId: c.id,
      name: c.name,
      sheetVersion: c.sheetVersion,
      plan:
        op.kind === 'recovery'
          ? planRecovery(c.model, c.sheet, op.recoveryId)
          : planGroupDamage(c.model, c.sheet, {
              ...op,
              ...(target.field && { field: target.field }),
            }),
    }
  })

// A prévia por ficha, sem os eventos crus: o texto e a versão lida
const previewOut = (planned: readonly Planned[]) =>
  planned.map(p => ({
    characterId: p.characterId,
    name: p.name,
    sheetVersion: p.sheetVersion,
    ok: p.plan.ok,
    ...(p.plan.ok
      ? { label: p.plan.label, changes: p.plan.preview as ChangeLabel[] }
      : { reason: p.plan.reason }),
  }))

/** Grava um lote de uma ficha da operação, com o histórico. */
async function writeBatch(
  trx: Transaction<DB>,
  args: {
    readonly character: Locked
    readonly events: readonly SheetEvent[]
    readonly sheet: SheetData
    readonly operationId: string
    readonly userId: string
    readonly now: Date
  }
) {
  const { character: c } = args
  const sheetVersion = c.sheetVersion + 1
  await trx
    .updateTable('characters')
    .set({
      sheet_data: JSON.stringify(args.sheet),
      sheet_version: sheetVersion,
      updated_at: args.now,
    })
    .where('id', '=', c.id)
    .execute()
  const batch = await trx
    .insertInto('character_batches')
    .values({
      character_id: c.id,
      // O lote é do servidor: a chave do cliente fica na operação
      client_batch_id: crypto.randomUUID(),
      created_by: args.userId,
      by_role: 'storyteller',
      sheet_version: sheetVersion,
      created_at: args.now,
      operation_id: args.operationId,
    })
    .returning('id')
    .executeTakeFirstOrThrow()
  await trx
    .insertInto('character_events')
    .values(
      withEffectiveFrom(c.model, c.sheet, args.events).map((e, seq) => {
        const hide = contentFree(c.model, e.path)
        return {
          batch_id: batch.id,
          seq,
          path: e.path,
          from_value: hide ? null : JSON.stringify(e.from ?? null),
          to_value: hide ? null : JSON.stringify(e.to ?? null),
          from_absent: (args.events[seq]?.from ?? null) === null,
        }
      })
    )
    .execute()
  return { characterId: c.id, batchId: batch.id, sheetVersion }
}

/** Aplica os lotes de cada ficha, todos ou nenhum, e grava a operação. */
async function applyAll(
  trx: Transaction<DB>,
  args: {
    readonly chronicleId: string
    readonly clientOperationId: string
    readonly kind: Kind | 'revert'
    readonly userId: string
    readonly now: Date
    readonly reverts?: {
      readonly operationId?: string
      readonly batchId?: string
    }
    readonly batches: readonly {
      readonly character: Locked
      readonly events: readonly SheetEvent[]
    }[]
  }
) {
  const sheets = args.batches.map(({ character: c, events }) => {
    const result = applyBatch(c.model, c.sheet, { events }, ['storyteller'])
    if (!result.ok)
      throw new ApiError(422, 'a operação não se aplica a esta ficha', {
        characterId: c.id,
        issues: result.issues.map(i => ({ path: i.path, message: i.message })),
      })
    // A política da Etapa 5: o narrador escreve em todos os estados
    const verdict = writePolicy(
      { owner: false, storyteller: true, member: true },
      c.status,
      c.lockedAt !== null,
      classifyBatch(c.model, c.sheet, events).parts.map(p => p.kind)
    )
    if (!verdict.ok)
      throw new ApiError(403, 'sem permissão de escrita', {
        code: verdict.code,
        characterId: c.id,
      })
    return result.sheet
  })
  const operation = await trx
    .insertInto('chronicle_operations')
    .values({
      chronicle_id: args.chronicleId,
      client_operation_id: args.clientOperationId,
      kind: args.kind,
      created_by: args.userId,
      created_at: args.now,
      reverts_operation_id: args.reverts?.operationId ?? null,
      reverts_batch_id: args.reverts?.batchId ?? null,
    })
    .returning('id')
    .executeTakeFirstOrThrow()
  const results = []
  for (const [i, { character, events }] of args.batches.entries())
    results.push(
      await writeBatch(trx, {
        character,
        events,
        sheet: sheets[i] as SheetData,
        operationId: operation.id,
        userId: args.userId,
        now: args.now,
      })
    )
  // Em ordem de ficha, como o reenvio devolve
  results.sort((a, b) => (a.characterId < b.characterId ? -1 : 1))
  return { operationId: operation.id, duplicate: false, characters: results }
}

/** O resultado de uma operação já gravada: o reenvio recebe o mesmo. */
async function stored(trx: Kysely<DB> | Transaction<DB>, operationId: string) {
  const batches = await trx
    .selectFrom('character_batches')
    .select(['id', 'character_id', 'sheet_version'])
    .where('operation_id', '=', operationId)
    .orderBy('character_id')
    .execute()
  return {
    operationId,
    duplicate: true,
    characters: batches.map(b => ({
      characterId: b.character_id,
      batchId: b.id,
      sheetVersion: b.sheet_version,
    })),
  }
}

const findOperation = (
  trx: Kysely<DB> | Transaction<DB>,
  chronicleId: string,
  clientOperationId: string
) =>
  trx
    .selectFrom('chronicle_operations')
    .select('id')
    .where('chronicle_id', '=', chronicleId)
    .where('client_operation_id', '=', clientOperationId)
    .executeTakeFirst()

/** Os lotes que a reversão desfaz, com o histórico de cada um. */
async function revertTargets(
  db: Kysely<DB>,
  chronicleId: string,
  target: { readonly operationId?: string; readonly batchId?: string }
) {
  let q = db
    .selectFrom('character_batches as b')
    .innerJoin('characters as ch', 'ch.id', 'b.character_id')
    .leftJoin('chronicle_operations as o', 'o.id', 'b.operation_id')
    .select(['b.id', 'b.character_id', 'o.kind as operationKind'])
    .where('ch.chronicle_id', '=', chronicleId)
  if (target.operationId) {
    const op = await db
      .selectFrom('chronicle_operations')
      .select('kind')
      .where('id', '=', target.operationId)
      .where('chronicle_id', '=', chronicleId)
      .executeTakeFirst()
    if (!op) throw notFound()
    if (op.kind === 'revert')
      throw new ApiError(422, 'uma reversão não se desfaz: aplique de novo')
    q = q.where('b.operation_id', '=', target.operationId)
  } else q = q.where('b.id', '=', target.batchId as string)
  const batches = await q.orderBy('b.character_id').execute()
  if (!batches.length) throw notFound()
  if (batches.some(b => b.operationKind === 'revert'))
    throw new ApiError(422, 'uma reversão não se desfaz: aplique de novo')
  return batches
}

const alreadyReverted = async (
  trx: Transaction<DB>,
  target: { readonly operationId?: string; readonly batchId?: string },
  batchOperationIds: readonly (string | null)[],
  batchIds: readonly string[]
) => {
  const operations = [
    ...(target.operationId ? [target.operationId] : []),
    ...batchOperationIds.filter((id): id is string => id !== null),
  ]
  const hit = await trx
    .selectFrom('chronicle_operations')
    .select('id')
    .where(eb =>
      eb.or([
        ...(operations.length
          ? [eb('reverts_operation_id', 'in', operations)]
          : []),
        eb('reverts_batch_id', 'in', batchIds),
      ])
    )
    .executeTakeFirst()
  return hit !== undefined
}

const isUniqueViolation = (e: unknown, constraint: string) => {
  const err = e as { code?: unknown; constraint?: unknown; message?: unknown }
  return (
    err?.code === '23505' &&
    (err.constraint === constraint ||
      String(err.message ?? '').includes(constraint))
  )
}

const target = t.Object({
  characterId: uuid,
  field: t.Optional(t.String({ minLength: 1, maxLength: 64 })),
})

export function operationRoutes(
  db: Kysely<DB>,
  options: AppOptions,
  guard: ReturnType<typeof authGuard>
) {
  const requireStoryteller = async (userId: string, chronicleId: string) => {
    const role = await chronicleAccess(db, userId, chronicleId)
    if (role === null || role === 'former') throw notFound()
    if (role !== 'storyteller')
      throw new ApiError(403, 'só o narrador pode fazer isso')
  }

  return new Elysia()
    .use(guard)
    .post(
      '/chronicles/:id/operations/preview',
      async ({ params, body, userId }) => {
        const me = requireUser(userId)
        await requireStoryteller(me, params.id)
        // Só lê: a transação existe para ler todas as fichas no mesmo instante
        return db.transaction().execute(async trx => {
          const locked = await lockCharacters(
            db,
            trx,
            params.id,
            body.targets.map(x => x.characterId)
          )
          return {
            characters: previewOut(
              planAll(locked, body.targets, readOperation(body))
            ),
          }
        })
      },
      {
        params: idParams,
        body: t.Object({
          kind: t.Union([
            t.Literal('damage'),
            t.Literal('heal'),
            t.Literal('recovery'),
          ]),
          amount: t.Optional(t.Integer({ minimum: 1, maximum: 50 })),
          recoveryId: t.Optional(t.String({ minLength: 1, maxLength: 64 })),
          type: t.Optional(t.String({ minLength: 1, maxLength: 40 })),
          targets: t.Array(target, { minItems: 1, maxItems: MAX_TARGETS }),
        }),
      }
    )
    .post(
      '/chronicles/:id/operations',
      async ({ params, body, userId, set }) => {
        const me = requireUser(userId)
        await requireStoryteller(me, params.id)
        const key = body.clientOperationId
        const run = async () => {
          if (body.kind === 'revert') {
            const reverts =
              body.revertsOperationId && !body.revertsBatchId
                ? { operationId: body.revertsOperationId }
                : body.revertsBatchId && !body.revertsOperationId
                  ? { batchId: body.revertsBatchId }
                  : null
            if (!reverts)
              throw new ApiError(
                422,
                'diga o que desfazer: a operação ou o lote'
              )
            const batches = await revertTargets(db, params.id, reverts)
            return db.transaction().execute(async trx => {
              const locked = await lockCharacters(
                db,
                trx,
                params.id,
                batches.map(b => b.character_id)
              )
              const done = await findOperation(trx, params.id, key)
              if (done) return stored(trx, done.id)
              const owners = await trx
                .selectFrom('character_batches')
                .select('operation_id')
                .where(
                  'id',
                  'in',
                  batches.map(b => b.id)
                )
                .execute()
              if (
                await alreadyReverted(
                  trx,
                  reverts,
                  owners.map(o => o.operation_id),
                  batches.map(b => b.id)
                )
              )
                throw new ApiError(409, 'isto já foi desfeito')
              const inverted = []
              const conflicts = []
              for (const b of batches) {
                const c = locked.get(b.character_id) as Locked
                const events = await trx
                  .selectFrom('character_events')
                  .select(['path', 'from_value', 'to_value', 'from_absent'])
                  .where('batch_id', '=', b.id)
                  .orderBy('seq')
                  .execute()
                const result = invertBatch(
                  c.model,
                  c.sheet,
                  events.map(
                    (e): HistoryEvent => ({
                      path: e.path,
                      from: e.from_value,
                      to: e.to_value,
                      fromAbsent: e.from_absent,
                    })
                  )
                )
                if (!result.ok && result.kind === 'irreversible')
                  throw new ApiError(
                    422,
                    'este lote tem texto: não dá para desfazer',
                    { paths: result.paths }
                  )
                if (!result.ok)
                  conflicts.push({ characterId: c.id, paths: result.paths })
                else inverted.push({ character: c, events: result.events })
              }
              // Nada de reversão parcial
              if (conflicts.length)
                throw new ApiError(409, 'a ficha mudou depois', {
                  code: 'REVERT_CONFLICT',
                  conflicts,
                })
              return applyAll(trx, {
                chronicleId: params.id,
                clientOperationId: key,
                kind: 'revert',
                userId: me,
                now: options.now(),
                reverts,
                batches: inverted,
              })
            })
          }

          const targets = body.targets ?? []
          if (!targets.length) throw new ApiError(422, 'diga as fichas')
          const operation = readOperation(body)
          return db.transaction().execute(async trx => {
            const locked = await lockCharacters(
              db,
              trx,
              params.id,
              targets.map(x => x.characterId)
            )
            // Depois das travas: o reenvio simultâneo espera o primeiro gravar
            const done = await findOperation(trx, params.id, key)
            if (done) return stored(trx, done.id)
            const planned = planAll(locked, targets, operation)
            if (
              targets.some(
                x => locked.get(x.characterId)?.sheetVersion !== x.sheetVersion
              )
            )
              throw new ApiError(409, 'a mesa mudou depois da prévia', {
                preview: previewOut(planned),
              })
            const unavailable = planned.filter(p => !p.plan.ok)
            if (unavailable.length)
              throw new ApiError(422, 'a operação não se aplica a todas', {
                preview: previewOut(planned),
              })
            return applyAll(trx, {
              chronicleId: params.id,
              clientOperationId: key,
              kind: body.kind as Kind,
              userId: me,
              now: options.now(),
              batches: planned.map(p => ({
                character: locked.get(p.characterId) as Locked,
                events: p.plan.ok ? p.plan.events : [],
              })),
            })
          })
        }
        try {
          const result = await run()
          set.status = result.duplicate ? 200 : 201
          return result
        } catch (e) {
          // O índice único é a última barreira: a mesma chave por outro
          // caminho vira a mesma resposta, nunca um 500
          if (!isUniqueViolation(e, 'chronicle_operations_client_key')) throw e
          const done = await findOperation(db, params.id, key)
          if (!done) throw e
          set.status = 200
          return stored(db, done.id)
        }
      },
      {
        params: idParams,
        body: t.Object({
          clientOperationId: uuid,
          kind: t.Union([
            t.Literal('damage'),
            t.Literal('heal'),
            t.Literal('recovery'),
            t.Literal('revert'),
          ]),
          amount: t.Optional(t.Integer({ minimum: 1, maximum: 50 })),
          recoveryId: t.Optional(t.String({ minLength: 1, maxLength: 64 })),
          type: t.Optional(t.String({ minLength: 1, maxLength: 40 })),
          targets: t.Optional(
            t.Array(
              t.Object({
                characterId: uuid,
                sheetVersion: t.Integer({ minimum: 0 }),
                field: t.Optional(t.String({ minLength: 1, maxLength: 64 })),
              }),
              { minItems: 1, maxItems: MAX_TARGETS }
            )
          ),
          revertsOperationId: t.Optional(uuid),
          revertsBatchId: t.Optional(uuid),
        }),
      }
    )
}
