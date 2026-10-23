import { createHash } from 'node:crypto'
import type { DB } from '@tms/db'
import {
  type CharacterCreation,
  type CreationChoices,
  type CreationConfigLayer,
  type CreationProblem,
  type CreationRefusal,
  canRead,
  checkCreation,
  checkCreationUpdate,
  completionRefusal,
  creationFreeze,
  creationInputOf,
  isSafeText,
  parseCharacterCreation,
  parsePath,
  RETURN_REASON_MAX,
  type RoleName,
  type SheetData,
  type SheetModel,
  validateCreationChoices,
  validateCreationConfig,
  writePolicy,
} from '@tms/sheet-core'
import { Elysia, t } from 'elysia'
import type { Kysely, Transaction, Updateable } from 'kysely'
import { type AuditAction, audit } from '../audit'
import type { authGuard } from '../auth/guard'
import { requireUser } from '../auth/guard'
import {
  type CharacterAccess,
  characterAccess,
  chronicleAccess,
} from '../authz'
import { ApiError } from '../http/errors'
import { idParams, uuid } from '../http/params'
import type { AppOptions } from '../options'
import { latestTemplate, modelFor } from './models'
import {
  type LockedCharacter,
  lockCharacter,
  refusal,
  writeAccess,
} from './policy'

// Criação por pontos e aprovação de ficha (doc/plano-v4.md, Etapa 4; §3.4).
//
// | Operação                     | Quem                                        |
// |------------------------------|---------------------------------------------|
// | salvar escolhas              | dono membro em creating; narrador também em pending |
// | ajustar orçamento/livre      | narrador, em creating e pending             |
// | concluir por pontos          | dono → pending (aprovação ligada) ou active |
// | concluir (pontos ou livre)   | narrador: conclui e aprova, direto a active |
// | aprovar                      | narrador, pending → active, revalidando     |
// | devolver                     | narrador, pending → creating, com motivo    |
//
// Tudo roda com a ficha travada (`FOR UPDATE`) e relê vínculo, estado e
// metadados dentro da transação. A conta é a do core, a mesma do app; o
// preço, o orçamento e o estado enviados pelo cliente nunca valem. Cada
// comando aceita uma chave (`clientCommandId`): reenviar o mesmo pedido
// devolve o resultado gravado; a mesma chave com outro pedido é 409.

const notFound = () => new ApiError(404, 'não encontrado')
const conflict = (message: string, details?: Record<string, unknown>) =>
  new ApiError(409, message, details)
const storytellerOnly = (message: string) =>
  new ApiError(403, message, { code: 'FORBIDDEN', paths: [] })

type CommandKind =
  | 'creation.complete'
  | 'creation.approve'
  | 'creation.return'
  | 'creation.update'

const hashOf = (kind: CommandKind, request: unknown) =>
  createHash('sha256').update(JSON.stringify({ kind, request })).digest('hex')

/**
 * Executa `run` uma vez por chave e ficha, na transação que já travou a
 * ficha (dois reenvios ao mesmo tempo esperam a trava e o segundo lê o
 * resultado). Sem chave, roda sempre.
 */
async function once<R>(
  trx: Transaction<DB>,
  args: {
    readonly characterId: string
    readonly key: string | undefined
    readonly kind: CommandKind
    readonly request: unknown
    readonly by: string
    readonly at: Date
  },
  run: () => Promise<R>
): Promise<R & { readonly duplicate: boolean }> {
  const hash = hashOf(args.kind, args.request)
  if (args.key) {
    const done = await trx
      .selectFrom('character_commands')
      .select(['kind', 'request_hash', 'result'])
      .where('character_id', '=', args.characterId)
      .where('client_command_id', '=', args.key)
      .executeTakeFirst()
    if (done) {
      if (done.kind !== args.kind || done.request_hash !== hash)
        throw conflict('esta chave já foi usada em outro pedido', {
          code: 'COMMAND_KEY_REUSED',
        })
      return { ...(done.result as R), duplicate: true }
    }
  }
  const result = await run()
  if (args.key)
    await trx
      .insertInto('character_commands')
      .values({
        character_id: args.characterId,
        client_command_id: args.key,
        kind: args.kind,
        request_hash: hash,
        result: JSON.stringify(result),
        created_by: args.by,
        created_at: args.at,
      })
      .execute()
  return { ...result, duplicate: false }
}

