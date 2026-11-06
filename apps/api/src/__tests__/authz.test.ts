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
// O nome do NPC oculto do cenário: nenhuma resposta a quem não narra o traz
// (lista, Mesa, auditoria, identidade)
const HIDDEN_NPC = 'NPC oculto'
// A Descrição da crônica do cenário (P14-D, D-15): chega ao narrador e aos
// membros no GET /chronicles/:id e a nenhuma resposta de quem não é membro,
// inclusive o ex-membro
const DESCRIPTION = 'marca-descricao-da-cronica-5c1e'
// U-10 (D-16): marca única na História / Prelúdio da ficha da dona. O
// narrador e a dona a recebem; nenhuma resposta a outro ator pode trazê-la
const SHARED = 'marca-compartilhada-da-historia-2c9e'

interface Scenario {
  readonly ctx: TestContext
  readonly users: Record<Exclude<Actor, 'anonymous'>, TestUser>
  readonly chronicleId: string
  readonly characterId: string
  readonly npcId: string
  /** A ficha do ex-membro, na crônica de que ele saiu. */
  readonly formerCharacterId: string
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
  await ctx.db
    .updateTable('chronicles')
    .set({ description: `Apresentação da mesa. ${DESCRIPTION}` })
    .where('id', '=', chronicleId)
    .execute()
  const characterId = await createCharacter(ctx, users.owner, chronicleId)
  // A matriz é de AuthZ, não da conta da criação
  await freeCreation(ctx, characterId)
  const npcId = await createCharacter(ctx, users.storyteller, chronicleId, {
    name: HIDDEN_NPC,
  })
  await ctx.db
    .updateTable('characters')
    .set({ kind: 'npc', visibility: 'hidden' })
    .where('id', '=', npcId)
    .execute()
  // O ex-membro: tem ficha na crônica e não tem mais o vínculo
  const formerCharacterId = await createCharacter(
    ctx,
    users.former,
    chronicleId,
    { name: 'Antiga' }
  )
  const notes = await as(
    ctx,
    users.storyteller,
    'POST',
    `/characters/${characterId}/events`,
    {
      clientBatchId: crypto.randomUUID(),
      events: [
        { path: `values.${s.notesField}`, from: null, to: SECRET },
        { path: `values.${s.sharedTextField}`, from: null, to: SHARED },
      ],
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
    formerCharacterId,
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
  if (actor !== 'storyteller') {
    expect(text).not.toContain(SECRET)
    expect(text).not.toContain(HIDDEN_NPC)
  }
  // A Descrição: o narrador e os membros a leem no detalhe da crônica; quem
  // não é membro (o ex-membro também, D-15) não a recebe em rota nenhuma
  const member =
    actor === 'storyteller' || actor === 'owner' || actor === 'player'
  const detail = row.method === 'GET' && row.route === '/chronicles/:id'
  if (member && detail) expect(text).toContain(DESCRIPTION)
  if (!member) expect(text).not.toContain(DESCRIPTION)
  if (actor !== 'storyteller' && actor !== 'owner')
    expect(text).not.toContain(SHARED)
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

    // P09-C (T-83): a Mesa diz quem alterou por último sem dizer o id de
    // ninguém além do dono de cada linha, e o NPC oculto vem só ao narrador
    it('a Mesa do narrador: lastChange é um enum, sem id de autor', async () => {
      const res = await as(
        shared.ctx,
        shared.users.storyteller,
        'GET',
        `/chronicles/${shared.chronicleId}/table`
      )
      const rows = (await res.json()) as {
        id: string
        owner: { id: string }
        lastChange: { at: string; by: string } | null
      }[]
      const sheet = rows.find(r => r.id === shared.characterId)
      // As notas do narrador foram o último lote da ficha da dona
      expect(sheet?.lastChange).toEqual({ at: expect.any(String), by: 'you' })
      expect(rows.find(r => r.id === shared.npcId)?.lastChange).toBeNull()
      for (const row of rows) {
        expect(Object.keys(row.lastChange ?? {}).sort()).toEqual(
          row.lastChange ? ['at', 'by'] : []
        )
        expect(['you', 'owner', 'other', undefined]).toContain(
          row.lastChange?.by
        )
      }
      expect(JSON.stringify(rows)).not.toContain('created_by')
    })

    // P09-D (R-15): a entrada da conta da criação (escolhas e camada) sai só
    // na Mesa, só para o narrador, e nunca para o NPC oculto
    it('a Mesa do narrador: creationInput só para ele, nunca no NPC', async () => {
      const reason = 'motivo-do-ajuste-da-matriz-p09d'
      const layer = {
        choices: {
          priorities: { attributes: ['mental', 'social', 'physical'] },
        },
        config: { freebies: 13 },
      }
      const points = await createCharacter(
        shared.ctx,
        shared.users.owner,
        shared.chronicleId,
        { name: 'Por pontos' }
      )
      await shared.ctx.db
        .updateTable('characters')
        .set({
          creation: JSON.stringify({
            ...layer,
            adjust: { reason, at: '2026-11-05T10:00:00Z' },
          }),
        })
        .where('id', '=', points)
        .execute()
      const path = `/chronicles/${shared.chronicleId}/table`
      const res = await as(shared.ctx, shared.users.storyteller, 'GET', path)
      expect(res.status).toBe(200)
      const text = await res.text()
      // O motivo do ajuste não sai nem para o narrador, pela Mesa
      expect(text).not.toContain(reason)
      const rows = JSON.parse(text) as {
        id: string
        creationInput: unknown
      }[]
      expect(rows.find(r => r.id === points)?.creationInput).toEqual(layer)
      // O NPC oculto e a ficha da criação livre não têm entrada
      expect(rows.find(r => r.id === shared.npcId)?.creationInput).toBeNull()
      expect(
        rows.find(r => r.id === shared.characterId)?.creationInput
      ).toBeNull()
      for (const actor of [
        'owner',
        'player',
        'former',
        'otherStoryteller',
        'stranger',
      ] as const) {
        const denied = await as(shared.ctx, shared.users[actor], 'GET', path)
        expect(denied.status).toBe(404)
        const body = await denied.text()
        expect(body).not.toContain('creationInput')
        expect(body).not.toContain('mental')
      }
      await shared.ctx.db
        .deleteFrom('characters')
        .where('id', '=', points)
        .execute()
    })

    // P09-D (R-15): "N fichas em criação" na lista só para o narrador; o NPC
    // (oculto ou revelado) nunca entra, e quem o lê como viewer recebe 0
    it('a lista de crônicas: creatingCount só para o narrador, sem NPC', async () => {
      const countOf = async (actor: Exclude<Actor, 'anonymous'>) => {
        const res = await as(
          shared.ctx,
          shared.users[actor],
          'GET',
          '/chronicles'
        )
        expect(res.status).toBe(200)
        const rows = (await res.json()) as {
          id: string
          creatingCount: number
        }[]
        return rows.find(r => r.id === shared.chronicleId)?.creatingCount
      }
      // As linhas da matriz que criam ficha mudam o cenário: a prova é a
      // diferença. Uma ficha nova de jogador conta; o NPC, não
      const base = await countOf('storyteller')
      expect(base).toBeGreaterThanOrEqual(1)
      const extra = await createCharacter(
        shared.ctx,
        shared.users.player,
        shared.chronicleId,
        { name: 'Mais uma' }
      )
      expect(await countOf('storyteller')).toBe((base ?? 0) + 1)
      for (const actor of ['owner', 'player', 'former'] as const)
        expect(await countOf(actor)).toBe(0)
      for (const actor of ['otherStoryteller', 'stranger'] as const)
        expect(await countOf(actor)).toBeUndefined()
      const revealed = await createCharacter(
        shared.ctx,
        shared.users.storyteller,
        shared.chronicleId,
        { name: 'NPC revelado' }
      )
      await shared.ctx.db
        .updateTable('characters')
        .set({ kind: 'npc', visibility: 'full' })
        .where('id', '=', revealed)
        .execute()
      const seen = await as(
        shared.ctx,
        shared.users.player,
        'GET',
        `/characters/${revealed}`
      )
      expect(await seen.json()).toMatchObject({ roles: ['viewer'] })
      expect(await countOf('player')).toBe(0)
      expect(await countOf('storyteller')).toBe((base ?? 0) + 1)
      await shared.ctx.db
        .deleteFrom('characters')
        .where('id', 'in', [revealed, extra])
        .execute()
    })
  })

