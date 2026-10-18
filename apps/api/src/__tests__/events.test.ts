/// <reference types="bun-types" />
import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test'
import { createRateLimiter } from '../http/rate-limit'
import { logger } from '../logger'
import { defaultLimits } from '../options'
import { MAX_BATCH_BYTES } from '../sheets/events'
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

// O endpoint de eventos e o histórico (doc/plano-v0.md, Etapa 15).

let ctx: TestContext
let storyteller: TestUser
let owner: TestUser
let player: TestUser
let otherStoryteller: TestUser
let chronicleId: string
let characterId: string

const helena = {
  name: 'Helena Varga',
  clan: 'tremere',
  generation: 8,
  blood: { current: 9 },
  willpower: { current: 5, permanent: 7 },
  health: { aggravated: 0, lethal: 1, bashing: 1 },
  notes: 'Deve um favor ao Primógeno.',
  storytellerNotes: 'O Regente vai cobrar.',
}

async function setup(extra: Parameters<typeof createTestContext>[0] = {}) {
  await destroyTestDb()
  ctx = await createTestContext(extra)
  await publish(ctx, 'vtm-v20')
  storyteller = await createUser(ctx, 'narradora')
  owner = await createUser(ctx, 'dona')
  player = await createUser(ctx, 'outro')
  otherStoryteller = await createUser(ctx, 'alheio')
  chronicleId = await createChronicle(ctx, storyteller)
  await addMember(ctx, chronicleId, owner)
  await addMember(ctx, chronicleId, player)
  await createChronicle(ctx, otherStoryteller, 'vtm-v20', 'Outra')
  characterId = await createCharacter(ctx, owner, chronicleId, helena)
}

beforeEach(async () => {
  await setup()
})
afterEach(async () => {
  await destroyTestDb()
})

const batchId = () => crypto.randomUUID()
const send = (user: TestUser, events: unknown[], clientBatchId = batchId()) =>
  as(ctx, user, 'POST', `/characters/${characterId}/events`, {
    clientBatchId,
    events,
  })
const spendBlood = {
  path: 'values.blood',
  from: { current: 9 },
  to: { current: 8 },
}

const row = () =>
  ctx.db
    .selectFrom('characters')
    .selectAll()
    .where('id', '=', characterId)
    .executeTakeFirstOrThrow()

interface BatchResponse {
  clientBatchId: string
  sheetVersion: number
  duplicate: boolean
  sheet: { values: Record<string, unknown> }
}

