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

// v2, Etapa 6: o Lobisomem (W20) ao lado do Vampiro e do Mago, pelas mesmas
// rotas. A troca de forma é um lote como outro qualquer: o servidor confere
// a forma do valor (opção e limites), não o custo.

let ctx: TestContext
let storyteller: TestUser
let owner: TestUser
let player: TestUser
let werewolf: string
let mage: string

beforeEach(async () => {
  await destroyTestDb()
  ctx = await createTestContext()
  await publish(ctx, 'vtm-v20')
  await publish(ctx, 'mta-m20')
  await publish(ctx, 'wta-w20')
  storyteller = await createUser(ctx, 'narradora')
  owner = await createUser(ctx, 'dona')
  player = await createUser(ctx, 'outro')
  werewolf = await createChronicle(ctx, storyteller, 'wta-w20', 'A Seita')
  mage = await createChronicle(ctx, storyteller, 'mta-m20', 'A Torre')
  for (const c of [werewolf, mage]) {
    await addMember(ctx, c, owner)
    await addMember(ctx, c, player)
  }
})
afterEach(async () => {
  await destroyTestDb()
})

const create = (values: Record<string, unknown>, chronicle = werewolf) =>
  as(ctx, owner, 'POST', `/chronicles/${chronicle}/characters`, { values })

async function iara(): Promise<string> {
  const res = await create({
    name: 'Iara Moreira',
    deedName: 'Canta-Tempestade',
    breed: 'hominideo',
    auspice: 'galliard',
    tribe: 'fianna',
  })
  expect(res.status).toBe(201)
  return ((await res.json()) as { id: string }).id
}

const send = (user: TestUser, id: string, events: unknown[]) =>
  as(ctx, user, 'POST', `/characters/${id}/events`, {
    clientBatchId: crypto.randomUUID(),
    events,
  })

const RAGE = { current: 4, permanent: 4 }

describe('GET /systems', () => {
  it('os três sistemas publicados', async () => {
    const res = await as(ctx, owner, 'GET', '/systems')
    const systems = (await res.json()) as { code: string }[]
    expect(systems.map(s => s.code).sort()).toEqual([
      'mta-m20',
      'vtm-v20',
      'wta-w20',
    ])
  })
})

describe('ficha de Lobisomem', () => {
  it('nasce só com a identidade, no template do Lobisomem', async () => {
    const id = await iara()
    const body = (await (
      await as(ctx, owner, 'GET', `/characters/${id}`)
    ).json()) as {
      systemCode: string
      templateVersion: string
      sheet: { values: Record<string, unknown> }
    }
    expect(body.systemCode).toBe('wta-w20')
    expect(body.templateVersion).toBe('1.2.0')
    expect(body.sheet.values).toEqual({
      name: 'Iara Moreira',
      deedName: 'Canta-Tempestade',
      breed: 'hominideo',
      auspice: 'galliard',
      tribe: 'fianna',
    })
  })

  it('Forma, Fúria ou Dom na criação: 422', async () => {
    for (const values of [
      { name: 'X', form: 'crinos' },
      { name: 'X', rage: RAGE },
      { name: 'X', gifts: [{ id: 'g1', name: 'Persuasão' }] },
    ])
      expect((await create(values)).status).toBe(422)
  })

  it('a identidade do Lobisomem não vale numa crônica de Mago', async () => {
    expect((await create({ name: 'X', tribe: 'fianna' }, mage)).status).toBe(
      422
    )
  })
})

describe('a troca de forma', () => {
  it('a mudança instantânea grava os dois eventos, e o histórico diz os dois', async () => {
    const id = await iara()
    expect(
      (await send(owner, id, [{ path: 'values.rage', from: null, to: RAGE }]))
        .status
    ).toBe(200)
    const res = await send(owner, id, [
      { path: 'values.form', from: null, to: 'crinos' },
      {
        path: 'values.rage',
        from: RAGE,
        to: { current: 3, permanent: 4 },
      },
    ])
    expect(res.status).toBe(200)
    const history = (await (
      await as(ctx, storyteller, 'GET', `/characters/${id}/history`)
    ).json()) as { items: { changes: { label: string; change: string }[] }[] }
    // Os dois lotes podem cair no mesmo milissegundo: acha a troca pelo conteúdo
    const swap = history.items.find(i =>
      i.changes.some(c => c.label === 'Forma')
    )
    expect(swap?.changes).toEqual([
      { label: 'Forma', change: 'Hominídeo → Crinos' },
      { label: 'Fúria', change: '4 → 3' },
    ])
  })

  it('a troca lenta, sem gastar Fúria, também é aceita', async () => {
    const id = await iara()
    const res = await send(owner, id, [
      { path: 'values.form', from: null, to: 'lupino' },
    ])
    expect(res.status).toBe(200)
  })

  it('forma que não existe ou Fúria negativa: 422, e nada grava', async () => {
    const id = await iara()
    for (const events of [
      [{ path: 'values.form', from: null, to: 'urrah' }],
      [
        { path: 'values.form', from: null, to: 'crinos' },
        { path: 'values.rage', from: null, to: { current: -1, permanent: 4 } },
      ],
    ])
      expect((await send(owner, id, events)).status).toBe(422)
    const after = (await (
      await as(ctx, owner, 'GET', `/characters/${id}`)
    ).json()) as { sheetVersion: number }
    expect(after.sheetVersion).toBe(0)
  })

  it('o outro jogador não troca a forma de quem não é dele', async () => {
    const id = await iara()
    expect(
      (
        await send(player, id, [
          { path: 'values.form', from: null, to: 'crinos' },
        ])
      ).status
    ).toBe(403)
  })
})

describe('mesa e Notas do Narrador', () => {
  it('a mesa de Lobisomem traz a forma; a de Mago, a roda', async () => {
    const id = await iara()
    await send(owner, id, [{ path: 'values.form', from: null, to: 'crinos' }])
    const rows = (await (
      await as(ctx, storyteller, 'GET', `/chronicles/${werewolf}/table`)
    ).json()) as {
      systemCode: string
      sheet: { values: Record<string, unknown> }
    }[]
    expect(rows).toHaveLength(1)
    expect(rows[0]?.systemCode).toBe('wta-w20')
    expect(rows[0]?.sheet.values.form).toBe('crinos')
    const mageRows = (await (
      await as(ctx, storyteller, 'GET', `/chronicles/${mage}/table`)
    ).json()) as unknown[]
    expect(mageRows).toEqual([])
  })

  it('o jogador nunca recebe as Notas do Narrador do Lobisomem', async () => {
    const id = await iara()
    expect(
      (
        await send(storyteller, id, [
          {
            path: 'values.storytellerNotes',
            from: null,
            to: 'A Wyrm está na seita.',
          },
        ])
      ).status
    ).toBe(200)
    expect(
      (
        await send(owner, id, [
          { path: 'values.storytellerNotes', from: null, to: 'tentativa' },
        ])
      ).status
    ).toBe(403)
    for (const user of [owner, player]) {
      const text = await (
        await as(ctx, user, 'GET', `/characters/${id}`)
      ).text()
      expect(text).not.toContain('Wyrm')
    }
  })
})