/** Os problemas sem caminho de campo que quem pediu não lê. */
export function visibleProblems(
  model: SheetModel,
  roles: ReadonlySet<RoleName>,
  problems: readonly CreationProblem[]
): CreationProblem[] {
  return problems.map(p => ({
    ...p,
    paths: p.paths.filter(path => {
      const parsed = parsePath(path.split('#')[0])
      return parsed !== null && canRead(model, parsed.fieldId, roles)
    }),
  }))
}

const MESSAGES: Readonly<Record<CreationRefusal['code'], string>> = {
  CREATION_PRIORITIES_REQUIRED:
    'escolha as prioridades deste grupo antes de distribuir os pontos',
  CREATION_BUDGET_EXCEEDED:
    'o gasto excede o orçamento ou um limite de criação',
  CREATION_INCOMPLETE:
    'distribua os pontos básicos restantes antes de concluir',
}

/** O 422 da conta: o código e os problemas por grupo, sem valor da ficha. */
export function creationRefusal(
  model: SheetModel,
  roles: ReadonlySet<RoleName>,
  r: CreationRefusal
): ApiError {
  return new ApiError(422, MESSAGES[r.code], {
    code: r.code,
    problems: visibleProblems(model, roles, r.problems),
  })
}

/** O que dono e narrador veem dos metadados de criação. */
export function creationView(
  model: SheetModel,
  creation: CharacterCreation,
  revision: number
) {
  const input = creationInputOf(model, creation)
  return {
    revision,
    mode: input.config.mode,
    // Sem `creation` no template, a criação é sempre livre
    accounting: model.template.creation !== undefined,
    choices: creation.choices ?? {},
    config: creation.config ?? {},
    effective: input.config,
    returned: creation.returned ?? null,
  }
}

/**
 * Grava os iniciais com fórmula ainda ausentes num lote do servidor, para a
 * ficha ativa não subir um derivado de graça depois (`creationFreeze`).
 * Só na criação por pontos, onde a conta usou esses iniciais; a criação
 * livre mantém o comportamento da v3 (o padrão acompanha a fonte).
 * Devolve a versão nova da ficha.
 */
async function freeze(
  trx: Transaction<DB>,
  model: SheetModel,
  row: LockedCharacter,
  args: {
    readonly id: string
    readonly by: string
    readonly role: 'owner' | 'storyteller'
    readonly at: Date
  }
): Promise<number> {
  const values = creationFreeze(model, row.sheet)
  const ids = Object.keys(values)
  if (!ids.length) return row.sheetVersion
  const sheet: SheetData = {
    ...row.sheet,
    values: { ...row.sheet.values, ...values } as SheetData['values'],
  }
  const sheetVersion = row.sheetVersion + 1
  await trx
    .updateTable('characters')
    .set({ sheet_data: JSON.stringify(sheet), sheet_version: sheetVersion })
    .where('id', '=', args.id)
    .execute()
  const batch = await trx
    .insertInto('character_batches')
    .values({
      character_id: args.id,
      client_batch_id: crypto.randomUUID(),
      created_by: args.by,
      by_role: args.role,
      sheet_version: sheetVersion,
      created_at: args.at,
    })
    .returning('id')
    .executeTakeFirstOrThrow()
  await trx
    .insertInto('character_events')
    .values(
      ids.map((id, seq) => ({
        batch_id: batch.id,
        seq,
        path: `values.${id}`,
        from_value: JSON.stringify(null),
        to_value: JSON.stringify(values[id]),
        from_absent: true,
      }))
    )
    .execute()
  return sheetVersion
}

const commandBody = {
  clientCommandId: t.Optional(uuid),
  // A revisão dos metadados e a versão da ficha que o app viu ao pedir
  revision: t.Optional(t.Integer({ minimum: 0 })),
  sheetVersion: t.Optional(t.Integer({ minimum: 0 })),
}