describe('POST /characters/:id/events', () => {
  it('aplica o lote, sobe a versão e grava o histórico', async () => {
    const id = batchId()
    const res = await send(owner, [spendBlood], id)
    expect(res.status).toBe(200)
    const body = (await res.json()) as BatchResponse
    expect(body).toMatchObject({
      clientBatchId: id,
      sheetVersion: 1,
      duplicate: false,
    })
    expect(body.sheet.values.blood).toEqual({ current: 8 })
    const r = await row()
    expect(r.sheet_version).toBe(1)
    expect(
      (r.sheet_data as { values: Record<string, unknown> }).values.blood
    ).toEqual({
      current: 8,
    })
    const batches = await ctx.db
      .selectFrom('character_batches')
      .selectAll()
      .execute()
    expect(batches).toEqual([
      expect.objectContaining({
        client_batch_id: id,
        created_by: owner.id,
        by_role: 'owner',
        sheet_version: 1,
      }),
    ])
    const events = await ctx.db
      .selectFrom('character_events')
      .selectAll()
      .execute()
    expect(events).toEqual([
      expect.objectContaining({
        seq: 0,
        path: 'values.blood',
        from_value: { current: 9 },
        to_value: { current: 8 },
      }),
    ])
  })

  it('o mesmo lote reenviado (fila offline) é aplicado uma vez só', async () => {
    const id = batchId()
    await send(owner, [spendBlood], id)
    const again = await send(owner, [spendBlood], id)
    expect(again.status).toBe(200)
    expect(await again.json()).toMatchObject({
      duplicate: true,
      sheetVersion: 1,
    })
    expect((await row()).sheet_version).toBe(1)
    expect(
      await ctx.db.selectFrom('character_events').selectAll().execute()
    ).toHaveLength(1)
  })

  it('from velho é 409 com o valor atual, sem vazar o que o papel não lê', async () => {
    await send(owner, [spendBlood])
    const res = await send(owner, [
      { path: 'values.blood', from: { current: 9 }, to: { current: 7 } },
    ])
    expect(res.status).toBe(409)
    const text = await res.text()
    expect(JSON.parse(text)).toMatchObject({
      current: { 'values.blood': { current: 8 } },
      sheetVersion: 1,
      issues: [{ path: 'values.blood' }],
    })
    expect(text).not.toContain('Regente')
    expect((await row()).sheet_version).toBe(1)
  })

  it('lote com um evento inválido não grava nada (422)', async () => {
    const res = await send(owner, [
      spendBlood,
      { path: 'values.strength', from: null, to: 9 },
    ])
    expect(res.status).toBe(422)
    expect(await res.json()).toMatchObject({
      issues: [{ path: 'values.strength', message: 'acima do máximo 5' }],
    })
    const r = await row()
    expect(r.sheet_version).toBe(0)
    expect(
      await ctx.db.selectFrom('character_batches').selectAll().execute()
    ).toEqual([])
  })

  it.each([
    ['caminho fundo', { path: 'values.blood.current', from: 9, to: 8 }],
    [
      '__proto__',
      { path: 'values.__proto__', from: null, to: { admin: true } },
    ],
    ['campo inexistente', { path: 'values.isAdmin', from: null, to: true }],
    [
      'especialização de campo sem especialização',
      {
        path: 'specialties.name',
        from: null,
        to: 'x',
      },
    ],
  ])('%s: 422', async (_, event) => {
    expect((await send(owner, [event])).status).toBe(422)
  })

  it('o dono não grava as Notas do Narrador (403)', async () => {
    const res = await send(owner, [
      { path: 'values.storytellerNotes', from: null, to: 'chute' },
    ])
    expect(res.status).toBe(403)
  })

  it('o narrador edita a ficha do jogador, assinado como narrador', async () => {
    const res = await send(storyteller, [
      {
        path: 'values.health',
        from: helena.health,
        to: { aggravated: 0, lethal: 2, bashing: 1 },
      },
      {
        path: 'values.storytellerNotes',
        from: helena.storytellerNotes,
        to: 'Cobrou.',
      },
    ])
    expect(res.status).toBe(200)
    const batch = await ctx.db
      .selectFrom('character_batches')
      .select('by_role')
      .executeTakeFirstOrThrow()
    expect(batch.by_role).toBe('storyteller')
  })

  it('texto e especialização entram no histórico sem conteúdo', async () => {
    await send(owner, [
      { path: 'values.notes', from: helena.notes, to: 'segredo da jogadora' },
      { path: 'specialties.occult', from: null, to: 'Hermetismo' },
    ])
    const events = await ctx.db
      .selectFrom('character_events')
      .select(['path', 'from_value', 'to_value'])
      .orderBy('seq')
      .execute()
    expect(events).toEqual([
      { path: 'values.notes', from_value: null, to_value: null },
      { path: 'specialties.occult', from_value: null, to_value: null },
    ])
    // A ficha tem o texto; o histórico não
    expect(JSON.stringify((await row()).sheet_data)).toContain(
      'segredo da jogadora'
    )
  })

  it('mudar o nome atualiza characters.name', async () => {
    await send(owner, [
      { path: 'values.name', from: helena.name, to: '  Helena Varga-Costa ' },
    ])
    expect((await row()).name).toBe('Helena Varga-Costa')
  })

  it('limites: lote vazio, 51 eventos e corpo acima de 64 KB', async () => {
    expect((await send(owner, [])).status).toBe(400)
    const many = Array.from({ length: 51 }, () => spendBlood)
    expect((await send(owner, many)).status).toBe(400)
    const big = await send(owner, [
      {
        path: 'values.notes',
        from: helena.notes,
        to: 'x'.repeat(MAX_BATCH_BYTES),
      },
    ])
    expect(big.status).toBe(413)
  })

  it('clientBatchId precisa ser UUID', async () => {
    const res = await as(
      ctx,
      owner,
      'POST',
      `/characters/${characterId}/events`,
      {
        clientBatchId: 'abc',
        events: [spendBlood],
      }
    )
    expect(res.status).toBe(400)
  })

  it('ficha excluída: 404', async () => {
    await as(ctx, owner, 'DELETE', `/characters/${characterId}`)
    expect((await send(owner, [spendBlood])).status).toBe(404)
  })

  it('rate limit por usuário e por ficha', async () => {
    await setup({
      limits: {
        ...defaultLimits(() => new Date()),
        events: createRateLimiter({ limit: 2, windowMs: 60_000 }),
      },
    })
    expect((await send(owner, [spendBlood])).status).toBe(200)
    expect(
      (
        await send(owner, [
          { path: 'values.blood', from: { current: 8 }, to: { current: 7 } },
        ])
      ).status
    ).toBe(200)
    const res = await send(owner, [
      { path: 'values.blood', from: { current: 7 }, to: { current: 6 } },
    ])
    expect(res.status).toBe(429)
    expect(res.headers.get('retry-after')).toMatch(/^\d+$/)
  })

  it('o log nunca tem o texto escrito', async () => {
    const info = spyOn(logger, 'info')
    try {
      await send(owner, [
        { path: 'values.notes', from: helena.notes, to: 'segredo absoluto' },
      ])
      await new Promise(r => setTimeout(r, 10))
      expect(JSON.stringify(info.mock.calls)).not.toContain('segredo absoluto')
      expect(info).toHaveBeenCalled()
    } finally {
      info.mockRestore()
    }
  })
})

