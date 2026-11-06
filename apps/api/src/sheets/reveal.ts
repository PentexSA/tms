import { createHash } from 'node:crypto'
import type { DB } from '@tms/db'
import {
  canRead,
  revealableSections,
  type SheetData,
  type SheetModel,
} from '@tms/sheet-core'
import { Elysia, t } from 'elysia'
import type { Kysely } from 'kysely'
import { audit } from '../audit'
import type { authGuard } from '../auth/guard'
import { requireUser } from '../auth/guard'
import { characterAccess, chronicleAccess } from '../authz'
import { ApiError } from '../http/errors'
import { idParams } from '../http/params'
import { modelFor } from './models'
import { lockCharacter } from './policy'

// U-11 (P16-D): o narrador da crônica revela ao dono de uma ficha de jogador
// uma seção restrita (as Notas do Narrador), só em leitura, e pode escondê-la
// de novo. A revelação é viva: o dono lê o texto atual enquanto ela durar.
//
// - O estado (`revealed_sections`, `reveal_revision`) vive na linha da ficha;
//   o texto nunca é copiado.
// - O texto revelado só sai por `GET /characters/:id/revealed`, ao dono que é
//   membro atual e ao narrador. Nenhuma saída de hoje (ficha, lote, 409,
//   rolagem, Mesa, Histórico) muda: elas continuam sem a seção para o dono.
// - O papel vem do banco; o corpo não traz dono, papel nem usuário.

const notFound = () => new ApiError(404, 'não encontrado')

const storytellerRequired = () =>
  new ApiError(403, 'Só o narrador pode fazer isso.', {
    code: 'STORYTELLER_REQUIRED',
  })

const unavailable = () =>
  new ApiError(422, 'Esta ficha não tem notas para revelar ao jogador.', {
    code: 'REVEAL_UNAVAILABLE',
  })

const idempotencyConflict = () =>
  new ApiError(
    409,
    'Esta ação já foi enviada com outros dados. Atualize antes de tentar novamente.',
    { code: 'IDEMPOTENCY_CONFLICT' }
  )

const commandHash = (kind: string, request: unknown) =>
  createHash('sha256').update(JSON.stringify({ kind, request })).digest('hex')

const COMMAND = 'character.reveal'

/** As seções gravadas que o modelo da ficha ainda deixa revelar. */
export function revealedOf(
  model: SheetModel,
  stored: readonly string[] | null | undefined
): string[] {
  const allowed = revealableSections(model)
  return [...new Set(stored ?? [])].filter(id => allowed.includes(id))
}

/**
 * Os valores de texto das seções reveladas que os papéis leem com a
 * revelação. Só campos dessas seções, só strings.
 */
export function revealedValues(
  model: SheetModel,
  sheet: SheetData,
  roles: Iterable<string>,
  sections: readonly string[]
): { id: string; values: Record<string, string> }[] {
  const mine = [...roles]
  return sections.map(id => {
    const values: Record<string, string> = {}
    for (const fieldId of model.sections.get(id)?.fieldIds ?? []) {
      const value = sheet.values?.[fieldId]
      if (typeof value !== 'string') continue
      if (!canRead(model, fieldId, mine, sections)) continue
      values[fieldId] = value
    }
    return { id, values }
  })
}