interface Expected {
  readonly revision?: number
  readonly sheetVersion?: number
}

function checkExpected(
  row: LockedCharacter,
  body: Expected | null | undefined
) {
  if (body?.revision !== undefined && body.revision !== row.creationRevision)
    throw conflict('a configuração da criação mudou', {
      code: 'CREATION_REVISION_CONFLICT',
      revision: row.creationRevision,
    })
  if (
    body?.sheetVersion !== undefined &&
    body.sheetVersion !== row.sheetVersion
  )
    throw conflict('a ficha mudou antes de concluir', {
      code: 'SHEET_VERSION_CONFLICT',
      sheetVersion: row.sheetVersion,
    })
}

export function creationRoutes(
  db: Kysely<DB>,
  options: AppOptions,
  guard: ReturnType<typeof authGuard>
) {
  const access = async (me: string, id: string): Promise<CharacterAccess> => {
    const a = await characterAccess(db, me, id)
    if (!a || a.roles.has('viewer')) throw notFound()
    return a
  }
  const modelOf = (a: CharacterAccess) =>
    modelFor(db, a.character.systemId, a.character.templateVersion)

  /** Muda o estado e grava a auditoria; a ficha já está travada. */
  const settle = async (
    trx: Transaction<DB>,
    args: {
      readonly id: string
      readonly row: LockedCharacter
      readonly me: string
      readonly at: Date
      readonly set: Updateable<DB['characters']>
      readonly action: AuditAction
      readonly payload: Readonly<Record<string, string | boolean | null>>
    }
  ) => {
    const updated = await trx
      .updateTable('characters')
      .set({ ...args.set, updated_at: args.at })
      .where('id', '=', args.id)
      .returning([
        'status',
        'locked_at',
        'creation_completed_at',
        'approved_at',
        'creation_revision',
        'sheet_version',
      ])
      .executeTakeFirstOrThrow()
    await audit(trx, {
      chronicleId: args.row.chronicleId,
      actorId: args.me,
      action: args.action,
      characterId: args.id,
      userId: args.row.userId,
      payload: args.payload,
      at: args.at,
    })
    return {
      status: updated.status,
      lockedAt: updated.locked_at,
      creationCompletedAt: updated.creation_completed_at,
      approvedAt: updated.approved_at,
      revision: updated.creation_revision,
      sheetVersion: updated.sheet_version,
    }
  }

  return new Elysia()
    .use(guard)
    .patch(
      '/chronicles/:id/creation-settings',
      async ({ params, body, userId }) => {
        const me = requireUser(userId)
        const role = await chronicleAccess(db, me, params.id)
        if (role === null || role === 'former') throw notFound()
        if (role !== 'storyteller')
          throw storytellerOnly('só o narrador configura a criação')
        const chronicle = await db
          .selectFrom('chronicles')
          .select('system_id')
          .where('id', '=', params.id)
          .executeTakeFirstOrThrow()
        if (body.defaults !== undefined) {
          const template = await latestTemplate(db, chronicle.system_id)
          if (!template)
            throw new ApiError(422, 'sistema sem template publicado')
          const model = await modelFor(
            db,
            chronicle.system_id,
            template.version
          )
          const issues = validateCreationConfig(model, body.defaults)
          if (issues.length)
            throw new ApiError(422, 'configuração inválida', {
              issues: issues.map(i => ({
                path: `defaults.${i.path}`,
                message: i.message,
              })),
            })
        }
        return db.transaction().execute(async trx => {
          const row = await trx
            .selectFrom('chronicles')
            .select([
              'character_approval',
              'creation_defaults',
              'creation_settings_revision',
            ])
            .where('id', '=', params.id)
            .forUpdate()
            .executeTakeFirstOrThrow()
          if (body.revision !== row.creation_settings_revision)
            throw conflict('a configuração da crônica mudou', {
              code: 'CREATION_REVISION_CONFLICT',
              revision: row.creation_settings_revision,
            })
          const now = options.now()
          // Desligar a aprovação não ativa quem já está pendente (§2.3, 15)
          const updated = await trx
            .updateTable('chronicles')
            .set({
              ...(body.approval !== undefined && {
                character_approval: body.approval,
              }),
              ...(body.defaults !== undefined && {
                creation_defaults: JSON.stringify(body.defaults),
              }),
              creation_settings_revision: row.creation_settings_revision + 1,
              updated_at: now,
            })
            .where('id', '=', params.id)
            .returning([
              'character_approval',
              'creation_defaults',
              'creation_settings_revision',
            ])
            .executeTakeFirstOrThrow()
          await audit(trx, {
            chronicleId: params.id,
            actorId: me,
            action: 'chronicle.creation.settings',
            payload: {
              ...(body.approval !== undefined && { approval: body.approval }),
              defaults: body.defaults !== undefined,
            },
            at: now,
          })
          return {
            approval: updated.character_approval,
            defaults: updated.creation_defaults,
            revision: updated.creation_settings_revision,
          }
        })
      },
      {
        params: idParams,
        body: t.Object({
          revision: t.Integer({ minimum: 0 }),
          approval: t.Optional(t.Boolean()),
          defaults: t.Optional(
            t.Record(t.String({ maxLength: 20 }), t.Unknown(), {
              maxProperties: 5,
            })
          ),
        }),
      }
    )
    .patch(
      '/characters/:id/creation',
      async ({ params, body, userId }) => {
        const me = requireUser(userId)
        const a = await access(me, params.id)
        const storyteller = a.roles.has('storyteller')
        if (body.config !== undefined && !storyteller)
          throw storytellerOnly('só o narrador ajusta o orçamento da criação')
        const model = await modelOf(a)
        if (body.choices !== undefined) {
          const issues = validateCreationChoices(model, body.choices)
          if (issues.length)
            throw new ApiError(422, 'escolhas inválidas', {
              issues: issues.map(i => ({
                path: `choices.${i.path}`,
                message: i.message,
              })),
            })
        }
        if (body.config !== undefined && body.config !== null) {
          const issues = validateCreationConfig(model, body.config)
          if (issues.length)
            throw new ApiError(422, 'configuração inválida', {
              issues: issues.map(i => ({
                path: `config.${i.path}`,
                message: i.message,
              })),
            })
        }
        const { clientCommandId, ...request } = body
        return db.transaction().execute(async trx => {
          const row = await lockCharacter(trx, params.id)
          const now = options.now()
          return once(
            trx,
            {
              characterId: params.id,
              key: clientCommandId,
              kind: 'creation.update',
              request,
              by: me,
              at: now,
            },
            async () => {
              // Em pending, só o narrador; depois da criação, ninguém
              if (row.status !== 'creating' && row.status !== 'pending')
                throw conflict('a criação já foi concluída')
              const verdict = writePolicy(
                await writeAccess(trx, a.roles, row.chronicleId, me),
                row.status,
                row.lockedAt !== null,
                ['edit']
              )
              if (!verdict.ok)
                throw refusal(verdict, { model, roles: a.roles, paths: [] })
              if (body.revision !== row.creationRevision)
                throw conflict('a configuração da criação mudou', {
                  code: 'CREATION_REVISION_CONFLICT',
                  revision: row.creationRevision,
                })
              const current = parseCharacterCreation(model, row.creation)
              const next: CharacterCreation = {
                ...current,
                ...(body.choices !== undefined && {
                  choices: body.choices as CreationChoices,
                }),
              }
              const config =
                body.config === undefined
                  ? current.config
                  : body.config === null
                    ? undefined
                    : (body.config as CreationConfigLayer)
              const merged: CharacterCreation = {
                ...(next.choices && { choices: next.choices }),
                ...(config && { config }),
                ...(next.returned && { returned: next.returned }),
              }
              // Escolha ou orçamento que piorariam a conta não são gravados
              // sozinhos (§3.1); o narrador também passa por aqui (§2.3, 21)
              const worse = checkCreationUpdate(
                model,
                { sheet: row.sheet, input: creationInputOf(model, current) },
                { sheet: row.sheet, input: creationInputOf(model, merged) }
              )
              if (worse) throw creationRefusal(model, a.roles, worse)
              const revision = row.creationRevision + 1
              await trx
                .updateTable('characters')
                .set({
                  creation: JSON.stringify(merged),
                  creation_revision: revision,
                  updated_at: now,
                })
                .where('id', '=', params.id)
                .execute()
              if (storyteller)
                await audit(trx, {
                  chronicleId: row.chronicleId,
                  actorId: me,
                  action: 'character.creation.update',
                  characterId: params.id,
                  userId: row.userId,
                  payload: {
                    choices: body.choices !== undefined,
                    config: body.config !== undefined,
                  },
                  at: now,
                })
              return {
                creation: creationView(model, merged, revision),
                check: checkCreation(
                  model,
                  row.sheet,
                  creationInputOf(model, merged)
                ),
              }
            }
          )
        })
      },
      {
        params: idParams,
        body: t.Object({
          clientCommandId: t.Optional(uuid),
          revision: t.Integer({ minimum: 0 }),
          choices: t.Optional(
            t.Record(t.String({ maxLength: 20 }), t.Unknown(), {
              maxProperties: 5,
            })
          ),
          config: t.Optional(
            t.Union([
              t.Null(),
              t.Record(t.String({ maxLength: 20 }), t.Unknown(), {
                maxProperties: 5,
              }),
            ])
          ),
        }),
      }
    )
    .post(
      '/characters/:id/creation/complete',
      async ({ params, body, userId }) => {
        const me = requireUser(userId)
        const a = await access(me, params.id)
        const storyteller = a.roles.has('storyteller')
        const model = await modelOf(a)
        const { clientCommandId, ...request } = body ?? {}
        return db.transaction().execute(async trx => {
          const row = await lockCharacter(trx, params.id)
          const now = options.now()
          return once(
            trx,
            {
              characterId: params.id,
              key: clientCommandId,
              kind: 'creation.complete',
              request,
              by: me,
              at: now,
            },
            async () => {
              if (row.status !== 'creating')
                throw conflict('criação já concluída')
              if (!storyteller) {
                const verdict = writePolicy(
                  await writeAccess(trx, a.roles, row.chronicleId, me),
                  row.status,
                  row.lockedAt !== null,
                  []
                )
                if (!verdict.ok)
                  throw refusal(verdict, { model, roles: a.roles, paths: [] })
              }
              checkExpected(row, body)
              const creation = parseCharacterCreation(model, row.creation)
              const input = creationInputOf(model, creation)
              // Criação livre: o narrador conclui (§3.4)
              if (input.config.mode === 'free' && !storyteller)
                throw new ApiError(
                  403,
                  'na criação livre, o narrador conclui',
                  {
                    code: 'CREATION_STORYTELLER_ONLY',
                    paths: [],
                  }
                )
              if (input.config.mode === 'points') {
                const refused = completionRefusal(
                  checkCreation(model, row.sheet, input)
                )
                if (refused) throw creationRefusal(model, a.roles, refused)
              }
              // A aprovação vigente, lida agora (sob trava compartilhada: um
              // ajuste ao mesmo tempo termina antes ou espera)
              const approval =
                !storyteller &&
                (
                  await trx
                    .selectFrom('chronicles')
                    .select('character_approval')
                    .where('id', '=', row.chronicleId)
                    .forShare()
                    .executeTakeFirstOrThrow()
                ).character_approval
              const { returned: _, ...kept } = creation
              const revision = row.creationRevision + 1
              const base = {
                creation_completed_at: now,
                creation_completed_by: me,
                creation: JSON.stringify(kept),
                creation_revision: revision,
              }
              if (approval)
                return settle(trx, {
                  id: params.id,
                  row,
                  me,
                  at: now,
                  set: { ...base, status: 'pending' },
                  action: 'character.creation.submit',
                  payload: { mode: input.config.mode },
                })
              if (input.config.mode === 'points')
                await freeze(trx, model, row, {
                  id: params.id,
                  by: me,
                  role: storyteller ? 'storyteller' : 'owner',
                  at: now,
                })
              return settle(trx, {
                id: params.id,
                row,
                me,
                at: now,
                set: {
                  ...base,
                  status: 'active',
                  activated_at: now,
                  // O narrador que conclui também aprova (§2.3, 12)
                  ...(storyteller && { approved_at: now, approved_by: me }),
                },
                action: 'character.creation.complete',
                payload: { mode: input.config.mode, approved: storyteller },
              })
            }
          )
        })
      },
      { params: idParams, body: t.Optional(t.Object(commandBody)) }
    )
    .post(
      '/characters/:id/creation/approve',
      async ({ params, body, userId }) => {
        const me = requireUser(userId)
        const a = await access(me, params.id)
        if (!a.roles.has('storyteller'))
          throw storytellerOnly('só o narrador aprova a ficha')
        const model = await modelOf(a)
        const { clientCommandId, ...request } = body ?? {}
        return db.transaction().execute(async trx => {
          const row = await lockCharacter(trx, params.id)
          const now = options.now()
          return once(
            trx,
            {
              characterId: params.id,
              key: clientCommandId,
              kind: 'creation.approve',
              request,
              by: me,
              at: now,
            },
            async () => {
              if (row.status !== 'pending')
                throw conflict('a ficha não aguarda aprovação')
              checkExpected(row, body)
              const input = creationInputOf(
                model,
                parseCharacterCreation(model, row.creation)
              )
              // Aprovar revalida a ficha de agora (§2.3, 21)
              if (input.config.mode === 'points') {
                const refused = completionRefusal(
                  checkCreation(model, row.sheet, input)
                )
                if (refused) throw creationRefusal(model, a.roles, refused)
              }
              if (input.config.mode === 'points')
                await freeze(trx, model, row, {
                  id: params.id,
                  by: me,
                  role: 'storyteller',
                  at: now,
                })
              return settle(trx, {
                id: params.id,
                row,
                me,
                at: now,
                set: {
                  status: 'active',
                  approved_at: now,
                  approved_by: me,
                  activated_at: now,
                },
                action: 'character.creation.approve',
                payload: { mode: input.config.mode },
              })
            }
          )
        })
      },
      { params: idParams, body: t.Optional(t.Object(commandBody)) }
    )
    .post(
      '/characters/:id/creation/return',
      async ({ params, body, userId }) => {
        const me = requireUser(userId)
        const a = await access(me, params.id)
        if (!a.roles.has('storyteller'))
          throw storytellerOnly('só o narrador devolve a ficha')
        const reason = body.reason.trim()
        if (!reason || reason.length > RETURN_REASON_MAX || !isSafeText(reason))
          throw new ApiError(422, 'motivo inválido', {
            issues: [{ path: 'reason', message: 'motivo inválido' }],
          })
        const model = await modelOf(a)
        const { clientCommandId, ...request } = body
        return db.transaction().execute(async trx => {
          const row = await lockCharacter(trx, params.id)
          const now = options.now()
          return once(
            trx,
            {
              characterId: params.id,
              key: clientCommandId,
              kind: 'creation.return',
              request: { ...request, reason },
              by: me,
              at: now,
            },
            async () => {
              // Exceção restrita: só pending volta para a criação (§2.3, 11)
              if (row.status !== 'pending')
                throw conflict('só uma ficha que aguarda aprovação é devolvida')
              const creation = parseCharacterCreation(model, row.creation)
              return settle(trx, {
                id: params.id,
                row,
                me,
                at: now,
                set: {
                  status: 'creating',
                  creation_completed_at: null,
                  creation_completed_by: null,
                  // O motivo fica na ficha, legível por dono e narrador
                  // (§2.3, 22), nunca no registro da crônica
                  creation: JSON.stringify({
                    ...creation,
                    returned: { reason, at: now.toISOString() },
                  }),
                  creation_revision: row.creationRevision + 1,
                },
                action: 'character.creation.return',
                payload: {},
              })
            }
          )
        })
      },
      {
        params: idParams,
        body: t.Object({
          clientCommandId: t.Optional(uuid),
          reason: t.String({ minLength: 1, maxLength: RETURN_REASON_MAX + 50 }),
        }),
      }
    )
}
