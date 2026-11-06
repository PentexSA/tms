import type { DB } from '@tms/db'
import {
  applyBatch,
  canRead,
  checkCreationBatch,
  classifyBatch,
  creationInputOf,
  describeEvent,
  isReversible,
  jsonEqual,
  ledgerPaths,
  MAX_EVENTS_PER_BATCH,
  parseCharacterCreation,
  parsePath,
  type RoleName,
  type SheetEvent,
  stripRestricted,
  withEffectiveFrom,
  withEffectiveTo,
  writePolicy,
} from '@tms/sheet-core'
import { Elysia, t } from 'elysia'
import type { Kysely, Transaction } from 'kysely'
import type { AuditAction } from '../audit'
import type { authGuard } from '../auth/guard'
import { requireUser } from '../auth/guard'
import { characterAccess } from '../authz'
import { isLedgerKind } from '../chronicles/operations'
import { ApiError } from '../http/errors'
import { idParams, uuid } from '../http/params'
import type { AppOptions } from '../options'
import { creationRefusal } from './creation'
import { modelFor } from './models'
import { lockCharacter, refusal, writeAccess } from './policy'

// O pipeline de um lote no servidor (doc/arquitetura §8.2): sessão e papéis
// do banco, limites, idempotência, trava da linha, applyBatch do core com o
// modelo da versão da ficha, a política de escrita do estado atual (v3), e o
// lote gravado com o histórico na mesma transação, com `by` e `at` do servidor.

export const MAX_BATCH_BYTES = 64 * 1024
const notFound = () => new ApiError(404, 'não encontrado')

const issuesOut = (issues: readonly { path: string; message: string }[]) =>
  issues.map(i => ({ path: i.path, message: i.message }))

/**
 * Quem mudou cada campo do 409, relativo a quem pediu (T-31): `self` (a
 * mesma conta, noutro aparelho), `owner` (o jogador) ou `storyteller` (o
 * narrador). Nunca id nem nome. `null` quando não se sabe (campo nunca
 * mudado por lote) ou quando o último lote é de uma rolagem oculta e quem
 * pede não narra: a mesma regra do Histórico, para o aviso não revelar que
 * houve uma rolagem oculta. Não se escolhe o lote anterior, que atribuiria a
 * mudança a outra pessoa.
 */
export type ChangedBy = 'self' | 'owner' | 'storyteller' | null

async function changedByOf(
  trx: Transaction<DB>,
  characterId: string,
  paths: readonly string[],
  me: string,
  storyteller: boolean
): Promise<Record<string, ChangedBy>> {
  const out = new Map<string, ChangedBy>(paths.map(p => [p, null]))
  if (!paths.length) return {}
  const rows = await trx
    .selectFrom('character_events as e')
    .innerJoin('character_batches as b', 'b.id', 'e.batch_id')
    .select(eb => [
      'e.path',
      'b.created_by',
      'b.by_role',
      eb
        .exists(
          eb
            .selectFrom('character_rolls as r')
            .select('r.id')
            .whereRef('r.batch_id', '=', 'b.id')
            .where('r.hidden', '=', true)
        )
        .as('hidden'),
    ])
    .where('b.character_id', '=', characterId)
    .where('e.path', 'in', [...paths])
    .distinctOn('e.path')
    .orderBy('e.path')
    .orderBy('b.created_at', 'desc')
    .orderBy('b.id', 'desc')
    .execute()
  for (const row of rows) {
    if (row.hidden && !storyteller) continue
    out.set(
      row.path,
      row.created_by === me
        ? 'self'
        : row.by_role === 'owner' || row.by_role === 'storyteller'
          ? row.by_role
          : null
    )
  }
  return Object.fromEntries(out)
}

// text e longText entram no histórico sem conteúdo (contrato §10)
const contentFree = (type: string | undefined) =>
  type === 'text' || type === 'longText'

/** Os passos do ciclo da criação que o Histórico da ficha mostra. */
export type LifecycleEvent =
  | 'creation.completed'
  | 'creation.submitted'
  | 'creation.returned'
  | 'creation.adjust'
  | 'creation.ready'

/**
 * As ações do registro da crônica que viram passos no Histórico da ficha:
 * "Criação concluída" (T-80: o dono ou o narrador conclui, ou o narrador
 * aprova) e, desde o P04-D (R-12), enviar, devolver, pedir ajuste e avisar
 * que terminou. Só estas; o resto do registro continua só para o narrador,
 * em Bastidores.
 */
