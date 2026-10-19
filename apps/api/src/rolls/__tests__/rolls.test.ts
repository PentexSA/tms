/// <reference types="bun-types" />
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import type { RandomSource } from '@tms/sheet-core'
import { createRateLimiter } from '../../http/rate-limit'
import { defaultLimits, resolveOptions } from '../../options'
import {
  addMember,
  as,
  createCharacter,
  createChronicle,
  createUser,
  publish,
  type TestUser,
} from '../../test/factories'
import {
  createTestContext,
  destroyTestDb,
  type TestContext,
} from '../../test/helpers'

// Rolagem no servidor (doc/plano-v0.md, Etapa 21): a parada sai da ficha
// gravada, o dado é do servidor e o custo entra no histórico uma vez só.

let ctx: TestContext
let storyteller: TestUser
let owner: TestUser
let player: TestUser
let chronicleId: string
let characterId: string
let queue: number[]

/** O RNG do servidor nos testes: faces de d10 em ordem. */
const rng: RandomSource = {
  nextUint32() {
    const face = queue.shift()
    if (face === undefined) throw new Error('RNG do teste sem faces')
    return face - 1
  },
}

const helena = {
  name: 'Helena Varga',
  clan: 'tremere',
  backgrounds: [{ id: 'b1', name: 'Geração', value: 5 }],
  dexterity: 3,
  athletics: 2,
  willpower: { current: 5, permanent: 7 },
  health: { aggravated: 0, lethal: 0, bashing: 0 },
  disciplines: [{ id: 'd1', name: 'Taumaturgia', value: 3 }],
}

async function setup(extra: Parameters<typeof createTestContext>[0] = {}) {
  await destroyTestDb()
  ctx = await createTestContext({ random: rng, ...extra })
  await publish(ctx, 'vtm-v20')
  storyteller = await createUser(ctx, 'narradora')
  owner = await createUser(ctx, 'dona')
  player = await createUser(ctx, 'outro')
  chronicleId = await createChronicle(ctx, storyteller)
  await addMember(ctx, chronicleId, owner)
  await addMember(ctx, chronicleId, player)
  characterId = await createCharacter(ctx, owner, chronicleId, helena)
}

beforeEach(async () => {
  queue = []
  await setup()
})
afterEach(async () => {
  await destroyTestDb()
})

interface RollResponse {
  duplicate: boolean
  sheetVersion: number
  sheet: { values: Record<string, unknown> }
  roll: {
    id: string
    label: string
    manual: boolean
    byRole: string
    by: { username: string }
    dice: number
    difficulty: number
    faces: number[]
    total: number
    outcome: string
    text: string
    auto: number
    specialty: boolean
    modifiers: { label: string; change: string }[]
  }
}

const dexAthletics = {
  slots: { attribute: 'dexterity', ability: 'athletics' },
  difficulty: 6,
}
const roll = (user: TestUser, body: Record<string, unknown>) =>
  as(ctx, user, 'POST', `/characters/${characterId}/rolls`, {
    clientRollId: crypto.randomUUID(),
    ...body,
  })

const sheetRow = () =>
  ctx.db
    .selectFrom('characters')
    .select(['sheet_data', 'sheet_version'])
    .where('id', '=', characterId)
    .executeTakeFirstOrThrow()

