/// <reference types="bun-types" />
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { type Actor, MATRIX, NOT_IN_MATRIX } from '../test/authz-matrix'
import {
  addMember,
  as,
  createCharacter,
  createChronicle,
  createUser,
  publish,
  type TestUser,
} from '../test/factories'
import {
  createTestContext,
  destroyTestDb,
  type TestContext,
} from '../test/helpers'

// Matriz de AuthZ: cada rota protegida contra cada ator (doc/plano-v0.md §4).
// Um cenário por linha e ator, porque algumas ações mudam o estado (excluir).

let ctx: TestContext
const users = {} as Record<Exclude<Actor, 'anonymous'>, TestUser>
let chronicleId: string

async function scenario() {
  await destroyTestDb()
  ctx = await createTestContext()
  await publish(ctx, 'vtm-v20')
  for (const actor of [
    'storyteller',
    'owner',
    'player',
    'otherStoryteller',
    'stranger',
  ] as const)
    users[actor] = await createUser(ctx, actor.toLowerCase())
  chronicleId = await createChronicle(ctx, users.storyteller)
  await addMember(ctx, chronicleId, users.owner)
  await addMember(ctx, chronicleId, users.player)
  await createChronicle(ctx, users.otherStoryteller, 'vtm-v20', 'Outra')
  const characterId = await createCharacter(ctx, users.owner, chronicleId)
  const invite = await (
    await as(
      ctx,
      users.storyteller,
      'POST',
      `/chronicles/${chronicleId}/invites`
    )
  ).json()
  return { characterId, inviteId: (invite as { id: string }).id }
}

afterAll(async () => {
  await destroyTestDb()
})

describe('matriz de AuthZ', () => {
  for (const row of MATRIX)
    for (const [actor, status] of Object.entries(row.expect) as [
      Actor,
      number,
    ][])
      it(`${row.method} ${row.route} como ${actor} → ${status}`, async () => {
        const { characterId, inviteId } = await scenario()
        const id = row.route.startsWith('/characters')
          ? characterId
          : chronicleId
        const path = row.route.replace(':id', id).replace(':inviteId', inviteId)
        const user = actor === 'anonymous' ? null : users[actor]
        const res = await as(ctx, user, row.method, path, row.body)
        expect(res.status).toBe(status)
      })
})

describe('cobertura da matriz', () => {
  beforeAll(async () => {
    await scenario()
  })

  it('toda rota protegida tem linha na matriz ou está na lista de exceções', () => {
    const inMatrix = new Set(MATRIX.map(r => `${r.method} ${r.route}`))
    const missing = ctx.app.routes
      .filter(r => r.method !== 'OPTIONS' && !r.path.startsWith('/swagger'))
      .map(r => `${r.method} ${r.path}`)
      .filter(k => !inMatrix.has(k) && !NOT_IN_MATRIX.has(k))
    expect(missing).toEqual([])
  })

  it('nenhuma linha da matriz aponta para rota que não existe', () => {
    const routes = new Set(ctx.app.routes.map(r => `${r.method} ${r.path}`))
    for (const r of MATRIX)
      expect(routes.has(`${r.method} ${r.route}`)).toBe(true)
    for (const k of NOT_IN_MATRIX) expect(routes.has(k)).toBe(true)
  })

  it('id malformado é recusado antes do banco', async () => {
    const res = await as(ctx, users.storyteller, 'GET', '/chronicles/1 or 1=1')
    expect(res.status).toBe(400)
    const character = await as(ctx, users.owner, 'GET', "/characters/x';--")
    expect(character.status).toBe(400)
  })
})
