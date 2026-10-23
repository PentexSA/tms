import type { DB } from '@tms/db'
import {
  applyBatch,
  costOf,
  isSafeText,
  planXpSpend,
  type SheetModel,
  type XpTarget,
  xpTargetKey,
} from '@tms/sheet-core'
import { Elysia, t } from 'elysia'
import type { Kysely, Selectable, Transaction } from 'kysely'
import { audit } from '../audit'
import type { authGuard } from '../auth/guard'
import { requireUser } from '../auth/guard'
import { characterAccess, chronicleAccess } from '../authz'
import {
  isUniqueViolation,
  type Locked,
  lockCharacters,
  notFound,
  writeBatch,
} from '../chronicles/operations'
import { ApiError } from '../http/errors'
import { idParams, uuid } from '../http/params'
import type { AppOptions } from '../options'
import { modelFor } from '../sheets/models'
import { lockCharacter, writeAccess } from '../sheets/policy'
import {
  type Balance,
  balances,
  idempotencyConflict,
  intentHash,
  readReason,
} from './ledger'

// Pedidos de evolução por XP (doc/plano-v4.md, Etapa 7; §3.5). O dono pede um
// nível por vez, com o custo que o core calcula; o narrador aprova (o traço
// sobe e o gasto entra no extrato, num lote só), recusa com motivo, ou o dono
// cancela. Sem reserva: o saldo é conferido no envio e na aprovação.
//
// Ordem de travas: quem decide trava o pedido e DEPOIS a ficha. O envio trava
// só a ficha e conta com o índice único parcial para a unicidade; nenhum
// caminho trava a ficha e depois espera um pedido.
//
// Arquivar, marcar fora de jogo ou remover o dono não decide o pedido: ele
// fica suspenso (derivado na leitura) e a aprovação responde 409 sem efeito.
// Ler nunca muda nada.

type Row = Selectable<DB['xp_requests']>

const xpError = (status: number, code: string, message: string, extra = {}) =>
  new ApiError(status, message, { code, ...extra })

const COST_MESSAGES: Readonly<Record<string, string>> = {
  XP_COST_UNAVAILABLE: 'este traço não oferece evolução por XP neste template',
  XP_TARGET_INVALID: 'este traço não pode ser pedido',
  XP_MAX_REACHED: 'o traço já está no máximo',
  XP_PREREQUISITE: 'falta um pré-requisito para subir este traço',
}

const targetOf = (r: Row): XpTarget => ({
  field: r.target_field,
  ...(r.target_item !== null && { item: r.target_item }),
  ...(r.target_name !== null && { name: r.target_name }),
})

/** O rótulo do traço: o do campo e, num item, o nome dele. */
function labelOf(model: SheetModel | null, r: Row, itemName?: string | null) {
  const field = model?.fields.get(r.target_field)?.def.label ?? r.target_field
  const name = r.target_name ?? itemName
  return name ? `${field}: ${name}` : field
}

function requestOut(
  r: Row,
  model: SheetModel | null,
  extra: {
    readonly suspended?: boolean
    readonly itemName?: string | null
  } = {}
) {
  return {
    id: r.id,
    characterId: r.character_id,
    field: r.target_field,
    item: r.target_item,
    name: r.target_name,
    label: labelOf(model, r, extra.itemName),
    from: r.from_value,
    to: r.to_value,
    cost: r.cost,
    status: r.status,
    reason: r.reason,
    requestedAt: r.requested_at,
    decidedAt: r.decided_at,
    batchId: r.batch_id,
    ...(extra.suspended !== undefined && { suspended: extra.suspended }),
  }
}

const isMember = async (
  trx: Kysely<DB> | Transaction<DB>,
  chronicleId: string,
  userId: string
) =>
  (await trx
    .selectFrom('chronicle_members')
    .select('user_id')
    .where('chronicle_id', '=', chronicleId)
    .where('user_id', '=', userId)
    .executeTakeFirst()) !== undefined