export function revealRoutes(
  db: Kysely<DB>,
  guard: ReturnType<typeof authGuard>
) {
  return new Elysia()
    .use(guard)
    .post(
      '/characters/:id/reveal',
      async ({ params, body, userId }) => {
        const me = requireUser(userId)
        return db.transaction().execute(async trx => {
          // Trava a crônica (compartilhada) e a ficha: serializa com a
          // transferência de narração e com outro revelar/esconder
          const row = await lockCharacter(trx, params.id)
          const chronicle = await trx
            .selectFrom('chronicles')
            .select('storyteller_id')
            .where('id', '=', row.chronicleId)
            .executeTakeFirstOrThrow()
          if (chronicle.storyteller_id !== me) {
            // NPC ou ficha alheia: igual a não existir
            if (row.kind === 'npc' || row.userId !== me) throw notFound()
            throw storytellerRequired()
          }
          // NPC tem a própria visibilidade; na própria ficha o narrador já lê
          if (row.kind !== 'pc' || row.userId === me) throw unavailable()
          // Na transação (`trx`): outra conexão travaria no PGLite e esgotaria
          // o pool com a linha da ficha presa
          const model = await modelFor(trx, row.systemId, row.templateVersion)
          if (!revealableSections(model).includes(body.section))
            throw unavailable()

          const intent = {
            characterId: params.id,
            section: body.section,
            revealed: body.revealed,
            revision: body.revision,
          }
          const hash = commandHash(COMMAND, intent)
          const done = await trx
            .selectFrom('chronicle_commands')
            .select(['kind', 'request_hash', 'result', 'created_by'])
            .where('chronicle_id', '=', row.chronicleId)
            .where('client_command_id', '=', body.clientCommandId)
            .executeTakeFirst()
          if (done) {
            if (
              done.kind !== COMMAND ||
              done.request_hash !== hash ||
              done.created_by !== me
            )
              throw idempotencyConflict()
            return { ...(done.result as object), duplicate: true }
          }
          if (row.revealRevision !== body.revision)
            throw new ApiError(
              409,
              'Os dados mudaram. Atualize para continuar.',
              { code: 'REVISION_CONFLICT', revision: row.revealRevision }
            )

          const stored = row.revealedSections
          const has = stored.includes(body.section)
          let revision = row.revealRevision
          let next = [...stored]
          if (has !== body.revealed) {
            next = body.revealed
              ? [...stored, body.section]
              : stored.filter(id => id !== body.section)
            revision += 1
            // Revelar não é edição da ficha: sem lote, sem `sheet_version`
            // e sem `updated_at`
            await trx
              .updateTable('characters')
              .set({ revealed_sections: next, reveal_revision: revision })
              .where('id', '=', params.id)
              .execute()
            await audit(trx, {
              chronicleId: row.chronicleId,
              actorId: me,
              action: body.revealed
                ? 'character.section.reveal'
                : 'character.section.hide',
              characterId: params.id,
              // Só o id da seção, nunca o texto
              payload: { section: body.section },
              at: new Date(),
            })
          }
          const result = {
            section: body.section,
            revealed: body.revealed,
            sections: revealedOf(model, next),
            revision,
          }
          await trx
            .insertInto('chronicle_commands')
            .values({
              chronicle_id: row.chronicleId,
              client_command_id: body.clientCommandId,
              kind: COMMAND,
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
          section: t.String({
            minLength: 1,
            maxLength: 64,
            pattern: '^[a-zA-Z][a-zA-Z0-9-]*$',
          }),
          revealed: t.Boolean(),
          revision: t.Integer({ minimum: 0 }),
        }),
      }
    )
    .get(
      '/characters/:id/revealed',
      async ({ params, userId }) => {
        const me = requireUser(userId)
        const access = await characterAccess(db, me, params.id)
        // Sem papel, NPC (o viewer inclusive) ou ficha excluída: 404
        if (!access || access.character.kind !== 'pc') throw notFound()
        if (!access.roles.has('owner') && !access.roles.has('storyteller'))
          throw notFound()
        // O dono precisa ser membro atual: o ex-membro não lê (404)
        if (
          !access.roles.has('storyteller') &&
          (await chronicleAccess(db, me, access.character.chronicleId)) !==
            'member'
        )
          throw notFound()
        // Estado e texto numa leitura só, para a revisão casar com o texto
        const row = await db
          .selectFrom('characters')
          .select(['sheet_data', 'revealed_sections', 'reveal_revision'])
          .where('id', '=', params.id)
          .where('deleted_at', 'is', null)
          .executeTakeFirst()
        if (!row) throw notFound()
        const model = await modelFor(
          db,
          access.character.systemId,
          access.character.templateVersion
        )
        const sections = revealedOf(model, row.revealed_sections)
        return {
          revision: row.reveal_revision,
          sections: revealedValues(
            model,
            row.sheet_data as unknown as SheetData,
            access.roles,
            sections
          ),
        }
      },
      { params: idParams }
    )
}
