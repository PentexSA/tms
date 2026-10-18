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
