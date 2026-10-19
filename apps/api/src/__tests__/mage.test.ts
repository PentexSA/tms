/// <reference types="bun-types" />
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import {
  addMember,
  as,
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

// v1, Etapa 7: o Mago (M20) ao lado do Vampiro, pelas mesmas rotas. Nenhuma
// rota tem nome de sistema: criação, lote, histórico e mesa vêm do template.

let ctx: TestContext
let storyteller: TestUser
let owner: TestUser
let player: TestUser
let mage: string
let vampire: string

beforeEach(async () => {
  await destroyTestDb()
  ctx = await createTestContext()
  await publish(ctx, 'vtm-v20')
  await publish(ctx, 'mta-m20')
  storyteller = await createUser(ctx, 'narradora')
  owner = await createUser(ctx, 'dona')
  player = await createUser(ctx, 'outro')
  mage = await createChronicle(ctx, storyteller, 'mta-m20', 'A Torre')
  vampire = await createChronicle(ctx, storyteller, 'vtm-v20', 'Noites')
  for (const c of [mage, vampire]) {
    await addMember(ctx, c, owner)
    await addMember(ctx, c, player)
  }
})
afterEach(async () => {
  await destroyTestDb()
})

const create = (values: Record<string, unknown>, chronicle = mage) =>
  as(ctx, owner, 'POST', `/chronicles/${chronicle}/characters`, { values })

async function otto(): Promise<string> {
  const res = await create({
    name: 'Otto Brandt',
    tradition: 'filhos-do-eter',
    essence: 'questionadora',
    house: 'Engenheiros Etéricos',
  })
  expect(res.status).toBe(201)
  return ((await res.json()) as { id: string }).id
}

const send = (user: TestUser, id: string, events: unknown[]) =>
  as(ctx, user, 'POST', `/characters/${id}/events`, {
    clientBatchId: crypto.randomUUID(),
    events,
  })

describe('GET /systems', () => {
  it('os dois sistemas publicados', async () => {
    const res = await as(ctx, owner, 'GET', '/systems')
    const systems = (await res.json()) as { code: string }[]
    expect(systems.map(s => s.code).sort()).toEqual(['mta-m20', 'vtm-v20'])
  })
})

describe('ficha de Mago', () => {
  it('nasce só com a identidade, no template do Mago', async () => {
    const id = await otto()
    const res = await as(ctx, owner, 'GET', `/characters/${id}`)
    const body = (await res.json()) as {
      systemCode: string
      templateVersion: string
      sheet: { values: Record<string, unknown> }
    }
    expect(body.systemCode).toBe('mta-m20')
    expect(body.templateVersion).toBe('1.1.0')
    expect(body.sheet.values).toEqual({
      name: 'Otto Brandt',
      tradition: 'filhos-do-eter',
      essence: 'questionadora',
      house: 'Engenheiros Etéricos',
    })
  })

  it('Esfera, Arete ou roda na criação: 422', async () => {
    for (const values of [
      { name: 'X', forces: 2 },
      { name: 'X', arete: 3 },
      { name: 'X', wheel: { quintessence: 5, paradox: 0 } },
    ])
      expect((await create(values)).status).toBe(422)
  })

  it('a identidade do Mago não vale numa crônica de Vampiro', async () => {
    expect(
      (await create({ name: 'X', tradition: 'verbena' }, vampire)).status
    ).toBe(422)
  })
})

describe('a roda', () => {
  it('o lote grava, e o histórico diz "Paradoxo 0 → 1"', async () => {
    const id = await otto()
    const res = await send(owner, id, [
      {
        path: 'values.wheel',
        from: null,
        to: { quintessence: 0, paradox: 1 },
      },
    ])
    expect(res.status).toBe(200)
    const history = (await (
      await as(ctx, storyteller, 'GET', `/characters/${id}/history`)
    ).json()) as { items: { changes: { label: string; change: string }[] }[] }
    expect(history.items[0]?.changes).toEqual([
      { label: 'Paradoxo', change: '0 → 1' },
    ])
  })

  it('passar das 20 casas: 422, e nada grava', async () => {
    const id = await otto()
    const res = await send(owner, id, [
      {
        path: 'values.wheel',
        from: null,
        to: { quintessence: 6, paradox: 15 },
      },
    ])
    expect(res.status).toBe(422)
    const after = (await (
      await as(ctx, owner, 'GET', `/characters/${id}`)
    ).json()) as { sheetVersion: number }
    expect(after.sheetVersion).toBe(0)
  })

  it('Esfera acima do Arete é aceita: o teto não é destrutivo', async () => {
    const id = await otto()
    const res = await send(owner, id, [
      { path: 'values.arete', from: null, to: 2 },
      { path: 'values.forces', from: null, to: 4 },
    ])
    expect(res.status).toBe(200)
  })
})

describe('mesa e Notas do Narrador', () => {
  it('a mesa de Mago traz a roda; a de Vampiro, o Sangue', async () => {
    const id = await otto()
    await send(owner, id, [
      {
        path: 'values.wheel',
        from: null,
        to: { quintessence: 6, paradox: 2 },
      },
    ])
    const rows = (await (
      await as(ctx, storyteller, 'GET', `/chronicles/${mage}/table`)
    ).json()) as {
      systemCode: string
      sheet: { values: Record<string, unknown> }
    }[]
    expect(rows).toHaveLength(1)
    expect(rows[0]?.systemCode).toBe('mta-m20')
    expect(rows[0]?.sheet.values.wheel).toEqual({ quintessence: 6, paradox: 2 })
  })

  it('o jogador nunca recebe as Notas do Narrador do Mago', async () => {
    const id = await otto()
    expect(
      (
        await send(storyteller, id, [
          {
            path: 'values.storytellerNotes',
            from: null,
            to: 'Um Sinal do Paradoxo vem aí.',
          },
        ])
      ).status
    ).toBe(200)
    // O dono escreve as notas do narrador? Não
    expect(
      (
        await send(owner, id, [
          {
            path: 'values.storytellerNotes',
            from: null,
            to: 'tentativa',
          },
        ])
      ).status
    ).toBe(403)
    for (const user of [owner, player]) {
      const text = await (
        await as(ctx, user, 'GET', `/characters/${id}`)
      ).text()
      expect(text).not.toContain('Sinal do Paradoxo')
    }
  })
})
