import type { DB } from '@tms/db'
import {
  canWrite,
  type Issue,
  type SheetData,
  stripRestricted,
  validateSheet,
} from '@tms/sheet-core'
import { Elysia, t } from 'elysia'
import type { Kysely } from 'kysely'
import type { authGuard } from '../auth/guard'
import { requireUser } from '../auth/guard'
import { characterAccess, chronicleRoles } from '../authz'
import { ApiError } from '../http/errors'
import { idParams } from '../http/params'
import { latestTemplate, modelFor } from './models'

// Fichas: leitura e criação (doc/plano-v0.md, Etapa 12). Toda saída passa por
// stripRestricted com os papéis resolvidos no banco: o aparelho de quem não
// lê as Notas do Narrador nunca as recebe.

export const MAX_CHARACTERS_PER_CHRONICLE = 20
const notFound = () => new ApiError(404, 'não encontrado')

// "values.clan" → "/values/clan", o mesmo formato dos erros de validação
const fieldsOf = (issues: readonly Issue[]) =>
  issues.map(i => ({
    path: i.path ? `/${i.path.replace(/\./g, '/')}` : '/',
    message: i.message,
  }))

const invalid = (issues: readonly Issue[]) =>
  new ApiError(422, 'ficha inválida', { issues: fieldsOf(issues) })

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
        const roles = await chronicleRoles(db, me, params.id)
        if (roles.size === 0) throw notFound()
        const chronicle = await db
          .selectFrom('chronicles')
          .select('system_id')
          .where('id', '=', params.id)
          .executeTakeFirstOrThrow()
        const template = await latestTemplate(db, chronicle.system_id)
        if (!template) throw new ApiError(422, 'sistema sem template publicado')
        const model = await modelFor(db, chronicle.system_id, template.version)

        // Na criação entram só os campos de identidade que o dono pode
        // escrever; o resto nasce vazio e vale o padrão do tipo.
        const allowed = model.identityFields.filter(id =>
          canWrite(model, id, ['owner'])
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

        const { count } = await db
          .selectFrom('characters')
          .select(db.fn.countAll<string>().as('count'))
          .where('chronicle_id', '=', params.id)
          .where('user_id', '=', me)
          .where('deleted_at', 'is', null)
          .executeTakeFirstOrThrow()
        if (Number(count) >= MAX_CHARACTERS_PER_CHRONICLE)
          throw new ApiError(422, 'limite de fichas nesta crônica')

        const row = await db
          .insertInto('characters')
          .values({
            user_id: me,
            chronicle_id: params.id,
            system_id: chronicle.system_id,
            name,
            sheet_data: JSON.stringify(sheet),
            template_version: template.version,
          })
          .returning('id')
          .executeTakeFirstOrThrow()
        set.status = 201
        return { id: row.id }
      },
      {
        params: idParams,
        body: t.Object({
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
        const roles = await chronicleRoles(db, me, params.id)
        if (roles.size === 0) throw notFound()
        const rows = await db
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
            'u.username',
          ])
          .where('ch.chronicle_id', '=', params.id)
          .where('ch.deleted_at', 'is', null)
          .orderBy('ch.created_at')
          .execute()
        const out = []
        for (const r of rows) {
          const model = await modelFor(db, r.system_id, r.template_version)
          const mine = new Set(roles)
          if (r.user_id === me) mine.add('owner')
          const { identity, dock } = model.template
          // Só o que a lista e a mesa mostram: identidade e dock
          const preview = new Set([
            identity.name,
            identity.chip,
            identity.subtitle,
            ...(identity.summary ?? []),
            ...(identity.chipFormat?.match(/\{([a-zA-Z0-9]+)\}/g) ?? []).map(
              m => m.slice(1, -1)
            ),
            model.template.accent.from,
            ...dock,
          ])
          const sheet = stripRestricted(
            model,
            r.sheet_data as unknown as SheetData,
            mine
          )
          out.push({
            id: r.id,
            name: r.name,
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
        return {
          id: row.id,
          name: row.name,
          chronicle: { id: row.chronicleId, name: row.chronicleName },
          owner: { id: row.ownerId, username: row.owner },
          systemCode: row.systemCode,
          templateVersion: row.template_version,
          sheetVersion: row.sheet_version,
          roles: [...access.roles],
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
    .delete(
      '/characters/:id',
      async ({ params, userId, set }) => {
        const me = requireUser(userId)
        const access = await characterAccess(db, me, params.id)
        if (!access) throw notFound()
        if (!access.roles.has('owner') && !access.roles.has('storyteller'))
          throw new ApiError(
            403,
            'só o dono ou o narrador pode excluir a ficha'
          )
        await db
          .updateTable('characters')
          .set({ deleted_at: new Date() })
          .where('id', '=', params.id)
          .execute()
        set.status = 204
        return null
      },
      { params: idParams }
    )
}
