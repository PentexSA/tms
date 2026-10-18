/// <reference types="bun-types" />
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
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

// A Mesa do narrador (doc/plano-v0.md, Etapa 19).

let ctx: TestContext
let storyteller: TestUser
let owner: TestUser
let player: TestUser
let chronicleId: string

interface TableRow {
  id: string
  name: string
  owner: { id: string; username: string }
  systemCode: string
  templateVersion: string
  sheetVersion: number
  updatedAt: string
  sheet: { values: Record<string, unknown>; specialties?: unknown }
}

beforeEach(async () => {
  await destroyTestDb()
  ctx = await createTestContext()
  await publish(ctx, 'vtm-v20')
  storyteller = await createUser(ctx, 'narradora')
  owner = await createUser(ctx, 'dona')
  player = await createUser(ctx, 'outro')
  chronicleId = await createChronicle(ctx, storyteller)
  await addMember(ctx, chronicleId, owner)
  await addMember(ctx, chronicleId, player)
})
afterEach(async () => {
  await destroyTestDb()
})

const table = async (user: TestUser, id = chronicleId) =>
  as(ctx, user, 'GET', `/chronicles/${id}/table`)

describe('GET /chronicles/:id/table', () => {
  it('o narrador recebe todas as fichas inteiras numa resposta só', async () => {
    const helena = await createCharacter(ctx, owner, chronicleId, {
      name: 'Helena Varga',
      generation: 8,
      blood: { current: 9 },
      storytellerNotes: 'O Regente vai cobrar.',
    })
    await createCharacter(ctx, player, chronicleId, { name: 'Caio' })
    const res = await table(storyteller)
    expect(res.status).toBe(200)
    const rows = (await res.json()) as TableRow[]
    expect(rows.map(r => r.name)).toEqual(['Helena Varga', 'Caio'])
    expect(rows[0]).toEqual({
      id: helena,
      name: 'Helena Varga',
      owner: { id: owner.id, username: 'dona' },
      systemCode: 'vtm-v20',
      templateVersion: expect.stringMatching(/^\d+\.\d+\.\d+$/),
      sheetVersion: 0,
      updatedAt: expect.any(String),
      sheet: {
        // A Geração entra: o máximo do Sangue no dock depende dela
        values: {
          name: 'Helena Varga',
          generation: 8,
          blood: { current: 9 },
          storytellerNotes: 'O Regente vai cobrar.',
        },
        specialties: {},
      },
    })
  })

  it('a ficha alterada por lote traz a versão e a hora novas', async () => {
    const id = await createCharacter(ctx, owner, chronicleId, {
      name: 'Helena Varga',
      blood: { current: 9 },
    })
    ctx.clock.advance(60_000)
    await as(ctx, owner, 'POST', `/characters/${id}/events`, {
      clientBatchId: crypto.randomUUID(),
      events: [
        { path: 'values.blood', from: { current: 9 }, to: { current: 8 } },
      ],
    })
    const [after] = (await (await table(storyteller)).json()) as TableRow[]
    expect(after?.sheetVersion).toBe(1)
    expect(after?.sheet.values.blood).toEqual({ current: 8 })
    // A hora da última alteração é a do servidor no lote
    expect(new Date(after?.updatedAt ?? 0).toISOString()).toBe(
      ctx.clock.now().toISOString()
    )
  })

  it('ficha excluída não aparece', async () => {
    const id = await createCharacter(ctx, owner, chronicleId)
    await as(ctx, owner, 'DELETE', `/characters/${id}`)
    expect(await (await table(storyteller)).json()).toEqual([])
  })

  it('jogador e dono recebem 404: para eles a Mesa não existe', async () => {
    await createCharacter(ctx, owner, chronicleId, {
      name: 'Helena Varga',
      storytellerNotes: 'segredo',
    })
    for (const user of [owner, player]) {
      const res = await table(user)
      expect(res.status).toBe(404)
      expect(await res.text()).not.toContain('segredo')
    }
  })

  it('o narrador de outra crônica não vê esta (IDOR)', async () => {
    const other = await createUser(ctx, 'alheio')
    await createChronicle(ctx, other, 'vtm-v20', 'Outra')
    expect((await table(other)).status).toBe(404)
  })

  it('id malformado: 400', async () => {
    expect((await table(storyteller, 'nao-e-uuid')).status).toBe(400)
  })

  it('qualquer sistema: a mesma rota para D&D', async () => {
    await publish(ctx, 'dnd5e-2014')
    const dnd = await createChronicle(
      ctx,
      storyteller,
      'dnd5e-2014',
      'Mar de Cinzas'
    )
    await addMember(ctx, dnd, owner)
    await createCharacter(ctx, owner, dnd, { name: 'Lia', hp: { current: 7 } })
    const rows = (await (await table(storyteller, dnd)).json()) as TableRow[]
    expect(rows).toEqual([
      expect.objectContaining({
        name: 'Lia',
        systemCode: 'dnd5e-2014',
        sheet: expect.objectContaining({
          values: expect.objectContaining({ hp: { current: 7 } }),
        }),
      }),
    ])
  })
})