  describe(`matriz de AuthZ: ${system}, linhas que mudam o estado`, () => {
    for (const row of MATRIX.filter(r => r.mutates))
      for (const [actor, status] of cells(row))
        it(`${row.method} ${row.route} como ${actor} → ${status}`, async () => {
          await check(await scenario(s), s, row, actor, status)
        })
  })

  // U-10 (D-16): a História / Prelúdio. O narrador e a dona leem e escrevem
  // (saída A); outro jogador, ex-membro (na ficha alheia), `viewer` de NPC
  // revelado, outro narrador e estranho não leem. O cenário é próprio: os
  // casos mudam o estado da ficha e revelam o NPC.
  describe(`U-10: a História do personagem (${system})`, () => {
    let sc: Scenario
    beforeAll(async () => {
      sc = await scenario(s)
    })
    const sheet = async (actor: Exclude<Actor, 'anonymous'>, id: string) => {
      const res = await as(sc.ctx, sc.users[actor], 'GET', `/characters/${id}`)
      return { status: res.status, text: await res.text() }
    }
    const write = (
      actor: Exclude<Actor, 'anonymous'>,
      id: string,
      from: string | null,
      to: string
    ) =>
      as(sc.ctx, sc.users[actor], 'POST', `/characters/${id}/events`, {
        clientBatchId: crypto.randomUUID(),
        events: [{ path: `values.${s.sharedTextField}`, from, to }],
      })

    it('quem lê: o narrador e a dona; mais ninguém', async () => {
      const storyteller = await sheet('storyteller', sc.characterId)
      expect(storyteller.status).toBe(200)
      expect(storyteller.text).toContain(SHARED)
      expect(storyteller.text).toContain(SECRET)

      const owner = await sheet('owner', sc.characterId)
      expect(owner.status).toBe(200)
      expect(owner.text).toContain(SHARED)
      expect(owner.text).not.toContain(SECRET)

      for (const actor of [
        'player',
        'former',
        'otherStoryteller',
        'stranger',
      ] as const) {
        const res = await sheet(actor, sc.characterId)
        expect(res.status).toBe(404)
        expect(res.text).not.toContain(SHARED)
      }
    })

    it('NPC: a História não chega ao membro, oculto ou revelado por inteiro', async () => {
      const NPC_STORY = `historia-do-npc-${system}`
      expect(
        (await write('storyteller', sc.npcId, null, NPC_STORY)).status
      ).toBe(200)
      const hidden = await sheet('player', sc.npcId)
      expect(hidden.status).toBe(404)
      expect(hidden.text).not.toContain(NPC_STORY)

      for (const [visibility, revision] of [
        ['identity', 0],
        ['full', 1],
      ] as const) {
        const res = await as(
          sc.ctx,
          sc.users.storyteller,
          'POST',
          `/characters/${sc.npcId}/visibility`,
          { clientCommandId: crypto.randomUUID(), visibility, revision }
        )
        expect(res.status).toBe(200)
      }
      const full = await as(
        sc.ctx,
        sc.users.player,
        'GET',
        `/characters/${sc.npcId}`
      )
      const body = (await full.json()) as {
        roles: string[]
        sheet: { values: Record<string, unknown> }
      }
      expect(full.status).toBe(200)
      expect(body.roles).toEqual(['viewer'])
      expect(Object.hasOwn(body.sheet.values, s.sharedTextField)).toBe(false)
      expect(JSON.stringify(body)).not.toContain(NPC_STORY)
      // O narrador continua lendo
      expect((await sheet('storyteller', sc.npcId)).text).toContain(NPC_STORY)
      // O `viewer` nunca escreve
      expect(
        (await write('player', sc.npcId, NPC_STORY, 'do-membro')).status
      ).toBe(404)
    })

    it('quem escreve: a dona conforme o estado, o narrador sempre', async () => {
      let current: string = SHARED
      const step = async (
        actor: 'owner' | 'storyteller',
        expected: number,
        code?: Record<string, string>
      ) => {
        const to = `${actor}-${crypto.randomUUID()}`
        const res = await write(actor, sc.characterId, current, to)
        expect(res.status).toBe(expected)
        if (code) expect(await res.json()).toMatchObject(code)
        if (expected === 200) current = to
      }
      await setStatus(sc.ctx, sc.characterId, 'creating')
      await step('owner', 200)
      await setStatus(sc.ctx, sc.characterId, 'pending')
      await step('owner', 403, { reason: 'pending' })
      await step('storyteller', 200)
      await setStatus(sc.ctx, sc.characterId, 'active')
      await step('owner', 200)
      await setStatus(sc.ctx, sc.characterId, 'active', true)
      await step('owner', 403, { code: 'SHEET_LOCKED' })
      await step('storyteller', 200)
      await setStatus(sc.ctx, sc.characterId, 'active')
      // Outro jogador e estranho: 404, e nada muda
      for (const actor of ['player', 'otherStoryteller', 'stranger'] as const)
        expect((await write(actor, sc.characterId, current, 'x')).status).toBe(
          404
        )
      expect((await sheet('owner', sc.characterId)).text).toContain(current)
    })

    it('o ex-membro lê a História da própria ficha e não a escreve', async () => {
      const OLD_STORY = `historia-antiga-${system}`
      expect(
        (await write('storyteller', sc.formerCharacterId, null, OLD_STORY))
          .status
      ).toBe(200)
      const own = await sheet('former', sc.formerCharacterId)
      expect(own.status).toBe(200)
      expect(own.text).toContain(OLD_STORY)
      const res = await write('former', sc.formerCharacterId, OLD_STORY, 'x')
      expect(res.status).toBe(403)
      expect(await res.json()).toMatchObject({ code: 'NOT_MEMBER' })
    })

    it('o Histórico da dona: o lote do narrador na História, sem o texto', async () => {
      const res = await as(
        sc.ctx,
        sc.users.owner,
        'GET',
        `/characters/${sc.characterId}/history`
      )
      expect(res.status).toBe(200)
      const text = await res.text()
      const { items } = JSON.parse(text) as {
        items: { byRole: string; changes: { label: string }[] }[]
      }
      const label = 'História / Prelúdio'
      expect(
        items.some(
          i =>
            i.byRole === 'storyteller' && i.changes.some(c => c.label === label)
        )
      ).toBe(true)
      expect(text).not.toContain(SHARED)
      expect(text).not.toContain(SECRET)
      expect(text).not.toContain('Notas do Narrador')
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