/** O nome atual dos itens pedidos por id (o rótulo do pedido). */
function itemName(sheet: unknown, r: Row): string | null {
  if (r.target_item === null) return null
  const values = (sheet as { values?: Record<string, unknown> })?.values ?? {}
  const list = Object.hasOwn(values, r.target_field)
    ? values[r.target_field]
    : null
  if (!Array.isArray(list)) return null
  const item = list.find(
    (x: unknown) => (x as { id?: unknown })?.id === r.target_item
  ) as { name?: unknown } | undefined
  return typeof item?.name === 'string' ? item.name : null
}

export function requestRoutes(
  db: Kysely<DB>,
  options: AppOptions,
  guard: ReturnType<typeof authGuard>
) {
  /** O pedido travado, da ficha da rota. */
  const lockRequest = async (
    trx: Transaction<DB>,
    characterId: string,
    requestId: string
  ) => {
    const row = await trx
      .selectFrom('xp_requests')
      .selectAll()
      .where('id', '=', requestId)
      .where('character_id', '=', characterId)
      .forUpdate()
      .executeTakeFirst()
    if (!row) throw notFound()
    return row
  }

  // Pedido já decidido: a mesma decisão com a mesma chave recupera o
  // resultado; qualquer outra é conflito
  const decided = (
    r: Row,
    key: string,
    status: 'approved' | 'rejected' | 'cancelled'
  ) => {
    if (r.status === 'pending') return false
    if (r.decision_key === key && r.status === status) return true
    if (r.decision_key === key && r.status === 'stale')
      throw xpError(
        409,
        'XP_REQUEST_STALE',
        'o traço ou o custo mudou: faça um novo pedido'
      )
    throw xpError(409, 'XP_REQUEST_DECIDED', 'o pedido já foi decidido', {
      status: r.status,
    })
  }

  return new Elysia()
    .use(guard)
    .post(
      '/characters/:id/xp-requests',
      async ({ params, body, userId, set }) => {
        const me = requireUser(userId)
        const access = await characterAccess(db, me, params.id)
        if (!access || access.roles.has('viewer')) throw notFound()
        if (!access.roles.has('owner'))
          throw new ApiError(403, 'o pedido é do dono da ficha', {
            code: 'FORBIDDEN',
          })
        const target: XpTarget = {
          field: body.field,
          ...(body.item !== undefined && { item: body.item }),
          ...(body.name !== undefined && { name: body.name.trim() }),
        }
        if (
          target.name !== undefined &&
          (!target.name ||
            !isSafeText(target.name) ||
            /[\t\n\r]/.test(target.name))
        )
          throw xpError(422, 'XP_TARGET_INVALID', 'nome inválido', {
            issues: [{ path: 'name', message: 'nome inválido' }],
          })
        const model = await modelFor(
          db,
          access.character.systemId,
          access.character.templateVersion
        )
        const run = () =>
          db.transaction().execute(async trx => {
            const c = await lockCharacter(trx, params.id)
            // Reenvio: a mesma chave devolve o pedido gravado
            const again = await trx
              .selectFrom('xp_requests')
              .selectAll()
              .where('character_id', '=', params.id)
              .where('client_request_id', '=', body.clientRequestId)
              .executeTakeFirst()
            if (again) {
              if (again.target_key !== xpTargetKey(target))
                throw idempotencyConflict()
              return { request: again, duplicate: true }
            }
            // Vínculo, estado e trava antes da conta (§3.6)
            const writer = await writeAccess(
              trx,
              access.roles,
              c.chronicleId,
              me
            )
            if (!writer.member)
              throw xpError(
                403,
                'NOT_MEMBER',
                'você não faz mais parte desta crônica'
              )
            if (c.status !== 'active')
              throw xpError(
                403,
                'SHEET_NOT_EDITABLE',
                'a ficha não aceita pedidos neste estado',
                { reason: c.status }
              )
            if (c.lockedAt !== null)
              throw xpError(
                403,
                'SHEET_LOCKED',
                'o narrador travou a ficha: o pedido não foi enviado'
              )
            const cost = costOf(model, c.sheet, target)
            if (!cost.ok)
              throw xpError(
                422,
                cost.code,
                COST_MESSAGES[cost.code] ?? 'pedido inválido',
                { reason: cost.reason }
              )
            if (body.to !== undefined && body.to > cost.to)
              throw xpError(422, 'XP_ONE_LEVEL', 'peça um nível por vez', {
                issues: [{ path: 'to', message: 'peça um nível por vez' }],
              })
            if (
              (body.to !== undefined && body.to < cost.to) ||
              (body.expectedCost !== undefined &&
                body.expectedCost !== cost.cost)
            )
              throw xpError(
                409,
                'XP_REQUEST_STALE',
                'o traço ou o custo mudou: faça um novo pedido',
                { from: cost.from, to: cost.to, cost: cost.cost }
              )
            const balance = (await balances(trx, [params.id])).get(
              params.id
            ) as Balance
            if (balance.available < cost.cost)
              throw xpError(
                409,
                'XP_INSUFFICIENT_BALANCE',
                'saldo de XP insuficiente para esta evolução',
                { available: balance.available, cost: cost.cost }
              )
            const key = xpTargetKey(target)
            const pending = await trx
              .selectFrom('xp_requests')
              .select('id')
              .where('character_id', '=', params.id)
              .where('target_key', '=', key)
              .where('status', '=', 'pending')
              .executeTakeFirst()
            if (pending)
              throw xpError(
                409,
                'XP_REQUEST_PENDING',
                'já existe um pedido pendente para este traço',
                { requestId: pending.id }
              )
            const now = options.now()
            const request = await trx
              .insertInto('xp_requests')
              .values({
                character_id: params.id,
                client_request_id: body.clientRequestId,
                target_field: target.field,
                target_item: target.item ?? null,
                target_name: target.name ?? null,
                target_key: key,
                from_value: cost.from,
                to_value: cost.to,
                cost: cost.cost,
                context: JSON.stringify(cost.context),
                requested_by: me,
                requested_at: now,
              })
              .returningAll()
              .executeTakeFirstOrThrow()
            await audit(trx, {
              chronicleId: c.chronicleId,
              actorId: me,
              action: 'xp.request.create',
              characterId: params.id,
              userId: me,
              payload: { requestId: request.id, field: target.field },
              at: now,
            })
            return { request, duplicate: false }
          })
        let result: { request: Row; duplicate: boolean }
        try {
          result = await run()
        } catch (e) {
          // Corrida com outro envio: o índice decide, nunca um 500
          if (isUniqueViolation(e, 'xp_requests_pending_key'))
            throw xpError(
              409,
              'XP_REQUEST_PENDING',
              'já existe um pedido pendente para este traço'
            )
          if (!isUniqueViolation(e, 'xp_requests_client_key')) throw e
          result = await run()
        }
        set.status = result.duplicate ? 200 : 201
        return {
          duplicate: result.duplicate,
          request: requestOut(result.request, model),
        }
      },
      {
        params: idParams,
        body: t.Object({
          clientRequestId: uuid,
          field: t.String({ minLength: 1, maxLength: 64 }),
          item: t.Optional(t.String({ minLength: 1, maxLength: 40 })),
          name: t.Optional(t.String({ minLength: 1, maxLength: 80 })),
          to: t.Optional(t.Integer({ minimum: 0, maximum: 1_000_000 })),
          expectedCost: t.Optional(
            t.Integer({ minimum: 1, maximum: 1_000_000 })
          ),
        }),
      }
    )
    .get(
      '/characters/:id/xp-requests',
      async ({ params, query, userId }) => {
        const me = requireUser(userId)
        const access = await characterAccess(db, me, params.id)
        if (!access || access.roles.has('viewer')) throw notFound()
        const model = await modelFor(
          db,
          access.character.systemId,
          access.character.templateVersion
        )
        const character = await db
          .selectFrom('characters')
          .select(['status', 'sheet_data'])
          .where('id', '=', params.id)
          .executeTakeFirstOrThrow()
        const member = await isMember(
          db,
          access.character.chronicleId,
          access.character.userId
        )
        // Suspenso: derivado na leitura, sem mudar o pedido
        const suspended = character.status !== 'active' || !member
        let q = db
          .selectFrom('xp_requests')
          .selectAll()
          .where('character_id', '=', params.id)
        if (query.status) q = q.where('status', '=', query.status)
        const rows = await q
          .orderBy('requested_at', 'desc')
          .orderBy('id', 'desc')
          .limit(query.limit ?? 50)
          .execute()
        return {
          items: rows.map(r =>
            requestOut(r, model, {
              suspended: r.status === 'pending' && suspended,
              itemName: itemName(character.sheet_data, r),
            })
          ),
        }
      },
      {
        params: idParams,
        query: t.Object({
          status: t.Optional(
            t.Union([
              t.Literal('pending'),
              t.Literal('approved'),
              t.Literal('rejected'),
              t.Literal('cancelled'),
              t.Literal('stale'),
            ])
          ),
          limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
        }),
      }
    )
    .get(
      '/chronicles/:id/xp-requests',
      async ({ params, userId }) => {
        const me = requireUser(userId)
        const role = await chronicleAccess(db, me, params.id)
        if (role === null || role === 'former') throw notFound()
        if (role !== 'storyteller')
          throw new ApiError(403, 'só o narrador vê os pedidos da mesa')
        const rows = await db
          .selectFrom('xp_requests as r')
          .innerJoin('characters as ch', 'ch.id', 'r.character_id')
          .leftJoin('chronicle_members as m', join =>
            join
              .onRef('m.chronicle_id', '=', 'ch.chronicle_id')
              .onRef('m.user_id', '=', 'ch.user_id')
          )
          .selectAll('r')
          .select([
            'ch.name as characterName',
            'ch.status as characterStatus',
            'ch.system_id',
            'ch.template_version',
            'ch.sheet_data',
            'm.user_id as member',
          ])
          .where('ch.chronicle_id', '=', params.id)
          .where('ch.deleted_at', 'is', null)
          .where('r.status', '=', 'pending')
          .orderBy('r.requested_at')
          .orderBy('r.id')
          .limit(200)
          .execute()
        const items = []
        for (const r of rows) {
          const model = await modelFor(db, r.system_id, r.template_version)
          items.push({
            ...requestOut(r, model, {
              suspended: r.characterStatus !== 'active' || r.member === null,
              itemName: itemName(r.sheet_data, r),
            }),
            characterName: r.characterName,
          })
        }
        return { items }
      },
      { params: idParams }
    )
    .post(
      '/characters/:id/xp-requests/:requestId/approve',
      async ({ params, body, userId }) => {
        const me = requireUser(userId)
        const access = await characterAccess(db, me, params.id)
        if (!access || access.roles.has('viewer')) throw notFound()
        if (!access.roles.has('storyteller'))
          throw new ApiError(403, 'só o narrador aprova', { code: 'FORBIDDEN' })
        const chronicleId = access.character.chronicleId
        const key = body.decisionKey
        const run = () =>
          db.transaction().execute(async trx => {
            const r = await lockRequest(trx, params.id, params.requestId)
            if (decided(r, key, 'approved'))
              return { kind: 'done' as const, request: r, duplicate: true }
            const locked = await lockCharacters(db, trx, chronicleId, [
              params.id,
            ])
            const c = locked.get(params.id) as Locked
            if (body.sessionId) {
              const session = await trx
                .selectFrom('chronicle_sessions')
                .select('id')
                .where('id', '=', body.sessionId)
                .where('chronicle_id', '=', chronicleId)
                .executeTakeFirst()
              if (!session) throw notFound()
            }
            if (
              c.status !== 'active' ||
              !(await isMember(trx, chronicleId, access.character.userId))
            )
              return { kind: 'unavailable' as const }
            const balance = (await balances(trx, [c.id])).get(c.id) as Balance
            const plan = planXpSpend(
              c.model,
              c.sheet,
              { target: targetOf(r), from: r.from_value, cost: r.cost },
              { spent: balance.spent, newItemId: crypto.randomUUID() }
            )
            const now = options.now()
            if (!plan.ok) {
              // Persistido antes do 409: o erro não pode desfazer a marcação
              const stale = await trx
                .updateTable('xp_requests')
                .set({
                  status: 'stale',
                  decided_by: me,
                  decided_at: now,
                  decision_key: key,
                })
                .where('id', '=', r.id)
                .returningAll()
                .executeTakeFirstOrThrow()
              await audit(trx, {
                chronicleId,
                actorId: me,
                action: 'xp.request.stale',
                characterId: c.id,
                userId: access.character.userId,
                payload: { requestId: r.id, why: plan.stale },
                at: now,
              })
              return { kind: 'stale' as const, request: stale, why: plan.stale }
            }
            if (balance.available < plan.cost)
              throw xpError(
                409,
                'XP_INSUFFICIENT_BALANCE',
                'saldo de XP insuficiente para esta evolução',
                { available: balance.available, cost: plan.cost }
              )
            const result = applyBatch(
              c.model,
              c.sheet,
              { events: plan.events },
              ['storyteller']
            )
            if (!result.ok)
              throw new ApiError(422, 'a evolução não cabe na ficha', {
                issues: result.issues.map(i => ({
                  path: i.path,
                  message: i.message,
                })),
              })
            const operation = await trx
              .insertInto('chronicle_operations')
              .values({
                chronicle_id: chronicleId,
                client_operation_id: key,
                kind: 'xp-spend',
                created_by: me,
                created_at: now,
                request_hash: intentHash({
                  approve: r.id,
                  sessionId: body.sessionId ?? null,
                }),
                session_id: body.sessionId ?? null,
              })
              .returning('id')
              .executeTakeFirstOrThrow()
            const written = await writeBatch(trx, {
              character: c,
              events: plan.events,
              sheet: result.sheet,
              operationId: operation.id,
              userId: me,
              now,
              sessionId: body.sessionId,
            })
            await trx
              .insertInto('xp_entries')
              .values({
                character_id: c.id,
                kind: 'spend',
                spent_delta: plan.cost,
                operation_id: operation.id,
                batch_id: written.batchId,
                request_id: r.id,
                created_by: me,
                created_at: now,
              })
              .execute()
            const approved = await trx
              .updateTable('xp_requests')
              .set({
                status: 'approved',
                decided_by: me,
                decided_at: now,
                decision_key: key,
                batch_id: written.batchId,
              })
              .where('id', '=', r.id)
              .returningAll()
              .executeTakeFirstOrThrow()
            await audit(trx, {
              chronicleId,
              actorId: me,
              action: 'xp.request.approve',
              characterId: c.id,
              userId: access.character.userId,
              payload: { requestId: r.id, cost: String(plan.cost) },
              at: now,
            })
            return {
              kind: 'done' as const,
              request: approved,
              duplicate: false,
              sheetVersion: written.sheetVersion,
              balance: {
                total: balance.total,
                spent: balance.spent + plan.cost,
                available: balance.available - plan.cost,
              },
            }
          })
        let outcome: Awaited<ReturnType<typeof run>>
        try {
          outcome = await run()
        } catch (e) {
          // A chave da decisão já foi usada por outra operação da crônica
          if (isUniqueViolation(e, 'chronicle_operations_client_key'))
            throw idempotencyConflict()
          throw e
        }
        if (outcome.kind === 'unavailable')
          throw xpError(
            409,
            'XP_TARGET_UNAVAILABLE',
            'o pedido está suspenso enquanto a ficha ou o vínculo estiver indisponível'
          )
        if (outcome.kind === 'stale')
          throw xpError(
            409,
            'XP_REQUEST_STALE',
            'o traço ou o custo mudou: faça um novo pedido',
            { why: outcome.why }
          )
        const model = await modelFor(
          db,
          access.character.systemId,
          access.character.templateVersion
        )
        return {
          duplicate: outcome.duplicate,
          request: requestOut(outcome.request, model),
          ...('sheetVersion' in outcome && {
            sheetVersion: outcome.sheetVersion,
            balance: outcome.balance,
          }),
        }
      },
      {
        params: t.Object({ id: uuid, requestId: uuid }),
        body: t.Object({ decisionKey: uuid, sessionId: t.Optional(uuid) }),
      }
    )
    .post(
      '/characters/:id/xp-requests/:requestId/reject',
      async ({ params, body, userId }) => {
        const me = requireUser(userId)
        const access = await characterAccess(db, me, params.id)
        if (!access || access.roles.has('viewer')) throw notFound()
        if (!access.roles.has('storyteller'))
          throw new ApiError(403, 'só o narrador recusa', { code: 'FORBIDDEN' })
        const reason = readReason(body.reason)
        const outcome = await db.transaction().execute(async trx => {
          const r = await lockRequest(trx, params.id, params.requestId)
          if (decided(r, body.decisionKey, 'rejected'))
            return { request: r, duplicate: true }
          const now = options.now()
          const rejected = await trx
            .updateTable('xp_requests')
            .set({
              status: 'rejected',
              reason,
              decided_by: me,
              decided_at: now,
              decision_key: body.decisionKey,
            })
            .where('id', '=', r.id)
            .returningAll()
            .executeTakeFirstOrThrow()
          await audit(trx, {
            chronicleId: access.character.chronicleId,
            actorId: me,
            action: 'xp.request.reject',
            characterId: params.id,
            userId: access.character.userId,
            payload: { requestId: r.id },
            at: now,
          })
          return { request: rejected, duplicate: false }
        })
        const model = await modelFor(
          db,
          access.character.systemId,
          access.character.templateVersion
        )
        return {
          duplicate: outcome.duplicate,
          request: requestOut(outcome.request, model),
        }
      },
      {
        params: t.Object({ id: uuid, requestId: uuid }),
        body: t.Object({
          decisionKey: uuid,
          reason: t.String({ minLength: 1, maxLength: 200 }),
        }),
      }
    )
    .post(
      '/characters/:id/xp-requests/:requestId/cancel',
      async ({ params, body, userId }) => {
        const me = requireUser(userId)
        const access = await characterAccess(db, me, params.id)
        if (!access || access.roles.has('viewer')) throw notFound()
        if (!access.roles.has('owner'))
          throw new ApiError(403, 'só o dono cancela o pedido', {
            code: 'FORBIDDEN',
          })
        const outcome = await db.transaction().execute(async trx => {
          const r = await lockRequest(trx, params.id, params.requestId)
          if (decided(r, body.decisionKey, 'cancelled'))
            return { request: r, duplicate: true }
          // Ex-membro só lê; a trava e o estado da ficha não impedem cancelar
          if (!(await isMember(trx, access.character.chronicleId, me)))
            throw xpError(
              403,
              'NOT_MEMBER',
              'você não faz mais parte desta crônica'
            )
          const cancelled = await trx
            .updateTable('xp_requests')
            .set({
              status: 'cancelled',
              decided_by: me,
              decided_at: options.now(),
              decision_key: body.decisionKey,
            })
            .where('id', '=', r.id)
            .returningAll()
            .executeTakeFirstOrThrow()
          return { request: cancelled, duplicate: false }
        })
        const model = await modelFor(
          db,
          access.character.systemId,
          access.character.templateVersion
        )
        return {
          duplicate: outcome.duplicate,
          request: requestOut(outcome.request, model),
        }
      },
      {
        params: t.Object({ id: uuid, requestId: uuid }),
        body: t.Object({ decisionKey: uuid }),
      }
    )
}