describe('POST /characters/:id/rolls', () => {
  it('Destreza + Esportes: o servidor monta a parada e rola', async () => {
    queue = [10, 6, 3, 1, 8]
    const res = await roll(owner, dexAthletics)
    expect(res.status).toBe(201)
    const body = (await res.json()) as RollResponse
    expect(body.duplicate).toBe(false)
    expect(body.roll).toMatchObject({
      label: 'Destreza + Esportes',
      manual: false,
      byRole: 'owner',
      by: { username: 'dona' },
      dice: 5,
      difficulty: 6,
      faces: [10, 6, 3, 1, 8],
      total: 2,
      outcome: 'success',
      text: '2 sucessos',
    })
    // Sem custo: a ficha não muda
    expect(body.sheetVersion).toBe(0)
    expect(queue).toEqual([])
    const rows = await ctx.db
      .selectFrom('character_rolls')
      .selectAll()
      .execute()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      batch_id: null,
      manual: false,
      by_role: 'owner',
    })
    expect(
      await ctx.db.selectFrom('character_batches').selectAll().execute()
    ).toEqual([])
  })

  it('resultado mandado pelo cliente é ignorado: o servidor rola de novo', async () => {
    queue = [2, 3, 4, 5, 2]
    const res = await roll(owner, {
      ...dexAthletics,
      faces: [10, 10, 10, 10, 10],
      total: 9,
      outcome: 'success',
      result: { total: 9 },
    })
    expect(res.status).toBe(201)
    const body = (await res.json()) as RollResponse
    expect(body.roll.faces).toEqual([2, 3, 4, 5, 2])
    expect(body.roll.total).toBe(0)
    expect(body.roll.outcome).toBe('failure')
    const row = await ctx.db
      .selectFrom('character_rolls')
      .select(['request', 'result'])
      .executeTakeFirstOrThrow()
    expect(JSON.stringify(row.request)).not.toContain('faces')
    expect((row.result as { total: number }).total).toBe(0)
  })

  it('FdV: +1 automático, debitada na mesma transação, com histórico', async () => {
    queue = [1, 1, 2, 3, 4]
    const res = await roll(owner, { ...dexAthletics, boosts: ['willpower'] })
    expect(res.status).toBe(201)
    const body = (await res.json()) as RollResponse
    expect(body.roll).toMatchObject({ total: 1, auto: 1, outcome: 'success' })
    expect(body.sheetVersion).toBe(1)
    expect(body.sheet.values.willpower).toEqual({ current: 4, permanent: 7 })
    const row = await sheetRow()
    expect(row.sheet_version).toBe(1)
    expect(
      (row.sheet_data as { values: { willpower: unknown } }).values.willpower
    ).toEqual({
      current: 4,
      permanent: 7,
    })
    const rolls = await ctx.db
      .selectFrom('character_rolls')
      .select('batch_id')
      .execute()
    const batches = await ctx.db
      .selectFrom('character_batches')
      .selectAll()
      .execute()
    expect(batches).toHaveLength(1)
    expect(rolls[0]?.batch_id).toBe(batches[0]?.id as string)
    const history = (await (
      await as(ctx, player, 'GET', `/characters/${characterId}/history`)
    ).json()) as { items: { byRole: string; changes: { label: string }[] }[] }
    expect(history.items[0]).toMatchObject({
      byRole: 'owner',
      changes: [{ label: 'FdV', change: '5 → 4' }],
    })
  })

  it('FdV ainda no padrão: o histórico mostra o efetivo (1 → 0)', async () => {
    queue = [7, 7, 7]
    const fresh = await createCharacter(ctx, owner, chronicleId, {
      name: 'Nova',
    })
    const res = await as(ctx, owner, 'POST', `/characters/${fresh}/rolls`, {
      clientRollId: crypto.randomUUID(),
      ...dexAthletics,
      boosts: ['willpower'],
    })
    expect(res.status).toBe(201)
    const history = (await (
      await as(ctx, owner, 'GET', `/characters/${fresh}/history`)
    ).json()) as { items: { changes: { label: string; change: string }[] }[] }
    expect(history.items[0]?.changes).toEqual([
      { label: 'FdV', change: '1 → 0' },
    ])
  })

  it('o mesmo clientRollId reenviado não rola nem cobra de novo', async () => {
    queue = [7, 7, 7, 7, 7]
    const body = {
      clientRollId: crypto.randomUUID(),
      ...dexAthletics,
      boosts: ['willpower'],
    }
    const path = `/characters/${characterId}/rolls`
    const first = (await (
      await as(ctx, owner, 'POST', path, body)
    ).json()) as RollResponse
    const again = await as(ctx, owner, 'POST', path, body)
    expect(again.status).toBe(200)
    const second = (await again.json()) as RollResponse
    expect(second).toMatchObject({ duplicate: true, sheetVersion: 1 })
    expect(second.roll.id).toBe(first.roll.id)
    expect(second.roll.faces).toEqual(first.roll.faces)
    expect((await sheetRow()).sheet_version).toBe(1)
    expect(
      await ctx.db.selectFrom('character_batches').selectAll().execute()
    ).toHaveLength(1)
    expect(
      await ctx.db.selectFrom('character_rolls').selectAll().execute()
    ).toHaveLength(1)
  })

  it('"Rolei na mão": o total informado, marcado como manual', async () => {
    const res = await roll(owner, {
      ...dexAthletics,
      boosts: ['willpower'],
      manual: { successes: 2 },
    })
    expect(res.status).toBe(201)
    const body = (await res.json()) as RollResponse
    expect(body.roll).toMatchObject({
      manual: true,
      faces: [],
      total: 3,
      auto: 1,
    })
    // O RNG do servidor não foi chamado
    expect(queue).toEqual([])
    expect((await sheetRow()).sheet_version).toBe(1)
  })

  it('a especialização entra quando o traço tem uma', async () => {
    await createCharacter(ctx, owner, chronicleId, helena)
    const withSpec = await createCharacter(ctx, owner, chronicleId, helena, {
      dexterity: 'Reflexos',
    })
    queue = [10, 10, 2, 2, 2]
    const res = await as(ctx, owner, 'POST', `/characters/${withSpec}/rolls`, {
      clientRollId: crypto.randomUUID(),
      ...dexAthletics,
      specialty: true,
    })
    const body = (await res.json()) as RollResponse
    expect(body.roll).toMatchObject({ specialty: true, total: 4 })
  })

  it('o narrador rola a ficha do jogador, assinado como narrador', async () => {
    queue = [6, 6, 6, 6, 6]
    const body = (await (
      await roll(storyteller, dexAthletics)
    ).json()) as RollResponse
    expect(body.roll.byRole).toBe('storyteller')
  })

  it.each([
    [
      'slot desconhecido',
      { slots: { attribute: 'dexterity', poder: 'x' }, difficulty: 6 },
      'invalid',
    ],
    [
      'opção de outro slot',
      { slots: { attribute: 'athletics' }, difficulty: 6 },
      'invalid',
    ],
    [
      'sem o slot obrigatório',
      { slots: { ability: 'athletics' }, difficulty: 6 },
      'incomplete',
    ],
    [
      'dificuldade acima do template',
      { ...dexAthletics, difficulty: 11 },
      'invalid',
    ],
    ['boost desconhecido', { ...dexAthletics, boosts: ['sangue'] }, 'invalid'],
  ])('%s: 422', async (_, body, kind) => {
    const res = await roll(owner, body)
    expect(res.status).toBe(422)
    expect(await res.json()).toMatchObject({ kind })
    expect(
      await ctx.db.selectFrom('character_rolls').selectAll().execute()
    ).toEqual([])
  })

  it('incapacitado não rola; FdV zerada não paga o boost', async () => {
    const out = await createCharacter(ctx, owner, chronicleId, {
      ...helena,
      health: { aggravated: 0, lethal: 7, bashing: 0 },
      willpower: { current: 0, permanent: 7 },
    })
    const post = (body: Record<string, unknown>) =>
      as(ctx, owner, 'POST', `/characters/${out}/rolls`, {
        clientRollId: crypto.randomUUID(),
        ...body,
      })
    const incapacitated = await post(dexAthletics)
    expect(incapacitated.status).toBe(422)
    expect(await incapacitated.json()).toMatchObject({ kind: 'incapacitated' })

    const tired = await createCharacter(ctx, owner, chronicleId, {
      ...helena,
      willpower: { current: 0, permanent: 7 },
    })
    const cost = await as(ctx, owner, 'POST', `/characters/${tired}/rolls`, {
      clientRollId: crypto.randomUUID(),
      ...dexAthletics,
      boosts: ['willpower'],
    })
    expect(cost.status).toBe(422)
    expect(await cost.json()).toMatchObject({ kind: 'cost' })
  })

  it('manual com crítica e sucesso ao mesmo tempo: 422', async () => {
    const res = await roll(owner, {
      ...dexAthletics,
      manual: { successes: 2, botch: true },
    })
    expect(res.status).toBe(422)
  })

  it.each([
    ['clientRollId não é UUID', { clientRollId: 'abc', ...dexAthletics }],
    [
      'dificuldade fracionária',
      { clientRollId: crypto.randomUUID(), ...dexAthletics, difficulty: 6.5 },
    ],
    [
      'manual negativo',
      {
        clientRollId: crypto.randomUUID(),
        ...dexAthletics,
        manual: { successes: -1 },
      },
    ],
    [
      'boosts demais',
      {
        clientRollId: crypto.randomUUID(),
        ...dexAthletics,
        boosts: ['a', 'b', 'c', 'd', 'e'],
      },
    ],
  ])('%s: 400', async (_, body) => {
    const res = await as(
      ctx,
      owner,
      'POST',
      `/characters/${characterId}/rolls`,
      body
    )
    expect(res.status).toBe(400)
  })

  it('o outro jogador da crônica não rola a ficha (403); sem vínculo, 404', async () => {
    expect((await roll(player, dexAthletics)).status).toBe(403)
    const stranger = await createUser(ctx, 'estranho')
    expect((await roll(stranger, dexAthletics)).status).toBe(404)
  })

  it('ficha excluída: 404', async () => {
    await as(ctx, owner, 'DELETE', `/characters/${characterId}`)
    expect((await roll(owner, dexAthletics)).status).toBe(404)
  })

  it('sistema sem parada de dados: 422 unsupported', async () => {
    await publish(ctx, 'dnd5e-2014')
    const dnd = await createChronicle(
      ctx,
      storyteller,
      'dnd5e-2014',
      'Mesa D&D'
    )
    await addMember(ctx, dnd, owner)
    const lia = await createCharacter(ctx, owner, dnd, { name: 'Lia' })
    const res = await as(ctx, owner, 'POST', `/characters/${lia}/rolls`, {
      clientRollId: crypto.randomUUID(),
      slots: { check: 'strength' },
      difficulty: 10,
    })
    expect(res.status).toBe(422)
    expect(await res.json()).toMatchObject({ kind: 'unsupported' })
  })

  it('rate limit por usuário e por ficha', async () => {
    await setup({
      random: rng,
      limits: {
        ...defaultLimits(() => new Date()),
        rolls: createRateLimiter({ limit: 1, windowMs: 60_000 }),
      },
    })
    queue = [6, 6, 6, 6, 6]
    expect((await roll(owner, dexAthletics)).status).toBe(201)
    const res = await roll(owner, dexAthletics)
    expect(res.status).toBe(429)
    expect(res.headers.get('retry-after')).toMatch(/^\d+$/)
  })

  it('a fonte padrão do servidor é o CSPRNG da plataforma', () => {
    const { random } = resolveOptions()
    const values = Array.from({ length: 8 }, () => random.nextUint32())
    expect(
      values.every(v => Number.isInteger(v) && v >= 0 && v < 2 ** 32)
    ).toBe(true)
    expect(new Set(values).size).toBeGreaterThan(1)
  })
})

describe('GET /characters/:id/rolls', () => {
  it('as rolagens da ficha, da mais nova para a mais antiga, para quem lê', async () => {
    queue = [6, 6, 6, 6, 6]
    await roll(owner, dexAthletics)
    ctx.clock.advance(1000)
    await roll(storyteller, {
      ...dexAthletics,
      manual: { successes: 0, botch: true },
    })
    const res = await as(
      ctx,
      player,
      'GET',
      `/characters/${characterId}/rolls?limit=10`
    )
    expect(res.status).toBe(200)
    const { items } = (await res.json()) as { items: RollResponse['roll'][] }
    expect(items.map(i => [i.byRole, i.manual, i.outcome])).toEqual([
      ['storyteller', true, 'botch'],
      ['owner', false, 'success'],
    ])
  })

  it('limite fora do intervalo: 400', async () => {
    const res = await as(
      ctx,
      owner,
      'GET',
      `/characters/${characterId}/rolls?limit=99`
    )
    expect(res.status).toBe(400)
  })
})