export const LIFECYCLE_EVENTS = {
  'character.creation.complete': 'creation.completed',
  'character.creation.approve': 'creation.completed',
  'character.creation.submit': 'creation.submitted',
  'character.creation.return': 'creation.returned',
  'character.creation.adjust': 'creation.adjust',
  'character.creation.ready': 'creation.ready',
} as const satisfies Partial<Record<AuditAction, LifecycleEvent>>

const LIFECYCLE_ACTIONS = Object.keys(
  LIFECYCLE_EVENTS
) as (keyof typeof LIFECYCLE_EVENTS)[]

export interface HistoryEntry {
  readonly id: string
  readonly at: Date
  readonly by: { readonly username: string } | null
  readonly byRole: string
  readonly sheetVersion: number | null
  readonly operationId: string | null
  readonly event?: LifecycleEvent
  readonly reversible: boolean
  readonly changes: readonly {
    readonly label: string
    readonly change: string
  }[]
}

/**
 * Quem concluiu, calculado no servidor a partir do que ele gravou: aprovar é
 * do narrador; concluir grava `approved: true` quando o narrador conclui (o
 * mesmo papel do lote do freeze), também na ficha dele e com a conta já
 * excluída. Registro sem o campo (anterior à v4): o autor contra o dono.
 * O `payload` nunca vai na resposta.
 */
export function completionRole(row: {
  readonly action: string
  readonly actor_id: string | null
  readonly target_user_id: string | null
  readonly payload: unknown
}): 'owner' | 'storyteller' {
  if (row.action === 'character.creation.approve') return 'storyteller'
  const approved = (row.payload as { approved?: unknown } | null)?.approved
  if (typeof approved === 'boolean') return approved ? 'storyteller' : 'owner'
  return row.actor_id !== null && row.actor_id === row.target_user_id
    ? 'owner'
    : 'storyteller'
}

/**
 * Quem deu o passo do ciclo, calculado no servidor pela ação: enviar e
 * avisar são do dono; devolver e pedir ajuste, do narrador; concluir segue o
 * `completionRole`. Nada vem do corpo.
 */
export function lifecycleRole(row: {
  readonly action: keyof typeof LIFECYCLE_EVENTS
  readonly actor_id: string | null
  readonly target_user_id: string | null
  readonly payload: unknown
}): 'owner' | 'storyteller' {
  switch (LIFECYCLE_EVENTS[row.action]) {
    case 'creation.completed':
      return completionRole(row)
    case 'creation.submitted':
    case 'creation.ready':
      return 'owner'
    case 'creation.returned':
    case 'creation.adjust':
      return 'storyteller'
  }
}

/** Ordem do Histórico: do mais novo ao mais antigo, por (quando, id). */
const newestFirst = (a: HistoryEntry, b: HistoryEntry) =>
  b.at.getTime() - a.at.getTime() || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0)

