/// <reference types="bun-types" />
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import {
  type Actor,
  MATRIX,
  type MatrixRow,
  NOT_IN_MATRIX,
} from '../test/authz-matrix'
import {
  addMember,
  as,
  createCharacter,
  createChronicle,
  createUser,
  publish,
  setStatus,
  type TestUser,
} from '../test/factories'
import {
  createTestContext,
  destroyTestDb,
  type TestContext,
} from '../test/helpers'
import {
  MATRIX_SYSTEMS,
  type SystemCase,
  systemCase,
} from '../test/matrix-systems'

// Matriz de AuthZ: cada rota protegida contra cada ator (doc/plano-v0.md §4),
// nos três sistemas do produto (doc/plano-v3.md, Etapa 3). O cenário é
// montado uma vez por sistema; a linha que muda o estado (excluir, gravar)
// monta o dela, por ator.

// Marca única nas Notas do Narrador: nenhuma resposta a quem não é narrador
// pode trazê-la, nem o 200 da dona nem o 404 do outro jogador.
const SECRET = 'marca-secreta-do-narrador-7f3a'

interface Scenario {
  readonly ctx: TestContext
  readonly users: Record<Exclude<Actor, 'anonymous'>, TestUser>
  readonly chronicleId: string
  readonly characterId: string
  readonly inviteId: string
  readonly requestId: string
}

async function scenario(s: SystemCase): Promise<Scenario> {
  await destroyTestDb()
  const ctx = await createTestContext()
  await publish(ctx, s.system)
  const users = {} as Scenario['users']
  for (const actor of [
    'storyteller',
    'owner',
    'player',
    'former',
    'otherStoryteller',
    'stranger',
  ] as const)
    users[actor] = await createUser(ctx, actor.toLowerCase())
  const chronicleId = await createChronicle(ctx, users.storyteller, s.system)
  await addMember(ctx, chronicleId, users.owner)
  await addMember(ctx, chronicleId, users.player)
  await createChronicle(ctx, users.otherStoryteller, s.system, 'Outra')
  const characterId = await createCharacter(ctx, users.owner, chronicleId)
  // O ex-membro: tem ficha na crônica e não tem mais o vínculo
  await createCharacter(ctx, users.former, chronicleId, { name: 'Antiga' })
  const notes = await as(
    ctx,
    users.storyteller,
    'POST',
    `/characters/${characterId}/events`,
    {
      clientBatchId: crypto.randomUUID(),
      events: [{ path: `values.${s.notesField}`, from: null, to: SECRET }],
    }
  )
  expect(notes.status).toBe(200)
  const invite = (await (
    await as(
      ctx,
      users.storyteller,
      'POST',
      `/chronicles/${chronicleId}/invites`
    )
  ).json()) as { id: string }
  // Um pedido de XP pendente da dona (direto no banco: o WoD não tem preço)
  const request = await ctx.db
    .insertInto('xp_requests')
    .values({
      character_id: characterId,
      client_request_id: crypto.randomUUID(),
      target_field: s.ratingField,
      target_key: s.ratingField,
      from_value: 1,
      to_value: 2,
      cost: 4,
      requested_by: users.owner.id,
    })
    .returning('id')
    .executeTakeFirstOrThrow()
  return {
    ctx,
    users,
    chronicleId,
    characterId,
    inviteId: invite.id,
    requestId: request.id,
  }
}

async function request(
  sc: Scenario,
  s: SystemCase,
  row: MatrixRow,
  actor: Actor
) {
  const id = row.route.startsWith('/characters')
    ? sc.characterId
    : sc.chronicleId
  const path = row.route
    .replace(':id', id)
    .replace(':inviteId', sc.inviteId)
    .replace(':requestId', sc.requestId)
    // Remover: o outro jogador
    .replace(':userId', sc.users.player.id)
  const user = actor === 'anonymous' ? null : sc.users[actor]
  return as(
    sc.ctx,
    user,
    row.method,
    path,
    row.body?.(s, { characterId: sc.characterId })
  )
}

async function check(
  sc: Scenario,
  s: SystemCase,
  row: MatrixRow,
  actor: Actor,
  status: number
) {
  if (row.sheet)
    await setStatus(
      sc.ctx,
      sc.characterId,
      row.sheet.status,
      row.sheet.locked ?? false
    )
  const res = await request(sc, s, row, actor)
  expect(res.status).toBe(status)
  const text = await res.text()
  if (actor !== 'storyteller') expect(text).not.toContain(SECRET)
  // O ex-membro não recebe os membros nem a ficha de ninguém além das dele
  if (actor === 'former')
    for (const other of [sc.users.owner.id, sc.users.player.id, sc.characterId])
      expect(text).not.toContain(other)
}

afterAll(async () => {
  await destroyTestDb()
})

const cells = (row: MatrixRow) =>
  Object.entries(row.expect) as [Actor, number][]

for (const system of MATRIX_SYSTEMS) {
  const s = systemCase(system)

  describe(`matriz de AuthZ: ${system}`, () => {
    let shared: Scenario
    beforeAll(async () => {
      shared = await scenario(s)
    })

    for (const row of MATRIX.filter(r => !r.mutates))
      for (const [actor, status] of cells(row))
        it(`${row.method} ${row.route} como ${actor} → ${status}`, async () => {
          await check(shared, s, row, actor, status)
        })

    it('a dona gravando a seção do narrador: 403, e nada muda', async () => {
      const res = await as(
        shared.ctx,
        shared.users.owner,
        'POST',
        `/characters/${shared.characterId}/events`,
        {
          clientBatchId: crypto.randomUUID(),
          events: [{ path: `values.${s.notesField}`, from: SECRET, to: 'x' }],
        }
      )
      expect(res.status).toBe(403)
      expect(await res.text()).not.toContain(SECRET)
    })
  })

  describe(`matriz de AuthZ: ${system}, linhas que mudam o estado`, () => {
    for (const row of MATRIX.filter(r => r.mutates))
      for (const [actor, status] of cells(row))
        it(`${row.method} ${row.route} como ${actor} → ${status}`, async () => {
          await check(await scenario(s), s, row, actor, status)
        })
  })
}

describe('cobertura da matriz', () => {
  let ctx: TestContext
  let owner: TestUser
  let storyteller: TestUser
  beforeAll(async () => {
    await destroyTestDb()
    ctx = await createTestContext()
    owner = await createUser(ctx, 'dona')
    storyteller = await createUser(ctx, 'narradora')
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
    const res = await as(ctx, storyteller, 'GET', '/chronicles/1 or 1=1')
    expect(res.status).toBe(400)
    const character = await as(ctx, owner, 'GET', "/characters/x';--")
    expect(character.status).toBe(400)
  })

  it('cada sistema da matriz tem o que ela precisa no template', () => {
    for (const system of MATRIX_SYSTEMS)
      expect(() => systemCase(system)).not.toThrow()
  })
})
