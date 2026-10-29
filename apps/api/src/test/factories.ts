import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { hashPassword } from '../auth/password'
import { signAccessToken } from '../auth/tokens'
import { publishTemplate } from '../templates/publish'
import type { TestContext } from './helpers'
import { makeRequest } from './helpers'

// Dados de teste direto no banco (rápido: sem passar pelo cadastro e o
// argon2 a cada usuário). O token sai do mesmo segredo da app de teste.

const DESIGN = join(import.meta.dir, '../../../../design')
export const template = (system: string): Record<string, unknown> =>
  JSON.parse(readFileSync(join(DESIGN, `templates/${system}.json`), 'utf8'))

let password: Promise<string> | undefined
let seq = 0

export interface TestUser {
  readonly id: string
  readonly username: string
  readonly headers: Record<string, string>
}

export async function createUser(
  ctx: TestContext,
  username = `user${++seq}`
): Promise<TestUser> {
  password ??= hashPassword('senha de teste longa o bastante')
  const { id } = await ctx.db
    .insertInto('users')
    .values({
      email: `${username}@example.test`,
      username,
      hashed_password: await password,
    })
    .returning('id')
    .executeTakeFirstOrThrow()
  // Longo: os testes adiantam o relógio em dias sem perder a sessão
  const token = await signAccessToken(
    { ...ctx.tokens, ttlSeconds: 365 * 24 * 60 * 60 },
    id
  )
  return { id, username, headers: { authorization: `Bearer ${token}` } }
}

export async function publish(ctx: TestContext, system = 'vtm-v20') {
  await publishTemplate(ctx.db, template(system))
}

export async function createChronicle(
  ctx: TestContext,
  storyteller: TestUser,
  system = 'vtm-v20',
  name = 'Crônica da Liberdade'
): Promise<string> {
  const { id } = await ctx.db
    .selectFrom('game_systems')
    .select('id')
    .where('code', '=', system)
    .executeTakeFirstOrThrow()
  const row = await ctx.db
    .insertInto('chronicles')
    .values({ storyteller_id: storyteller.id, system_id: id, name })
    .returning('id')
    .executeTakeFirstOrThrow()
  return row.id
}

export async function addMember(
  ctx: TestContext,
  chronicleId: string,
  user: TestUser
) {
  await ctx.db
    .insertInto('chronicle_members')
    .values({ chronicle_id: chronicleId, user_id: user.id })
    .execute()
}

/** Requisição autenticada como `user` (ou anônima, sem user). */
export const as = (
  ctx: TestContext,
  user: TestUser | null,
  method: string,
  path: string,
  body?: unknown
) => makeRequest(ctx.app, method, path, body, user?.headers ?? {})

/** Ficha direto no banco, já com a versão publicada do template. */
export async function createCharacter(
  ctx: TestContext,
  owner: TestUser,
  chronicleId: string,
  values: Record<string, unknown> = { name: 'Helena Varga' },
  specialties: Record<string, string> = {}
): Promise<string> {
  const chronicle = await ctx.db
    .selectFrom('chronicles')
    .select('system_id')
    .where('id', '=', chronicleId)
    .executeTakeFirstOrThrow()
  const template = await ctx.db
    .selectFrom('trait_templates')
    .select('version')
    .where('system_id', '=', chronicle.system_id)
    .orderBy('published_at', 'desc')
    .executeTakeFirstOrThrow()
  const row = await ctx.db
    .insertInto('characters')
    .values({
      user_id: owner.id,
      chronicle_id: chronicleId,
      system_id: chronicle.system_id,
      name: String(values.name ?? 'Sem nome'),
      sheet_data: JSON.stringify({ values, specialties }),
      template_version: template.version,
    })
    .returning('id')
    .executeTakeFirstOrThrow()
  return row.id
}

/**
 * Criação livre direto no banco, como se o narrador a liberasse: para testes
 * de política e AuthZ, em que a conta da criação por pontos não é o assunto.
 */
export async function freeCreation(ctx: TestContext, characterId: string) {
  await ctx.db
    .updateTable('characters')
    .set({ creation: JSON.stringify({ config: { mode: 'free' } }) })
    .where('id', '=', characterId)
    .execute()
}

/**
 * Estado da ficha direto no banco, sem passar pelas rotas do narrador nem
 * pelo `chronicle_audit`: para montar o cenário de um teste.
 */
export async function setStatus(
  ctx: TestContext,
  characterId: string,
  status: 'creating' | 'pending' | 'active' | 'archived' | 'dead',
  locked = false
) {
  await ctx.db
    .updateTable('characters')
    .set({
      status,
      locked_at: locked ? new Date() : null,
      // Ativa (ou já foi): passou pela conclusão, como na rota
      ...(status !== 'creating' &&
        status !== 'pending' && { activated_at: new Date() }),
    })
    .where('id', '=', characterId)
    .execute()
}
