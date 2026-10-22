import type { DB } from '@tms/db'
import { type SheetData, stripRestricted } from '@tms/sheet-core'
import { Elysia } from 'elysia'
import type { Kysely } from 'kysely'
import type { authGuard } from '../auth/guard'
import { requireUser } from '../auth/guard'
import { chronicleAccess } from '../authz'
import { ApiError } from '../http/errors'
import { idParams } from '../http/params'
import { modelFor } from '../sheets/models'

// Mesa do narrador (doc/plano-v0.md, Etapa 19): todas as fichas da crônica
// numa resposta só, para a tela desenhar o dock de cada uma sem N+1
// requisições. Só o narrador da crônica; para os demais a rota não existe
// (404, o mesmo de "sem vínculo"). A ficha vai inteira porque um valor do dock
// pode depender de outro campo (o máximo do Sangue vem da Geração), e mesmo
// assim passa por stripRestricted com os papéis resolvidos no banco.

const notFound = () => new ApiError(404, 'não encontrado')

export function tableRoutes(
  db: Kysely<DB>,
  guard: ReturnType<typeof authGuard>
) {
  return new Elysia().use(guard).get(
    '/chronicles/:id/table',
    async ({ params, userId }) => {
      const me = requireUser(userId)
      if ((await chronicleAccess(db, me, params.id)) !== 'storyteller')
        throw notFound()
      const rows = await db
        .selectFrom('characters as ch')
        .innerJoin('users as u', 'u.id', 'ch.user_id')
        .innerJoin('game_systems as g', 'g.id', 'ch.system_id')
        .select([
          'ch.id',
          'ch.name',
          'ch.user_id',
          'ch.system_id',
          'ch.template_version',
          'ch.sheet_data',
          'ch.sheet_version',
          'ch.updated_at',
          'ch.status',
          'ch.locked_at',
          'u.username',
          'g.code as systemCode',
        ])
        .where('ch.chronicle_id', '=', params.id)
        .where('ch.deleted_at', 'is', null)
        .orderBy('ch.created_at')
        .execute()
      const out = []
      for (const r of rows) {
        const model = await modelFor(db, r.system_id, r.template_version)
        out.push({
          id: r.id,
          name: r.name,
          owner: { id: r.user_id, username: r.username },
          systemCode: r.systemCode,
          templateVersion: r.template_version,
          sheetVersion: r.sheet_version,
          status: r.status,
          lockedAt: r.locked_at,
          updatedAt: r.updated_at,
          sheet: stripRestricted(model, r.sheet_data as unknown as SheetData, [
            'storyteller',
          ]),
        })
      }
      return out
    },
    { params: idParams }
  )
}
