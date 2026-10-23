import { createHash } from 'node:crypto'
import type { DB } from '@tms/db'
import {
  canWrite,
  type Issue,
  parseCharacterCreation,
  publicIdentityOf,
  type RoleName,
  resolve,
  type SheetData,
  stripRestricted,
  validateCreationConfig,
  validateSheet,
  withValueDeps,
  writePolicy,
} from '@tms/sheet-core'
import { Elysia, t } from 'elysia'
import type { Kysely } from 'kysely'
import { audit } from '../audit'
import type { authGuard } from '../auth/guard'
import { requireUser } from '../auth/guard'
import { characterAccess, chronicleAccess } from '../authz'
import { ApiError } from '../http/errors'
import { idParams } from '../http/params'
import { creationView } from './creation'
import { latestTemplate, modelFor } from './models'
import { lockCharacter, refusal, writeAccess } from './policy'

// Fichas: leitura e criação (doc/plano-v0.md, Etapa 12). Toda saída passa por
// stripRestricted com os papéis resolvidos no banco: o aparelho de quem não
// lê as Notas do Narrador nunca as recebe.

export const MAX_CHARACTERS_PER_CHRONICLE = 20
const notFound = () => new ApiError(404, 'não encontrado')
const notMember = () =>
  new ApiError(403, 'você não faz mais parte desta crônica', {
    code: 'NOT_MEMBER',
    paths: [],
  })

// "values.clan" → "/values/clan", o mesmo formato dos erros de validação
const fieldsOf = (issues: readonly Issue[]) =>
  issues.map(i => ({
    path: i.path ? `/${i.path.replace(/\./g, '/')}` : '/',
    message: i.message,
  }))

const invalid = (issues: readonly Issue[]) =>
  new ApiError(422, 'ficha inválida', { issues: fieldsOf(issues) })

const commandHash = (kind: string, request: unknown) =>
  createHash('sha256').update(JSON.stringify({ kind, request })).digest('hex')

