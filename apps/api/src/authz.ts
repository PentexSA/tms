import type { DB } from '@tms/db'
import type { RoleName } from '@tms/sheet-core'
import type { Kysely } from 'kysely'

// AuthZ por crônica (contrato §11), sempre resolvida no banco a partir do
// usuário da sessão; nunca de papel, dono ou id vindos do cliente. Sem vínculo
// = 404 (não 403, para não confirmar que o recurso existe).
//
// Dois tipos de papel, que não se misturam: o papel na crônica (narrador ou
// membro), que decide quem entra nas rotas da crônica, e os papéis na ficha
// (dono e narrador, do core), que decidem o que se lê e escreve nela. Outro
// membro não tem papel na ficha alheia (doc/plano-v3.md, Etapa 2).

export type Roles = ReadonlySet<RoleName>

// `former`: quem saiu ou foi removido e ainda tem ficha (não excluída) na
// crônica (doc/plano-v3.md, Etapa 7). Nunca é membro: cada rota diz o que faz
// com ele, e o padrão é a resposta de quem não tem vínculo.
export type ChronicleRole = 'storyteller' | 'member' | 'former' | null

export async function chronicleAccess(
  db: Kysely<DB>,
  userId: string,
  chronicleId: string
): Promise<ChronicleRole> {
  const row = await db
    .selectFrom('chronicles')
    .leftJoin('chronicle_members', join =>
      join
        .onRef('chronicle_members.chronicle_id', '=', 'chronicles.id')
        .on('chronicle_members.user_id', '=', userId)
    )
    .select(eb => [
      'chronicles.storyteller_id',
      'chronicle_members.user_id as member',
      eb
        .exists(
          eb
            .selectFrom('characters')
            .select('characters.id')
            .whereRef('characters.chronicle_id', '=', 'chronicles.id')
            .where('characters.user_id', '=', userId)
            .where('characters.deleted_at', 'is', null)
        )
        .as('hasCharacter'),
    ])
    .where('chronicles.id', '=', chronicleId)
    .executeTakeFirst()
  if (!row) return null
  if (row.storyteller_id === userId) return 'storyteller'
  if (row.member) return 'member'
  return row.hasCharacter ? 'former' : null
}

export interface CharacterAccess {
  readonly roles: Roles
  readonly projection: 'full' | 'identity'
  readonly character: {
    readonly id: string
    readonly userId: string
    readonly chronicleId: string
    readonly systemId: string
    readonly templateVersion: string
    readonly kind: 'pc' | 'npc'
    readonly visibility: 'hidden' | 'identity' | 'full'
  }
}

/**
 * Papéis na ficha: dono (characters.user_id) e narrador da crônica. Outro
 * membro, ficha excluída ou sem vínculo: null (404).
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
      'ch.kind',
      'ch.visibility',
      'c.storyteller_id',
      'm.user_id as member_id',
    ])
    .where('ch.id', '=', characterId)
    .where('ch.deleted_at', 'is', null)
    .executeTakeFirst()
  if (!row) return null
  const roles = new Set<RoleName>()
  let projection: CharacterAccess['projection'] = 'full'
  if (row.kind === 'npc') {
    // Posse isolada nunca autoriza NPC: ela acompanha o narrador atual apenas
    // para preservar o registro quando a narração é transferida.
    if (row.storyteller_id === userId) roles.add('storyteller')
    else if (row.member_id && row.visibility !== 'hidden') {
      roles.add('viewer')
      projection = row.visibility === 'full' ? 'full' : 'identity'
    }
  } else {
    if (row.user_id === userId) roles.add('owner')
    if (row.storyteller_id === userId) roles.add('storyteller')
  }
  if (roles.size === 0) return null
  return {
    roles,
    projection,
    character: {
      id: row.id,
      userId: row.user_id,
      chronicleId: row.chronicle_id,
      systemId: row.system_id,
      templateVersion: row.template_version,
      kind: row.kind as 'pc' | 'npc',
      visibility: row.visibility as 'hidden' | 'identity' | 'full',
    },
  }
}
