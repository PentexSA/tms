/// <reference types="bun-types" />
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
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
  useTestDb,
} from '../test/helpers'

// Um PGLite para o arquivo, restaurado a cada createTestContext
useTestDb()

// A Mesa do narrador (doc/plano-v0.md, Etapa 19).

let ctx: TestContext
let storyteller: TestUser
let owner: TestUser
let player: TestUser
let chronicleId: string

interface TableRow {
  id: string
  name: string
  kind: 'pc' | 'npc'
  visibility: 'hidden' | 'identity' | 'full'
  owner: { id: string; username: string }
  systemCode: string
  templateVersion: string
  sheetVersion: number
  status: string
  creationMode: 'free' | 'points' | null
  returned: boolean
  adjust: boolean
  ready: boolean
  activatedAt: string | null
  lockedAt: string | null
  updatedAt: string
  lastChange: { at: string; by: 'you' | 'owner' | 'other' } | null
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

const rowsOf = async (user: TestUser, id = chronicleId) =>
  (await (await table(user, id)).json()) as TableRow[]

// Um lote pela rota de verdade: é dele que sai o `lastChange`
const write = async (
  user: TestUser,
  characterId: string,
  path: string,
  from: unknown,
  to: unknown
) => {
  const res = await as(ctx, user, 'POST', `/characters/${characterId}/events`, {
    clientBatchId: crypto.randomUUID(),
    events: [{ path, from, to }],
  })
  expect(res.status).toBe(200)
}

describe('GET /chronicles/:id/table', () => {
  it('o narrador recebe todas as fichas inteiras numa resposta só', async () => {
    const helena = await createCharacter(ctx, owner, chronicleId, {
      name: 'Helena Varga',
      backgrounds: [{ id: 'b1', name: 'Geração', value: 5 }],
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
      kind: 'pc',
      visibility: 'hidden',
      owner: { id: owner.id, username: 'dona' },
      systemCode: 'vtm-v20',
      templateVersion: expect.stringMatching(/^\d+\.\d+\.\d+$/),
      sheetVersion: 0,
      status: 'creating',
      // O estado da criação (P04-D): o modo e os marcadores, sem motivo
      creationMode: 'points',
      returned: false,
      adjust: false,
      ready: false,
      activatedAt: null,
      lockedAt: null,
      updatedAt: expect.any(String),
      // Ficha sem lote: sem autor da última alteração
      lastChange: null,
      sheet: {
        // O antecedente Geração entra: o máximo do Sangue no dock depende dele
        values: {
          name: 'Helena Varga',
          backgrounds: [{ id: 'b1', name: 'Geração', value: 5 }],
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

  // v3, Etapa 9: arquivada e fora de jogo somem; o filtro as traz
  it('mostra creating, pending e active; ?status= traz as outras', async () => {
    const ids: Record<string, string> = {}
    for (const status of [
      'creating',
      'pending',
      'active',
      'archived',
      'dead',
    ] as const) {
      ids[status] = await createCharacter(ctx, owner, chronicleId, {
        name: status,
      })
      await setStatus(ctx, ids[status] as string, status)
    }
    const names = async (query = '') =>
      (
        (await (
          await as(
            ctx,
            storyteller,
            'GET',
            `/chronicles/${chronicleId}/table${query}`
          )
        ).json()) as { name: string; status: string }[]
      ).map(r => r.status)
    expect(await names()).toEqual(['creating', 'pending', 'active'])
    expect(await names('?status=pending')).toEqual(['pending'])
    expect(await names('?status=archived,dead')).toEqual(['archived', 'dead'])
    expect(await names('?status=active')).toEqual(['active'])
    const bad = await as(
      ctx,
      storyteller,
      'GET',
      `/chronicles/${chronicleId}/table?status=zumbi`
    )
    expect(bad.status).toBe(422)
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

  // P09-C (T-83): "alterada por você", "por <dono>" ou sem autor
  describe('lastChange', () => {
    it('o narrador salva uma nota: by é you, com a hora do lote', async () => {
      const id = await createCharacter(ctx, owner, chronicleId, {
        name: 'Helena Varga',
      })
      ctx.clock.advance(60_000)
      await write(storyteller, id, 'values.storytellerNotes', null, 'Recado')
      const [row] = await rowsOf(storyteller)
      expect(row?.lastChange).toEqual({ at: expect.any(String), by: 'you' })
      expect(new Date(row?.lastChange?.at ?? 0).toISOString()).toBe(
        ctx.clock.now().toISOString()
      )
    })

    it('o lote do dono é owner; o mais recente vale', async () => {
      const id = await createCharacter(ctx, owner, chronicleId, {
        name: 'Helena Varga',
        blood: { current: 9 },
      })
      await write(storyteller, id, 'values.storytellerNotes', null, 'Recado')
      ctx.clock.advance(60_000)
      await write(owner, id, 'values.blood', { current: 9 }, { current: 8 })
      const [row] = await rowsOf(storyteller)
      expect(row?.lastChange?.by).toBe('owner')
      expect(new Date(row?.lastChange?.at ?? 0).toISOString()).toBe(
        ctx.clock.now().toISOString()
      )
    })

    it('lotes no mesmo instante: a versão maior desempata', async () => {
      const id = await createCharacter(ctx, owner, chronicleId, {
        name: 'Helena Varga',
        blood: { current: 9 },
      })
      await write(owner, id, 'values.blood', { current: 9 }, { current: 8 })
      await write(storyteller, id, 'values.storytellerNotes', null, 'Recado')
      const [row] = await rowsOf(storyteller)
      expect(row?.lastChange?.by).toBe('you')
    })

    it('o NPC do narrador, oculto, é you', async () => {
      const npc = await createCharacter(ctx, storyteller, chronicleId, {
        name: 'NPC oculto',
      })
      await ctx.db
        .updateTable('characters')
        .set({ kind: 'npc', visibility: 'hidden' })
        .where('id', '=', npc)
        .execute()
      await write(storyteller, npc, 'values.storytellerNotes', null, 'Plano')
      const [row] = await rowsOf(storyteller)
      expect(row).toMatchObject({
        kind: 'npc',
        visibility: 'hidden',
        lastChange: { by: 'you' },
      })
    })

    it('lote sem autor (conta excluída) é other', async () => {
      const id = await createCharacter(ctx, owner, chronicleId)
      await ctx.db
        .insertInto('character_batches')
        .values({
          character_id: id,
          client_batch_id: crypto.randomUUID(),
          created_by: null,
          by_role: 'owner',
          sheet_version: 1,
          created_at: ctx.clock.now(),
        })
        .execute()
      const [row] = await rowsOf(storyteller)
      expect(row?.lastChange?.by).toBe('other')
    })

    it('depois da transferência, o lote do narrador antigo é other para o novo', async () => {
      const id = await createCharacter(ctx, owner, chronicleId, {
        name: 'Helena Varga',
      })
      await write(storyteller, id, 'values.storytellerNotes', null, 'Recado')
      const proposed = await as(
        ctx,
        storyteller,
        'POST',
        `/chronicles/${chronicleId}/transfer`,
        { clientCommandId: crypto.randomUUID(), recipientId: player.id }
      )
      const transfer = (await proposed.json()) as { id: string }
      const accepted = await as(
        ctx,
        player,
        'POST',
        `/chronicles/${chronicleId}/transfer/${transfer.id}/accept`,
        { clientCommandId: crypto.randomUUID() }
      )
      expect(accepted.status).toBe(200)
      const [row] = await rowsOf(player)
      expect(row?.lastChange?.by).toBe('other')
      // O narrador antigo perdeu a Mesa
      expect((await table(storyteller)).status).toBe(404)
    })

    it('a resposta não leva o autor: nem id, nem nome de outro narrador', async () => {
      const id = await createCharacter(ctx, owner, chronicleId, {
        name: 'Helena Varga',
      })
      await write(storyteller, id, 'values.storytellerNotes', null, 'Recado')
      const proposed = await as(
        ctx,
        storyteller,
        'POST',
        `/chronicles/${chronicleId}/transfer`,
        { clientCommandId: crypto.randomUUID(), recipientId: player.id }
      )
      const transfer = (await proposed.json()) as { id: string }
      await as(
        ctx,
        player,
        'POST',
        `/chronicles/${chronicleId}/transfer/${transfer.id}/accept`,
        { clientCommandId: crypto.randomUUID() }
      )
      const text = await (await table(player)).text()
      expect(text).not.toContain(storyteller.id)
      expect(text).not.toContain('narradora')
      expect(text).not.toContain('created_by')
      expect(text).not.toContain('createdBy')
    })

    it('quem vê o NPC revelado (viewer) continua sem a Mesa: 404', async () => {
      const npc = await createCharacter(ctx, storyteller, chronicleId, {
        name: 'NPC revelado',
      })
      await ctx.db
        .updateTable('characters')
        .set({ kind: 'npc', visibility: 'full' })
        .where('id', '=', npc)
        .execute()
      await write(storyteller, npc, 'values.storytellerNotes', null, 'segredo')
      // O jogador lê o NPC como viewer, mas a Mesa não existe para ele
      const sheet = await as(ctx, player, 'GET', `/characters/${npc}`)
      expect(sheet.status).toBe(200)
      expect(await sheet.json()).toMatchObject({ roles: ['viewer'] })
      for (const user of [owner, player]) {
        const res = await table(user)
        expect(res.status).toBe(404)
        const text = await res.text()
        expect(text).not.toContain('lastChange')
        expect(text).not.toContain('segredo')
      }
    })
  })
})