const validHttpsUrl = (value: string | null | undefined) => {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

const idempotencyConflict = () =>
  new ApiError(
    409,
    'Esta ação já foi enviada com outros dados. Atualize antes de tentar novamente.',
    { code: 'IDEMPOTENCY_CONFLICT' }
  )

export function sheetRoutes(
  db: Kysely<DB>,
  guard: ReturnType<typeof authGuard>
) {
  return new Elysia()
    .use(guard)
    .get(
      '/systems/:code/template',
      async ({ params, query, request, userId }) => {
        requireUser(userId)
        const system = await db
          .selectFrom('game_systems')
          .select('id')
          .where('code', '=', params.code)
          .executeTakeFirst()
        if (!system) throw notFound()
        let template: { version: string; json: unknown } | undefined
        if (query.version) {
          const row = await db
            .selectFrom('trait_templates')
            .select(['version', 'template_data'])
            .where('system_id', '=', system.id)
            .where('version', '=', query.version)
            .executeTakeFirst()
          template = row
            ? { version: row.version, json: row.template_data }
            : undefined
        } else template = await latestTemplate(db, system.id)
        if (!template) throw notFound()
        const etag = `"${params.code}@${template.version}"`
        const headers: Record<string, string> = {
          etag,
          // Versão publicada é imutável; a "mais recente" precisa revalidar
          'cache-control': query.version
            ? 'private, max-age=31536000, immutable'
            : 'private, no-cache',
        }
        if (request.headers.get('if-none-match') === etag)
          return new Response(null, { status: 304, headers })
        return new Response(JSON.stringify(template.json), {
          headers: { ...headers, 'content-type': 'application/json' },
        })
      },
      {
        params: t.Object({
          code: t.String({
            maxLength: 64,
            pattern: '^[a-z0-9]+(-[a-z0-9]+)*$',
          }),
        }),
        query: t.Object({
          version: t.Optional(t.String({ pattern: '^\\d+\\.\\d+\\.\\d+$' })),
        }),
      }
    )
    .post(
      '/chronicles/:id/characters',
      async ({ params, body, userId, set }) => {
        const me = requireUser(userId)
        const role = await chronicleAccess(db, me, params.id)
        if (role === null) throw notFound()
        // O ex-membro sabe que a crônica existe: o motivo vai para a tela
        if (role === 'former') throw notMember()
        const kind = body.kind ?? 'pc'
        if (kind === 'npc' && role !== 'storyteller')
          throw new ApiError(403, 'Só o narrador pode fazer isso.', {
            code: 'STORYTELLER_REQUIRED',
          })
        if (kind === 'npc' && !body.clientCommandId)
          throw new ApiError(422, 'informe a chave deste comando')
        const portraitUrl = validHttpsUrl(body.portraitUrl)
        if (body.portraitUrl && !portraitUrl)
          throw new ApiError(422, 'use uma URL HTTPS para o retrato')

        const chronicle = await db
          .selectFrom('chronicles')
          .select(['system_id', 'creation_defaults', 'storyteller_id'])
          .where('id', '=', params.id)
          .executeTakeFirstOrThrow()
        const template = await latestTemplate(db, chronicle.system_id)
        if (!template) throw new ApiError(422, 'sistema sem template publicado')
        const model = await modelFor(db, chronicle.system_id, template.version)

        // Na criação entram só os campos de identidade que o dono pode
        // escrever; o resto nasce vazio e vale o padrão do tipo.
        const createRole: readonly RoleName[] =
          kind === 'npc' ? ['storyteller'] : ['owner']
        const allowed = model.identityFields.filter(id =>
          canWrite(model, id, createRole)
        )
        const extra = Object.keys(body.values).filter(k => !allowed.includes(k))
        if (extra.length)
          throw invalid(
            extra.map(k => ({
              path: `values.${k}`,
              message: 'campo fora da criação de ficha',
            }))
          )
        const nameField = model.template.identity.name
        const values: Record<string, unknown> = {}
        for (const k of allowed)
          if (Object.hasOwn(body.values, k)) values[k] = body.values[k]
        const rawName = values[nameField]
        const name = typeof rawName === 'string' ? rawName.trim() : ''
        if (!name)
          throw invalid([
            { path: `values.${nameField}`, message: 'informe o nome' },
          ])
        values[nameField] = name
        const sheet: SheetData = {
          values: values as SheetData['values'],
          specialties: {},
        }
        const issues = validateSheet(model.template, sheet)
        if (issues.length) throw invalid(issues)
        // A configuração efetiva fica registrada ao nascer: mudar o padrão
        // da crônica depois só vale para fichas novas (doc/plano-v4.md §3.4)
        const defaults = chronicle.creation_defaults
        const creation =
          kind === 'npc'
            ? { config: { mode: 'free' } }
            : model.template.creation &&
                defaults &&
                typeof defaults === 'object' &&
                Object.keys(defaults).length &&
                !validateCreationConfig(model, defaults).length
              ? { config: defaults }
              : {}

        // Protocolo de trava da Etapa 7 (doc/plano-v3.md): o membro trava o
        // vínculo antes de criar. Uma remoção ao mesmo tempo ou termina antes
        // (e aqui não há mais vínculo) ou espera e arquiva a ficha nova. O
        // limite é contado com o vínculo travado: duas criações no limite não
        // passam juntas. O narrador não tem vínculo para travar
        const request = {
          kind,
          values: body.values,
          portraitUrl,
        }
        const row = await db.transaction().execute(async trx => {
          // Toda criação começa pela crônica. Isso serializa limite,
          // transferência e replay do comando sem adquirir outra trava antes.
          const current = await trx
            .selectFrom('chronicles')
            .select('storyteller_id')
            .where('id', '=', params.id)
            .forUpdate()
            .executeTakeFirst()
          if (!current) throw notFound()
          if (kind === 'npc' && current.storyteller_id !== me)
            throw new ApiError(403, 'Só o narrador pode fazer isso.', {
              code: 'STORYTELLER_REQUIRED',
            })

          if (kind === 'npc' && body.clientCommandId) {
            const done = await trx
              .selectFrom('chronicle_commands')
              .select(['kind', 'request_hash', 'result', 'created_by'])
              .where('chronicle_id', '=', params.id)
              .where('client_command_id', '=', body.clientCommandId)
              .executeTakeFirst()
            if (done) {
              if (
                done.kind !== 'character.create-npc' ||
                done.created_by !== me ||
                done.request_hash !==
                  commandHash('character.create-npc', request)
              )
                throw idempotencyConflict()
              return { ...(done.result as { id: string }), duplicate: true }
            }
          }
          if (role === 'member') {
            const link = await trx
              .selectFrom('chronicle_members')
              .select('user_id')
              .where('chronicle_id', '=', params.id)
              .where('user_id', '=', me)
              .forUpdate()
              .executeTakeFirst()
            if (!link) throw notMember()
          }
          const { count } = await trx
            .selectFrom('characters')
            .select(trx.fn.countAll<string>().as('count'))
            .where('chronicle_id', '=', params.id)
            .where('user_id', '=', me)
            .where('deleted_at', 'is', null)
            .$if(kind === 'npc', qb => qb.where('kind', '=', 'npc'))
            .executeTakeFirstOrThrow()
          if (Number(count) >= MAX_CHARACTERS_PER_CHRONICLE)
            throw new ApiError(422, 'limite de fichas nesta crônica')
          const inserted = await trx
            .insertInto('characters')
            .values({
              user_id: me,
              chronicle_id: params.id,
              system_id: chronicle.system_id,
              name,
              sheet_data: JSON.stringify(sheet),
              template_version: template.version,
              creation: JSON.stringify(creation),
              kind,
              visibility: 'hidden',
              portrait_url: portraitUrl,
            })
            .returning('id')
            .executeTakeFirstOrThrow()
          if (kind === 'npc' && body.clientCommandId) {
            await trx
              .insertInto('chronicle_commands')
              .values({
                chronicle_id: params.id,
                client_command_id: body.clientCommandId,
                kind: 'character.create-npc',
                request_hash: commandHash('character.create-npc', request),
                result: JSON.stringify({ id: inserted.id }),
                created_by: me,
              })
              .execute()
            await audit(trx, {
              chronicleId: params.id,
              actorId: me,
              action: 'character.create-npc',
              characterId: inserted.id,
              userId: me,
              payload: { visibility: 'hidden' },
              at: new Date(),
            })
          }
          return { id: inserted.id, duplicate: false }
        })
        set.status = row.duplicate ? 200 : 201
        return row
      },
      {
        params: idParams,
        body: t.Object({
          kind: t.Optional(t.Union([t.Literal('pc'), t.Literal('npc')])),
          clientCommandId: t.Optional(
            t.String({ format: 'uuid', maxLength: 36 })
          ),
          portraitUrl: t.Optional(t.String({ maxLength: 2048 })),
          values: t.Record(t.String({ maxLength: 64 }), t.Unknown(), {
            maxProperties: 50,
          }),
        }),
      }
    )
    .get(
      '/chronicles/:id/characters',
      async ({ params, userId }) => {
        const me = requireUser(userId)
        const role = await chronicleAccess(db, me, params.id)
        if (role === null) throw notFound()
        let q = db
          .selectFrom('characters as ch')
          .innerJoin('users as u', 'u.id', 'ch.user_id')
          .select([
            'ch.id',
            'ch.name',
            'ch.user_id',
            'ch.system_id',
            'ch.template_version',
            'ch.sheet_data',
            'ch.updated_at',
            'ch.kind',
            'ch.visibility',
            'ch.portrait_url',
            'u.username',
          ])
          .where('ch.chronicle_id', '=', params.id)
          .where('ch.deleted_at', 'is', null)
        // Membro recebe os próprios PCs e somente a identidade de NPCs
        // revelados. Ex-membro nunca recebe NPC, mesmo que já tenha sido dono.
        if (role === 'member')
          q = q.where(eb =>
            eb.or([
              eb.and([eb('ch.kind', '=', 'pc'), eb('ch.user_id', '=', me)]),
              eb.and([
                eb('ch.kind', '=', 'npc'),
                eb('ch.visibility', 'in', ['identity', 'full']),
              ]),
            ])
          )
        else if (role === 'former')
          q = q.where('ch.kind', '=', 'pc').where('ch.user_id', '=', me)
        const rows = await q.orderBy('ch.created_at').execute()
        const out = []
        for (const r of rows) {
          const model = await modelFor(db, r.system_id, r.template_version)
          const mine = new Set<RoleName>()
          if (role === 'storyteller') mine.add('storyteller')
          if (r.user_id === me) mine.add('owner')
          const { identity, dock } = model.template
          // Só o que a lista e a mesa mostram (identidade e dock), com o que os
          // derivados deles leem: a Geração vem dos Antecedentes
          const preview = withValueDeps(
            model.template,
            [
              identity.name,
              identity.chip,
              identity.subtitle,
              ...(identity.summary ?? []),
              ...(identity.chipFormat?.match(/\{([a-zA-Z0-9]+)\}/g) ?? []).map(
                m => m.slice(1, -1)
              ),
              model.template.accent.from,
              ...dock,
            ].filter((x): x is string => typeof x === 'string')
          )
          const sheet = stripRestricted(
            model,
            r.sheet_data as unknown as SheetData,
            mine
          )
          const publicIdentity = publicIdentityOf(
            resolve(model, r.sheet_data as unknown as SheetData),
            r.portrait_url
          )
          if (r.kind === 'npc' && role !== 'storyteller') {
            out.push({
              projection: 'identity' as const,
              id: r.id,
              kind: 'npc' as const,
              visibility: r.visibility,
              identity: publicIdentity,
            })
            continue
          }
          out.push({
            projection: 'full' as const,
            id: r.id,
            name: r.name,
            kind: r.kind,
            visibility: r.visibility,
            identity: publicIdentity,
            owner: { id: r.user_id, username: r.username },
            mine: r.user_id === me,
            templateVersion: r.template_version,
            updatedAt: r.updated_at,
            values: Object.fromEntries(
              Object.entries(sheet.values).filter(([k]) => preview.has(k))
            ),
          })
        }
        return out
      },
      { params: idParams }
    )
    .get(
      '/characters/:id',
      async ({ params, userId }) => {
        const me = requireUser(userId)
        const access = await characterAccess(db, me, params.id)
        if (!access) throw notFound()
        const row = await db
          .selectFrom('characters as ch')
          .innerJoin('chronicles as c', 'c.id', 'ch.chronicle_id')
          .innerJoin('game_systems as g', 'g.id', 'ch.system_id')
          .innerJoin('users as u', 'u.id', 'ch.user_id')
          .select([
            'ch.id',
            'ch.name',
            'ch.sheet_data',
            'ch.sheet_version',
            'ch.template_version',
            'ch.updated_at',
            'ch.status',
            'ch.locked_at',
            'ch.creation',
            'ch.creation_revision',
            'ch.creation_completed_at',
            'ch.approved_at',
            'ch.activated_at',
            'ch.kind',
            'ch.visibility',
            'ch.visibility_revision',
            'ch.presentation_revision',
            'ch.portrait_url',
            'c.character_approval',
            'c.id as chronicleId',
            'c.name as chronicleName',
            'g.code as systemCode',
            'u.id as ownerId',
            'u.username as owner',
          ])
          .where('ch.id', '=', params.id)
          .executeTakeFirstOrThrow()
        const model = await modelFor(
          db,
          access.character.systemId,
          access.character.templateVersion
        )
        const publicIdentity = publicIdentityOf(
          resolve(model, row.sheet_data as unknown as SheetData),
          row.portrait_url
        )
        if (access.projection === 'identity')
          return {
            projection: 'identity' as const,
            id: row.id,
            kind: 'npc' as const,
            visibility: 'identity' as const,
            identity: publicIdentity,
          }

        // Viewer recebe um envelope de leitura separado. Em especial, não
        // recebe dono, criação, vínculo, versões administrativas ou datas.
        if (access.roles.has('viewer'))
          return {
            projection: 'full' as const,
            id: row.id,
            kind: 'npc' as const,
            visibility: 'full' as const,
            identity: publicIdentity,
            chronicle: { id: row.chronicleId, name: row.chronicleName },
            systemCode: row.systemCode,
            templateVersion: row.template_version,
            roles: ['viewer'] as const,
            status: row.status,
            lockedAt: row.locked_at,
            sheet: stripRestricted(
              model,
              row.sheet_data as unknown as SheetData,
              access.roles
            ),
          }
        // A pessoa é membro ou narrador da crônica agora: o app calcula a
        // mesma política do servidor (o ex-membro só lê)
        const member =
          (await chronicleAccess(db, me, access.character.chronicleId)) !==
          'former'
        return {
          projection: 'full' as const,
          id: row.id,
          name: row.name,
          kind: row.kind,
          visibility: row.visibility,
          visibilityRevision: row.visibility_revision,
          presentationRevision: row.presentation_revision,
          identity: publicIdentity,
          chronicle: { id: row.chronicleId, name: row.chronicleName },
          owner: { id: row.ownerId, username: row.owner },
          systemCode: row.systemCode,
          templateVersion: row.template_version,
          sheetVersion: row.sheet_version,
          roles: [...access.roles],
          status: row.status,
          lockedAt: row.locked_at,
          // Criação por pontos e aprovação (v4): só dono e narrador chegam aqui
          creation: {
            ...creationView(
              model,
              parseCharacterCreation(model, row.creation),
              row.creation_revision
            ),
            approval: row.character_approval,
            completedAt: row.creation_completed_at,
            approvedAt: row.approved_at,
            // Já passou pela conclusão: volta a active pela rota de estado
            activatedAt: row.activated_at,
          },
          member,
          updatedAt: row.updated_at,
          sheet: stripRestricted(
            model,
            row.sheet_data as unknown as SheetData,
            access.roles
          ),
        }
      },
      { params: idParams }
    )
    .post(
      '/characters/:id/visibility',
      async ({ params, body, userId }) => {
        const me = requireUser(userId)
        return db.transaction().execute(async trx => {
          const row = await lockCharacter(trx, params.id)
          const chronicle = await trx
            .selectFrom('chronicles')
            .select('storyteller_id')
            .where('id', '=', row.chronicleId)
            .executeTakeFirstOrThrow()
          if (chronicle.storyteller_id !== me) {
            if (row.kind === 'npc' || row.userId !== me) throw notFound()
            throw new ApiError(403, 'Só o narrador pode fazer isso.', {
              code: 'STORYTELLER_REQUIRED',
            })
          }
          if (row.kind !== 'npc')
            throw new ApiError(403, 'Só o narrador pode fazer isso.', {
              code: 'STORYTELLER_REQUIRED',
            })
          const intent = {
            characterId: params.id,
            visibility: body.visibility,
            revision: body.revision,
          }
          const hash = commandHash('character.visibility', intent)
          const done = await trx
            .selectFrom('chronicle_commands')
            .select(['kind', 'request_hash', 'result', 'created_by'])
            .where('chronicle_id', '=', row.chronicleId)
            .where('client_command_id', '=', body.clientCommandId)
            .executeTakeFirst()
          if (done) {
            if (
              done.kind !== 'character.visibility' ||
              done.request_hash !== hash ||
              done.created_by !== me
            )
              throw idempotencyConflict()
            return { ...(done.result as object), duplicate: true }
          }
          if (row.visibilityRevision !== body.revision)
            throw new ApiError(
              409,
              'Os dados mudaram. Atualize para continuar.',
              {
                code: 'REVISION_CONFLICT',
                revision: row.visibilityRevision,
              }
            )
          const revision = row.visibilityRevision + 1
          await trx
            .updateTable('characters')
            .set({
              visibility: body.visibility,
              visibility_revision: revision,
              updated_at: new Date(),
            })
            .where('id', '=', params.id)
            .execute()
          const result = { visibility: body.visibility, revision }
          await trx
            .insertInto('chronicle_commands')
            .values({
              chronicle_id: row.chronicleId,
              client_command_id: body.clientCommandId,
              kind: 'character.visibility',
              request_hash: hash,
              result: JSON.stringify(result),
              created_by: me,
            })
            .execute()
          await audit(trx, {
            chronicleId: row.chronicleId,
            actorId: me,
            action: 'character.visibility',
            characterId: params.id,
            payload: { from: row.visibility, to: body.visibility },
            at: new Date(),
          })
          return { ...result, duplicate: false }
        })
      },
      {
        params: idParams,
        body: t.Object({
          clientCommandId: t.String({ format: 'uuid' }),
          visibility: t.Union([
            t.Literal('hidden'),
            t.Literal('identity'),
            t.Literal('full'),
          ]),
          revision: t.Integer({ minimum: 0 }),
        }),
      }
    )
    .patch(
      '/characters/:id/presentation',
      async ({ params, body, userId }) => {
        const me = requireUser(userId)
        const portraitUrl = validHttpsUrl(body.portraitUrl)
        if (body.portraitUrl && !portraitUrl)
          throw new ApiError(422, 'use uma URL HTTPS para o retrato')
        return db.transaction().execute(async trx => {
          const row = await lockCharacter(trx, params.id)
          const chronicle = await trx
            .selectFrom('chronicles')
            .select('storyteller_id')
            .where('id', '=', row.chronicleId)
            .executeTakeFirstOrThrow()
          if (chronicle.storyteller_id !== me) {
            if (row.kind === 'npc' || row.userId !== me) throw notFound()
            throw new ApiError(403, 'Só o narrador pode fazer isso.', {
              code: 'STORYTELLER_REQUIRED',
            })
          }
          if (row.kind !== 'npc')
            throw new ApiError(403, 'Só o narrador pode fazer isso.', {
              code: 'STORYTELLER_REQUIRED',
            })
          const intent = {
            characterId: params.id,
            portraitUrl,
            revision: body.revision,
          }
          const hash = commandHash('character.presentation', intent)
          const done = await trx
            .selectFrom('chronicle_commands')
            .select(['kind', 'request_hash', 'result', 'created_by'])
            .where('chronicle_id', '=', row.chronicleId)
            .where('client_command_id', '=', body.clientCommandId)
            .executeTakeFirst()
          if (done) {
            if (
              done.kind !== 'character.presentation' ||
              done.request_hash !== hash ||
              done.created_by !== me
            )
              throw idempotencyConflict()
            return { ...(done.result as object), duplicate: true }
          }
          if (row.presentationRevision !== body.revision)
            throw new ApiError(
              409,
              'Os dados mudaram. Atualize para continuar.',
              {
                code: 'REVISION_CONFLICT',
                revision: row.presentationRevision,
              }
            )
          const revision = row.presentationRevision + 1
          await trx
            .updateTable('characters')
            .set({ portrait_url: portraitUrl, presentation_revision: revision })
            .where('id', '=', params.id)
            .execute()
          const result = { portraitUrl, revision }
          await trx
            .insertInto('chronicle_commands')
            .values({
              chronicle_id: row.chronicleId,
              client_command_id: body.clientCommandId,
              kind: 'character.presentation',
              request_hash: hash,
              result: JSON.stringify(result),
              created_by: me,
            })
            .execute()
          return { ...result, duplicate: false }
        })
      },
      {
        params: idParams,
        body: t.Object({
          clientCommandId: t.String({ format: 'uuid' }),
          revision: t.Integer({ minimum: 0 }),
          portraitUrl: t.Union([t.String({ maxLength: 2048 }), t.Null()]),
        }),
      }
    )
    .delete(
      '/characters/:id',
      async ({ params, userId, set }) => {
        const me = requireUser(userId)
        const access = await characterAccess(db, me, params.id)
        if (!access || access.roles.has('viewer')) throw notFound()
        const model = await modelFor(
          db,
          access.character.systemId,
          access.character.templateVersion
        )
        // A política da escrita, sem classe (doc/plano-v3.md §7, decisão 5):
        // o dono exclui em creating e em active sem trava; o ex-membro, nunca;
        // o narrador, sempre. Entra no registro da crônica
        await db.transaction().execute(async trx => {
          const row = await lockCharacter(trx, params.id)
          const verdict = writePolicy(
            await writeAccess(trx, access.roles, row.chronicleId, me),
            row.status,
            row.lockedAt !== null,
            []
          )
          if (!verdict.ok)
            throw refusal(verdict, { model, roles: access.roles, paths: [] })
          const now = new Date()
          await trx
            .updateTable('characters')
            .set({ deleted_at: now })
            .where('id', '=', params.id)
            .execute()
          await audit(trx, {
            chronicleId: row.chronicleId,
            actorId: me,
            action: 'character.delete',
            characterId: params.id,
            userId: row.userId,
            payload: { status: row.status },
            at: now,
          })
        })
        set.status = 204
        return null
      },
      { params: idParams }
    )
}
