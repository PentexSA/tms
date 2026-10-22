import type { DB } from '@tms/db'
import { type CharacterStatus, isCharacterStatus } from '@tms/sheet-core'
import { Elysia, t } from 'elysia'
import type { Kysely, Updateable } from 'kysely'
import { type AuditAction, audit } from '../audit'
import type { authGuard } from '../auth/guard'
import { requireUser } from '../auth/guard'
import { characterAccess } from '../authz'
import { ApiError } from '../http/errors'
import { idParams } from '../http/params'
import type { AppOptions } from '../options'
import { type LockedCharacter, lockCharacter } from './policy'

// Estados da ficha (doc/painel-narrador.md §5.1; doc/plano-v3.md, Etapa 5).
// Ações do narrador, cada uma numa transação com a ficha travada e uma linha
// no `chronicle_audit`. Uma ação que não muda nada (concluir de novo, travar
// a travada) é 409 e não gera linha.
//
// creating → active (concluir) → archived | dead, e de volta a active
// (reativar). Voltar para creating não existe. A trava só vale em active, e
// sair de active a limpa (§7, decisão 6).

const notFound = () => new ApiError(404, 'não encontrado')
const conflict = (message: string) => new ApiError(409, message)

interface Change {
  readonly set: Updateable<DB['characters']>
  readonly action: AuditAction
  readonly payload?: Readonly<Record<string, string | boolean | null>>
}

// Os estados que o narrador escolhe pela rota de estado.
const TARGETS: readonly CharacterStatus[] = ['active', 'archived', 'dead']

export function statusRoutes(
  db: Kysely<DB>,
  options: AppOptions,
  guard: ReturnType<typeof authGuard>
) {
  // Só o narrador; o dono recebe 403, quem não tem papel, 404
  const administer = async (
    me: string,
    id: string,
    decide: (row: LockedCharacter, now: Date) => Change
  ) => {
    const access = await characterAccess(db, me, id)
    if (!access) throw notFound()
    if (!access.roles.has('storyteller'))
      throw new ApiError(403, 'só o narrador muda o estado da ficha')
    return db.transaction().execute(async trx => {
      const row = await lockCharacter(trx, id)
      const now = options.now()
      const change = decide(row, now)
      const updated = await trx
        .updateTable('characters')
        .set({ ...change.set, updated_at: now })
        .where('id', '=', id)
        .returning(['status', 'locked_at', 'creation_completed_at'])
        .executeTakeFirstOrThrow()
      await audit(trx, {
        chronicleId: row.chronicleId,
        actorId: me,
        action: change.action,
        characterId: id,
        userId: row.userId,
        ...(change.payload && { payload: change.payload }),
        at: now,
      })
      return {
        status: updated.status,
        lockedAt: updated.locked_at,
        creationCompletedAt: updated.creation_completed_at,
      }
    })
  }

  return new Elysia()
    .use(guard)
    .post(
      '/characters/:id/creation/complete',
      ({ params, userId }) =>
        administer(requireUser(userId), params.id, (row, now) => {
          if (row.status !== 'creating') throw conflict('criação já concluída')
          return {
            set: {
              status: 'active',
              creation_completed_at: now,
              creation_completed_by: requireUser(userId),
            },
            action: 'character.creation.complete',
          }
        }),
      { params: idParams }
    )
    .post(
      '/characters/:id/status',
      ({ params, body, userId }) => {
        const to = body.status
        if (!isCharacterStatus(to) || !TARGETS.includes(to))
          throw new ApiError(422, 'estado inválido', {
            issues: [{ path: 'status', message: 'estado inválido' }],
          })
        return administer(requireUser(userId), params.id, row => {
          if (row.status === to) throw conflict('a ficha já está nesse estado')
          // De creating para active, só concluindo a criação
          if (row.status === 'creating' && to === 'active')
            throw conflict('conclua a criação')
          const unlocked = row.lockedAt !== null
          return {
            set: { status: to, locked_at: null },
            action: 'character.status',
            payload: { from: row.status, to, ...(unlocked && { unlocked }) },
          }
        })
      },
      {
        params: idParams,
        body: t.Object({ status: t.String({ maxLength: 20 }) }),
      }
    )
    .post(
      '/characters/:id/lock',
      ({ params, userId }) =>
        administer(requireUser(userId), params.id, (row, now) => {
          if (row.status !== 'active')
            throw conflict('só uma ficha ativa é travada')
          if (row.lockedAt) throw conflict('a ficha já está travada')
          return { set: { locked_at: now }, action: 'character.lock' }
        }),
      { params: idParams }
    )
    .delete(
      '/characters/:id/lock',
      ({ params, userId }) =>
        administer(requireUser(userId), params.id, row => {
          if (row.status !== 'active')
            throw conflict('só uma ficha ativa é travada')
          if (!row.lockedAt) throw conflict('a ficha não está travada')
          return { set: { locked_at: null }, action: 'character.unlock' }
        }),
      { params: idParams }
    )
}
