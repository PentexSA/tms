import type { DB } from '@tms/db'
import {
  applyBatch,
  canRead,
  checkCreationBatch,
  classifyBatch,
  creationInputOf,
  describeEvent,
  isReversible,
  MAX_EVENTS_PER_BATCH,
  parseCharacterCreation,
  parsePath,
  type RoleName,
  type SheetEvent,
  stripRestricted,
  withEffectiveFrom,
  writePolicy,
} from '@tms/sheet-core'
import { Elysia, t } from 'elysia'
import type { Kysely } from 'kysely'
import type { authGuard } from '../auth/guard'
import { requireUser } from '../auth/guard'
import { characterAccess } from '../authz'
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

// text e longText entram no histórico sem conteúdo (contrato §10)
const contentFree = (type: string | undefined) =>
  type === 'text' || type === 'longText'

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
        if (!access) throw notFound()
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
              // O histórico guarda o "de" efetivo (o padrão, quando não havia
              // valor): "Sangue 10 → 9". O conflito já foi conferido com o cru
              withEffectiveFrom(model, current, body.events).map((e, seq) => {
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
        if (!access) throw notFound()
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
        if (query.before) {
          const [at, id] = query.before.split('_')
          const when = new Date(at ?? '')
          if (Number.isNaN(when.getTime()) || !id)
            throw new ApiError(400, 'dados inválidos')
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
        const items = batches
          .map(b => {
            const mine = events.filter(e => e.batch_id === b.id)
            const changes = mine
              .filter(e => {
                // O jogador nunca vê nem o rótulo de um campo que não lê
                const p = parsePath(e.path)
                return p !== null && canRead(model, p.fieldId, roles)
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
              at: b.created_at,
              // Null: "Conta excluída" (migration 0013)
              by: b.username === null ? null : { username: b.username },
              byRole: b.by_role,
              sheetVersion: b.sheet_version,
              operationId: b.operation_id,
              // Desfazer: sem texto no lote, não é uma reversão e não foi
              // desfeito. O app mostra só ao narrador
              reversible:
                b.operationKind !== 'revert' &&
                !b.reverted &&
                isReversible(
                  model,
                  mine.map(e => ({ path: e.path, from: null, to: null }))
                ),
              changes,
            }
          })
          .filter(b => b.changes.length > 0)
        const last = batches.at(-1)
        return {
          items,
          next:
            batches.length === limit && last
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