export function eventRoutes(
  db: Kysely<DB>,
  options: AppOptions,
  guard: ReturnType<typeof authGuard>
) {
  return new Elysia()
    .use(guard)
    .post(
      '/characters/:id/events',
      async ({ params, body, userId, request, set }) => {
        const me = requireUser(userId)
        const length = Number(request.headers.get('content-length') ?? 0)
        if (
          length > MAX_BATCH_BYTES ||
          JSON.stringify(body).length > MAX_BATCH_BYTES
        )
          throw new ApiError(413, 'lote grande demais')
        const access = await characterAccess(db, me, params.id)
        if (!access || access.roles.has('viewer')) throw notFound()
        for (const key of [`user:${me}`, `character:${params.id}`]) {
          const d = options.limits.events.hit(key)
          if (!d.allowed) {
            set.headers['retry-after'] = String(d.retryAfterSeconds)
            throw new ApiError(
              429,
              'muitas alterações seguidas; tente de novo em instantes'
            )
          }
        }
        const roles = access.roles
        const model = await modelFor(
          db,
          access.character.systemId,
          access.character.templateVersion
        )

        return db.transaction().execute(async trx => {
          const character = await lockCharacter(trx, params.id)
          const current = character.sheet

          // Reenvio da fila offline: o mesmo lote não é aplicado duas vezes
          const done = await trx
            .selectFrom('character_batches')
            .select('id')
            .where('character_id', '=', params.id)
            .where('client_batch_id', '=', body.clientBatchId)
            .executeTakeFirst()
          if (done)
            return {
              clientBatchId: body.clientBatchId,
              sheetVersion: character.sheetVersion,
              duplicate: true,
              sheet: stripRestricted(model, current, roles),
            }

          // As projeções do extrato não se gravam por evento, nem pelo
          // narrador (§3.5). Estado, trava e vínculo vêm antes: quem não
          // escreve na ficha recebe o motivo do estado
          const ledger = ledgerPaths(model, body.events)
          if (ledger.length) {
            const verdict = writePolicy(
              await writeAccess(trx, roles, character.chronicleId, me),
              character.status,
              character.lockedAt !== null,
              []
            )
            if (!verdict.ok)
              throw refusal(verdict, {
                model,
                roles,
                paths: body.events.map(e => e.path),
              })
            throw new ApiError(403, 'o XP passa pelo extrato', {
              code: 'XP_MANAGED_BY_LEDGER',
              paths: ledger,
            })
          }

          const result = applyBatch(
            model,
            current,
            { events: body.events },
            roles
          )
          if (!result.ok) {
            if (result.kind === 'conflict') {
              // O valor atual dos caminhos em conflito, filtrado pelo papel
              const visible = stripRestricted(model, current, roles)
              const now: Record<string, unknown> = {}
              for (const issue of result.issues) {
                const p = parsePath(issue.path)
                if (!p) continue
                const bucket: Readonly<Record<string, unknown>> =
                  (p.scope === 'values'
                    ? visible.values
                    : visible.specialties) ?? {}
                now[issue.path] = Object.hasOwn(bucket, p.fieldId)
                  ? bucket[p.fieldId]
                  : null
              }
              throw new ApiError(409, 'a ficha mudou antes deste lote', {
                issues: issuesOut(result.issues),
                current: now,
                // Os caminhos já passaram por canWrite (o forbidden vem
                // antes do conflito): ninguém recebe 409 de campo que não
                // escreve
                changedBy: await changedByOf(
                  trx,
                  params.id,
                  result.issues.map(i => i.path),
                  me,
                  roles.has('storyteller')
                ),
                sheetVersion: character.sheetVersion,
              })
            }
            throw new ApiError(
              result.kind === 'forbidden' ? 403 : 422,
              result.kind === 'forbidden'
                ? 'sem permissão de escrita'
                : 'lote inválido',
              { issues: issuesOut(result.issues) }
            )
          }

          // A política vale o estado de agora, com a ficha travada: um lote de
          // Evoluir feito em `creating` que chega depois da conclusão cai aqui.
          // Só um lote que aplicaria chega a ela (o conflito volta 409 antes)
          const classes = classifyBatch(model, current, body.events)
          const verdict = writePolicy(
            await writeAccess(trx, roles, character.chronicleId, me),
            character.status,
            character.lockedAt !== null,
            classes.parts.map(p => p.kind)
          )
          if (!verdict.ok)
            throw refusal(verdict, {
              model,
              roles,
              paths: body.events.map(e => e.path),
              parts: classes.parts,
            })

          // Avaliação parcial da criação por pontos (doc/plano-v4.md §3.1):
          // falta de básicos passa; bônus acima do saldo, teto ou avanço sem
          // prioridade, não. Vale para dono e narrador (§2.3, 21), com os
          // metadados de agora, lidos com a ficha travada
          if (
            character.status === 'creating' ||
            character.status === 'pending'
          ) {
            const worse = checkCreationBatch(
              model,
              current,
              result.sheet,
              creationInputOf(
                model,
                parseCharacterCreation(model, character.creation)
              )
            )
            if (worse) throw creationRefusal(model, roles, worse)
          }

          const sheetVersion = character.sheetVersion + 1
          const nameField = model.template.identity.name
          const nameEvent = body.events.find(
            e => e.path === `values.${nameField}`
          )
          const newName = nameEvent ? result.sheet.values[nameField] : undefined
          await trx
            .updateTable('characters')
            .set({
              sheet_data: JSON.stringify(result.sheet),
              sheet_version: sheetVersion,
              updated_at: options.now(),
              ...(typeof newName === 'string' && newName.trim()
                ? { name: newName.trim() }
                : {}),
            })
            .where('id', '=', params.id)
            .execute()
          const batch = await trx
            .insertInto('character_batches')
            .values({
              character_id: params.id,
              client_batch_id: body.clientBatchId,
              created_by: me,
              by_role: roles.has('owner') ? 'owner' : 'storyteller',
              sheet_version: sheetVersion,
              created_at: options.now(),
            })
            .returning('id')
            .executeTakeFirstOrThrow()
          await trx
            .insertInto('character_events')
            .values(
              // O histórico guarda o "de" e o "para" efetivos (o padrão,
              // quando não havia valor): "Sangue 10 → 9", e o desfazer
              // "Sangue 9 → 10" (T-53). O conflito já foi conferido com o cru
              withEffectiveTo(
                model,
                result.sheet,
                withEffectiveFrom(model, current, body.events)
              ).map((e, seq) => {
                const p = parsePath(e.path)
                const type = p
                  ? model.fields.get(p.fieldId)?.def.type
                  : undefined
                const hide = contentFree(type) || p?.scope === 'specialties'
                return {
                  batch_id: batch.id,
                  seq,
                  path: e.path,
                  from_value: hide ? null : JSON.stringify(e.from ?? null),
                  to_value: hide ? null : JSON.stringify(e.to ?? null),
                  // O `from` cru é o valor atual (o conflito já conferiu):
                  // null é caminho vazio, que a reversão devolve vazio
                  from_absent: (body.events[seq]?.from ?? null) === null,
                  // O "para" cru era vazio: o to_value guarda o efetivo (T-53)
                  to_absent: (body.events[seq]?.to ?? null) === null,
                }
              })
            )
            .execute()
          return {
            clientBatchId: body.clientBatchId,
            sheetVersion,
            duplicate: false,
            sheet: stripRestricted(model, result.sheet, roles),
          }
        })
      },
      {
        params: idParams,
        body: t.Object({
          clientBatchId: uuid,
          events: t.Array(
            t.Object({
              path: t.String({ minLength: 1, maxLength: 120 }),
              from: t.Unknown(),
              to: t.Unknown(),
            }),
            { minItems: 1, maxItems: MAX_EVENTS_PER_BATCH }
          ),
        }),
      }
    )
    .get(
      '/characters/:id/history',
      async ({ params, query, userId }) => {
        const me = requireUser(userId)
        const access = await characterAccess(db, me, params.id)
        if (!access || access.roles.has('viewer')) throw notFound()
        const model = await modelFor(
          db,
          access.character.systemId,
          access.character.templateVersion
        )
        const limit = query.limit ?? 20
        let q = db
          .selectFrom('character_batches as b')
          // Left: lote de conta excluída fica no histórico, sem autor
          .leftJoin('users as u', 'u.id', 'b.created_by')
          .leftJoin('chronicle_operations as o', 'o.id', 'b.operation_id')
          .select(eb => [
            'b.id',
            'b.created_at',
            'b.by_role',
            'b.sheet_version',
            'b.operation_id',
            'o.kind as operationKind',
            'u.username',
            // Já desfeito: o lote, ou a operação dele (§7, decisão 11)
            eb
              .exists(
                eb
                  .selectFrom('chronicle_operations as r')
                  .select('r.id')
                  .where(eb =>
                    eb.or([
                      eb('r.reverts_batch_id', '=', eb.ref('b.id')),
                      eb(
                        'r.reverts_operation_id',
                        '=',
                        eb.ref('b.operation_id')
                      ),
                    ])
                  )
              )
              .as('reverted'),
          ])
          .where('b.character_id', '=', params.id)
        // O custo de uma rolagem oculta altera o estado atual, mas o lote que
        // explica a ação não aparece ao dono. O filtro acontece antes do
        // cursor/limite para não vazar nem criar páginas vazias.
        if (!access.roles.has('storyteller'))
          q = q.where(eb =>
            eb.not(
              eb.exists(
                eb
                  .selectFrom('character_rolls as secret_roll')
                  .select('secret_roll.id')
                  .whereRef('secret_roll.batch_id', '=', 'b.id')
                  .where('secret_roll.hidden', '=', true)
              )
            )
          )
        let before: { readonly when: Date; readonly id: string } | null = null
        if (query.before) {
          const [at, id] = query.before.split('_')
          const when = new Date(at ?? '')
          if (Number.isNaN(when.getTime()) || !id)
            throw new ApiError(400, 'dados inválidos')
          before = { when, id }
          q = q.where(eb =>
            eb.or([
              eb('b.created_at', '<', when),
              eb.and([eb('b.created_at', '=', when), eb('b.id', '<', id)]),
            ])
          )
        }
        const batches = await q
          .orderBy('b.created_at', 'desc')
          .orderBy('b.id', 'desc')
          .limit(limit)
          .execute()
        const events = batches.length
          ? await db
              .selectFrom('character_events')
              .select(['batch_id', 'seq', 'path', 'from_value', 'to_value'])
              .where(
                'batch_id',
                'in',
                batches.map(b => b.id)
              )
              .orderBy('seq')
              .execute()
          : []
        const roles: ReadonlySet<RoleName> = access.roles
        const last = batches.at(-1)
        const next =
          batches.length === limit && last
            ? `${new Date(last.created_at).toISOString()}_${last.id}`
            : null
        // Os passos do ciclo (T-80, P04-D) vêm do registro da crônica, que é
        // onde eles são gravados. As páginas são intervalos contíguos de
        // (quando, id): esta vai do último lote dela (inclusive) até o cursor
        // pedido (exclusive), e a última página não tem piso. Assim cada
        // passo aparece uma vez, na página certa. Só as ações do ciclo, só
        // desta ficha e da crônica dela, sem `payload` nem `target_user_id`
        // na resposta (o motivo da devolução e do ajuste nunca está lá)
        let audits = db
          .selectFrom('chronicle_audit as a')
          .leftJoin('users as u', 'u.id', 'a.actor_id')
          .select([
            'a.id',
            'a.created_at',
            'a.action',
            'a.actor_id',
            'a.target_user_id',
            'a.payload',
            'u.username',
          ])
          .where('a.chronicle_id', '=', access.character.chronicleId)
          .where('a.target_character_id', '=', params.id)
          .where('a.action', 'in', LIFECYCLE_ACTIONS)
        if (before) {
          const { when, id } = before
          audits = audits.where(eb =>
            eb.or([
              eb('a.created_at', '<', when),
              eb.and([eb('a.created_at', '=', when), eb('a.id', '<', id)]),
            ])
          )
        }
        if (next !== null && last) {
          const floor = new Date(last.created_at)
          audits = audits.where(eb =>
            eb.or([
              eb('a.created_at', '>', floor),
              eb.and([
                eb('a.created_at', '=', floor),
                eb('a.id', '>=', last.id),
              ]),
            ])
          )
        }
        const steps: HistoryEntry[] = (await audits.execute()).map(a => {
          const row = {
            ...a,
            action: a.action as keyof typeof LIFECYCLE_EVENTS,
          }
          return {
            id: a.id,
            at: new Date(a.created_at),
            by: a.username === null ? null : { username: a.username },
            byRole: lifecycleRole(row),
            sheetVersion: null,
            operationId: null,
            event: LIFECYCLE_EVENTS[row.action],
            reversible: false,
            changes: [],
          }
        })
        const items: HistoryEntry[] = batches
          .map(b => {
            const mine = events.filter(e => e.batch_id === b.id)
            const changes = mine
              .filter(e => {
                // O jogador nunca vê nem o rótulo de um campo que não lê
                const p = parsePath(e.path)
                if (p === null || !canRead(model, p.fieldId, roles))
                  return false
                // Sem mudança, sem linha (T-80): o freeze da conclusão grava
                // o valor que já valia. Texto e especialização entram sem
                // conteúdo (null → null) e continuam como "atualizado"
                const type = model.fields.get(p.fieldId)?.def.type
                const hide = contentFree(type) || p.scope === 'specialties'
                return hide || !jsonEqual(e.from_value, e.to_value)
              })
              .map(e => {
                const event: SheetEvent = {
                  path: e.path,
                  from: e.from_value,
                  to: e.to_value,
                }
                return describeEvent(model, event)
              })
            return {
              id: b.id,
              at: new Date(b.created_at),
              // Null: "Conta excluída" (migration 0013)
              by: b.username === null ? null : { username: b.username },
              byRole: b.by_role,
              sheetVersion: b.sheet_version,
              operationId: b.operation_id,
              // Desfazer: sem texto no lote, não é uma reversão e não foi
              // desfeito. O app mostra só ao narrador
              reversible:
                b.operationKind !== 'revert' &&
                !isLedgerKind(b.operationKind) &&
                !b.reverted &&
                isReversible(
                  model,
                  mine.map(e => ({ path: e.path, from: null, to: null }))
                ),
              changes,
            }
          })
          .filter(b => b.changes.length > 0)
        return {
          items: [...items, ...steps].sort(newestFirst),
          next,
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
