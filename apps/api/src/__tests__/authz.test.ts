/// <reference types="bun-types" />
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import type { DB } from '@tms/db'
import { createPGliteTestDb } from '@tms/db/testing'
import type { Kysely } from 'kysely'
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
  freeCreation,
  publish,
  setStatus,
  type TestUser,
} from '../test/factories'
import {
  createTestContext,
  createTestContextOn,
  destroyTestDb,
  type TestContext,
  useTestDb,
} from '../test/helpers'
import {
  MATRIX_SYSTEMS,
  type SystemCase,
  systemCase,
} from '../test/matrix-systems'

// Um PGLite para o arquivo, restaurado a cada createTestContext
useTestDb()

// Matriz de AuthZ: cada rota protegida contra cada ator (doc/plano-v0.md §4),
// nos três sistemas do produto (doc/plano-v3.md, Etapa 3). O cenário é
// montado uma vez por sistema; a linha que muda o estado (excluir, gravar)
// monta o dela, por ator.
//
// Todos os cenários dividem um PGLite: cada um tem usuários, crônicas e fichas
// próprios, e app e relógio novos (rate limit zerado). Um PGLite por cenário
// passava de 1.000 instâncias e ~2 GB de memória. Dividir o banco também
// endurece a matriz: o segredo de um cenário não pode aparecer em outro.

// Marca única nas Notas do Narrador: nenhuma resposta a quem não é narrador
// pode trazê-la, nem o 200 da dona nem o 404 do outro jogador.
const SECRET = 'marca-secreta-do-narrador-7f3a'

interface Scenario {
  readonly ctx: TestContext
  readonly users: Record<Exclude<Actor, 'anonymous'>, TestUser>
  readonly chronicleId: string
  readonly characterId: string
  readonly npcId: string
  readonly inviteId: string
  readonly requestId: string
  readonly sessionId: string
  readonly transferId: string
}

let matrixDb: { db: Kysely<DB>; destroy: () => Promise<void> } | null = null
const published = new Set<string>()
let scenarios = 0

async function scenario(s: SystemCase): Promise<Scenario> {
  matrixDb ??= await createPGliteTestDb()
  const ctx = createTestContextOn(matrixDb.db)
  if (!published.has(s.system)) {
    await publish(ctx, s.system)
    published.add(s.system)
  }
  const n = ++scenarios
  const users = {} as Scenario['users']
  for (const actor of [
    'storyteller',
    'owner',
    'player',
    'former',
    'otherStoryteller',
    'stranger',
  ] as const)
    users[actor] = await createUser(ctx, `${actor.toLowerCase()}${n}`)
  const chronicleId = await createChronicle(ctx, users.storyteller, s.system)
  await addMember(ctx, chronicleId, users.owner)
  await addMember(ctx, chronicleId, users.player)
  await createChronicle(ctx, users.otherStoryteller, s.system, 'Outra')
  const characterId = await createCharacter(ctx, users.owner, chronicleId)
  // A matriz é de AuthZ, não da conta da criação
  await freeCreation(ctx, characterId)
  const npcId = await createCharacter(ctx, users.storyteller, chronicleId, {
    name: 'NPC oculto',
  })
  await ctx.db
    .updateTable('characters')
    .set({ kind: 'npc', visibility: 'hidden' })
    .where('id', '=', npcId)
    .execute()
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
  const session = await ctx.db
    .insertInto('chronicle_sessions')
    .values({
      chronicle_id: chronicleId,
      session_date: '2026-10-23',
      title: 'Sessão da matriz',
      public_summary: 'Resumo público',
      private_notes: 'nota-privada-da-matriz',
      created_by: users.storyteller.id,
    })
    .returning('id')
    .executeTakeFirstOrThrow()
  const transfer = await ctx.db
    .insertInto('chronicle_transfers')
    .values({
      chronicle_id: chronicleId,
      requested_by: users.storyteller.id,
      recipient_id: users.player.id,
      client_command_id: crypto.randomUUID(),
      request_hash: 'matrix',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    })
    .returning('id')
    .executeTakeFirstOrThrow()
  return {
    ctx,
    users,
    chronicleId,
    characterId,
    npcId,
    inviteId: invite.id,
    requestId: request.id,
    sessionId: session.id,
    transferId: transfer.id,
  }
}

async function request(
  sc: Scenario,
  s: SystemCase,
  row: MatrixRow,
  actor: Actor
) {
  const id = row.route.startsWith('/characters')
    ? row.target === 'npc'
      ? sc.npcId
      : sc.characterId
    : sc.chronicleId
  const path = row.route
    .replace(':id', id)
    .replace(':inviteId', sc.inviteId)
    .replace(':requestId', sc.requestId)
    .replace(':sessionId', sc.sessionId)
    .replace(':transferId', sc.transferId)
    // Remover: o outro jogador
    .replace(':userId', sc.users.player.id)
  const user = actor === 'anonymous' ? null : sc.users[actor]
  return as(
    sc.ctx,
    user,
    row.method,
    path,
    row.body?.(s, {
      characterId: sc.characterId,
      playerId: sc.users.player.id,
    })
  )
}

async function check(
  sc: Scenario,
  s: SystemCase,
  row: MatrixRow,
  actor: Actor,
  status: number
) {
  if (row.method === 'POST' && row.route === '/chronicles/:id/transfer')
    await sc.ctx.db
      .deleteFrom('chronicle_transfers')
      .where('id', '=', sc.transferId)
      .execute()
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
  await matrixDb?.destroy()
  matrixDb = null
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