describe('GET /characters/:id/history', () => {
  const history = async (user: TestUser, query = '') =>
    (await (
      await as(ctx, user, 'GET', `/characters/${characterId}/history${query}`)
    ).json()) as {
      items: {
        id: string
        at: string
        byRole: string
        by: { username: string }
        sheetVersion: number
        changes: { label: string; change: string }[]
      }[]
      next: string | null
    }

  it('quem, papel e o que mudou, do mais novo ao mais antigo', async () => {
    await send(owner, [spendBlood])
    ctx.clock.advance(1000)
    await send(storyteller, [
      {
        path: 'values.health',
        from: helena.health,
        to: { aggravated: 0, lethal: 2, bashing: 1 },
      },
    ])
    const { items } = await history(owner)
    expect(items).toEqual([
      {
        id: expect.any(String),
        at: expect.any(String),
        by: { username: 'narradora' },
        byRole: 'storyteller',
        sheetVersion: 2,
        changes: [{ label: 'Vitalidade', change: '+1 letal' }],
      },
      {
        id: expect.any(String),
        at: expect.any(String),
        by: { username: 'dona' },
        byRole: 'owner',
        sheetVersion: 1,
        changes: [{ label: 'Sangue', change: '9 → 8' }],
      },
    ])
  })

  it('o jogador não vê as alterações das Notas do Narrador (nem o rótulo)', async () => {
    await send(storyteller, [
      {
        path: 'values.storytellerNotes',
        from: helena.storytellerNotes,
        to: 'Mais segredo.',
      },
    ])
    await send(storyteller, [
      spendBlood,
      {
        path: 'values.storytellerNotes',
        from: 'Mais segredo.',
        to: 'De novo.',
      },
    ])
    const forPlayer = await history(player)
    expect(JSON.stringify(forPlayer)).not.toContain('Narrador')
    expect(forPlayer.items).toHaveLength(1)
    expect(forPlayer.items[0]?.changes).toEqual([
      { label: 'Sangue', change: '9 → 8' },
    ])
    const forStoryteller = await history(storyteller)
    expect(forStoryteller.items).toHaveLength(2)
  })

  it('Sangue ainda no padrão: o histórico mostra o efetivo (10 → 9)', async () => {
    const fresh = await createCharacter(ctx, owner, chronicleId, {
      name: 'Nova',
    })
    const res = await as(ctx, owner, 'POST', `/characters/${fresh}/events`, {
      clientBatchId: batchId(),
      events: [{ path: 'values.blood', from: null, to: { current: 9 } }],
    })
    expect(res.status).toBe(200)
    const event = await ctx.db
      .selectFrom('character_events')
      .select('from_value')
      .executeTakeFirstOrThrow()
    expect(event.from_value).toEqual({ current: 10 })
    const body = (await (
      await as(ctx, owner, 'GET', `/characters/${fresh}/history`)
    ).json()) as { items: { changes: unknown[] }[] }
    expect(body.items[0]?.changes).toEqual([
      { label: 'Sangue', change: '10 → 9' },
    ])
  })

  it('texto aparece como "atualizado", sem conteúdo', async () => {
    await send(owner, [
      { path: 'values.notes', from: helena.notes, to: 'novo segredo' },
    ])
    const text = JSON.stringify(await history(player))
    expect(text).toContain('atualizado')
    expect(text).not.toContain('novo segredo')
    expect(text).not.toContain('Primógeno')
  })

  it('paginação por cursor', async () => {
    let blood = 9
    for (let i = 0; i < 5; i++) {
      await send(owner, [
        {
          path: 'values.blood',
          from: { current: blood },
          to: { current: blood - 1 },
        },
      ])
      blood--
      ctx.clock.advance(1000)
    }
    const first = await history(owner, '?limit=2')
    expect(first.items.map(i => i.sheetVersion)).toEqual([5, 4])
    const second = await history(
      owner,
      `?limit=2&before=${encodeURIComponent(first.next ?? '')}`
    )
    expect(second.items.map(i => i.sheetVersion)).toEqual([3, 2])
    const third = await history(
      owner,
      `?limit=2&before=${encodeURIComponent(second.next ?? '')}`
    )
    expect(third.items.map(i => i.sheetVersion)).toEqual([1])
    expect(third.next).toBeNull()
  })

  it('cursor malformado: 400', async () => {
    const res = await as(
      ctx,
      owner,
      'GET',
      `/characters/${characterId}/history?before=lixo`
    )
    expect(res.status).toBe(400)
  })
})
