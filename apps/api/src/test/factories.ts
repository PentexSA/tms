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
