import type { DB } from '@tms/db'
import {
  CHARACTER_STATUSES,
  isCharacterStatus,
  type SheetData,
  stripRestricted,
} from '@tms/sheet-core'
import { Elysia, t } from 'elysia'
import type { Kysely } from 'kysely'
import type { authGuard } from '../auth/guard'
import { requireUser } from '../auth/guard'
import { chronicleAccess } from '../authz'
import { ApiError } from '../http/errors'
import { idParams } from '../http/params'
import { creationStateOf } from '../sheets/creation-state'
import { modelFor } from '../sheets/models'

// Mesa do narrador (doc/plano-v0.md, Etapa 19): todas as fichas da crônica
// numa resposta só, para a tela desenhar o dock de cada uma sem N+1
// requisições. Só o narrador da crônica; para os demais a rota não existe
// (404, o mesmo de "sem vínculo"). A ficha vai inteira porque um valor do dock
// pode depender de outro campo (o máximo do Sangue vem da Geração), e mesmo
// assim passa por stripRestricted com os papéis resolvidos no banco.
//
// v3, Etapa 9: a Mesa mostra `creating`, `pending` e `active`; `?status=archived,dead`
// traz as outras. O filtro é aqui, para a resposta não levar o que a tela
// esconde.
//
// P09-C (T-83): cada linha diz quem fez a última alteração da ficha, a partir
// do último lote (`character_batches`), e não do `updated_at`, que muda com
// trava, estado e retrato. O `by` é um enum calculado aqui contra quem pede e
// contra o dono: a resposta não leva o `created_by` nem o nome de outro
// narrador ou jogador.

const notFound = () => new ApiError(404, 'não encontrado')

// Os estados que a Mesa mostra sem filtro; `pending` (v4) aparece para o
// narrador aprovar ou devolver
const IN_PLAY = ['creating', 'pending', 'active'] as const

export type LastChangeBy = 'you' | 'owner' | 'other'

// `you` antes de `owner`: no NPC, o dono é o próprio narrador. Lote sem autor
// (conta excluída) é `other`.
export function lastChangeBy(
  createdBy: string | null,
  me: string,
  ownerId: string
): LastChangeBy {
  if (createdBy === null) return 'other'
  if (createdBy === me) return 'you'
  if (createdBy === ownerId) return 'owner'
  return 'other'
}

export function tableRoutes(
  db: Kysely<DB>,
  guard: ReturnType<typeof authGuard>
) {
  return new Elysia().use(guard).get(
    '/chronicles/:id/table',
    async ({ params, query, userId }) => {
      const me = requireUser(userId)
      if ((await chronicleAccess(db, me, params.id)) !== 'storyteller')
        throw notFound()
      const statuses = query.status
        ? [...new Set(query.status.split(','))]
        : [...IN_PLAY]
      if (!statuses.every(isCharacterStatus))
        throw new ApiError(422, 'estado inválido', {
          issues: [
            {
              path: 'status',
              message: `um de ${CHARACTER_STATUSES.join(', ')}`,
            },
          ],
        })
      const rows = await db
        .selectFrom('characters as ch')
        .innerJoin('users as u', 'u.id', 'ch.user_id')
        .innerJoin('game_systems as g', 'g.id', 'ch.system_id')
        // O último lote da ficha: o índice (character_id, created_at) acha a
        // linha sem varrer o histórico. A versão desempata lotes no mesmo
        // instante.
        .leftJoinLateral(
          eb =>
            eb
              .selectFrom('character_batches as b')
              .select(['b.created_at', 'b.created_by'])
              .whereRef('b.character_id', '=', 'ch.id')
              .orderBy('b.created_at', 'desc')
              .orderBy('b.sheet_version', 'desc')
              .limit(1)
              .as('lb'),
          join => join.onTrue()
        )
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
          'ch.kind',
          'ch.visibility',
          'ch.creation',
          'ch.activated_at',
          'u.username',
          'g.code as systemCode',
          'lb.created_at as lastChangeAt',
          'lb.created_by as lastChangeBy',
        ])
        .where('ch.chronicle_id', '=', params.id)
        .where('ch.deleted_at', 'is', null)
        .where('ch.status', 'in', statuses)
        .orderBy('ch.created_at')
        .execute()
      const out = []
      for (const r of rows) {
        const model = await modelFor(db, r.system_id, r.template_version)
        out.push({
          id: r.id,
          name: r.name,
          kind: r.kind,
          visibility: r.visibility,
          owner: { id: r.user_id, username: r.username },
          systemCode: r.systemCode,
          templateVersion: r.template_version,
          sheetVersion: r.sheet_version,
          status: r.status,
          // O estado da criação (P04-D, R-12), como na lista: o modo e os
          // marcadores, sem o motivo
          ...creationStateOf(model, r.status, r.creation),
          activatedAt: r.activated_at,
          lockedAt: r.locked_at,
          updatedAt: r.updated_at,
          lastChange:
            r.lastChangeAt === null
              ? null
              : {
                  at: r.lastChangeAt,
                  by: lastChangeBy(r.lastChangeBy, me, r.user_id),
                },
          sheet: stripRestricted(model, r.sheet_data as unknown as SheetData, [
            'storyteller',
          ]),
        })
      }
      return out
    },
    {
      params: idParams,
      query: t.Object({
        status: t.Optional(t.String({ maxLength: 60 })),
      }),
    }
  )
}
