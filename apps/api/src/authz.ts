import type { DB } from '@tms/db'
import type { RoleName } from '@tms/sheet-core'
import type { Kysely } from 'kysely'

// AuthZ por crônica (contrato §11), sempre resolvida no banco a partir do
// usuário da sessão; nunca de papel, dono ou id vindos do cliente. Conjunto
// vazio = sem vínculo = 404 (não 403, para não confirmar que o recurso existe).

export type Roles = ReadonlySet<RoleName>

export async function chronicleRoles(
  db: Kysely<DB>,
  userId: string,
  chronicleId: string
): Promise<Roles> {
  const row = await db
    .selectFrom('chronicles')
    .leftJoin('chronicle_members', join =>
      join
        .onRef('chronicle_members.chronicle_id', '=', 'chronicles.id')
        .on('chronicle_members.user_id', '=', userId)
    )
    .select([
      'chronicles.storyteller_id',
      'chronicle_members.user_id as member',
    ])
    .where('chronicles.id', '=', chronicleId)
    .executeTakeFirst()
  const roles = new Set<RoleName>()
  if (!row) return roles
  if (row.storyteller_id === userId) roles.add('storyteller')
  if (row.member) roles.add('player')
  return roles
}

export interface CharacterAccess {
  readonly roles: Roles
  readonly character: {
    readonly id: string
    readonly userId: string
    readonly chronicleId: string
    readonly systemId: string
    readonly templateVersion: string
  }
}

/**
 * Papéis na ficha: dono (characters.user_id), narrador da crônica e jogador
 * (outro membro da crônica). Ficha excluída ou sem vínculo: null (404).
 */
export async function characterAccess(
  db: Kysely<DB>,
  userId: string,
  characterId: string
): Promise<CharacterAccess | null> {
  const row = await db
    .selectFrom('characters as ch')
    .innerJoin('chronicles as c', 'c.id', 'ch.chronicle_id')
    .leftJoin('chronicle_members as m', join =>
      join
        .onRef('m.chronicle_id', '=', 'ch.chronicle_id')
        .on('m.user_id', '=', userId)
    )
    .select([
      'ch.id',
      'ch.user_id',
      'ch.chronicle_id',
      'ch.system_id',
      'ch.template_version',
      'c.storyteller_id',
      'm.user_id as member',
    ])
    .where('ch.id', '=', characterId)
    .where('ch.deleted_at', 'is', null)
    .executeTakeFirst()
  if (!row) return null
  const roles = new Set<RoleName>()
  if (row.user_id === userId) roles.add('owner')
  if (row.storyteller_id === userId) roles.add('storyteller')
  if (row.member && row.user_id !== userId) roles.add('player')
  if (roles.size === 0) return null
  return {
    roles,
    character: {
      id: row.id,
      userId: row.user_id,
      chronicleId: row.chronicle_id,
      systemId: row.system_id,
      templateVersion: row.template_version,
    },
  }
}
