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
} from '../test/helpers'

// Operações em grupo e reversão (doc/painel-narrador.md §5.4; doc/plano-v3.md,
// Etapa 11): idempotentes, atômicas, com a prévia conferida pela versão.

let ctx: TestContext
let storyteller: TestUser
let player: TestUser
let chronicleId: string
let helena: string
let caio: string

const unhurt = { aggravated: 0, lethal: 0, bashing: 0 }

beforeEach(async () => {
  await destroyTestDb()
  ctx = await createTestContext()
  await publish(ctx, 'vtm-v20')
  storyteller = await createUser(ctx, 'narradora')
  player = await createUser(ctx, 'jogadora')
  chronicleId = await createChronicle(ctx, storyteller)
  await addMember(ctx, chronicleId, player)
  helena = await createCharacter(ctx, player, chronicleId, {
    name: 'Helena Varga',
    health: unhurt,
    blood: { current: 9 },
  })
  // Sem Vitalidade guardada: a reversão devolve o campo vazio
  caio = await createCharacter(ctx, player, chronicleId, { name: 'Caio' })
  await setStatus(ctx, helena, 'active')
  await setStatus(ctx, caio, 'active')
})
afterEach(async () => {
  await destroyTestDb()
})

const lethal = (
  targets: { characterId: string; sheetVersion: number }[],
  key = crypto.randomUUID()
) =>
  as(ctx, storyteller, 'POST', `/chronicles/${chronicleId}/operations`, {
    clientOperationId: key,
    kind: 'damage',
    type: 'lethal',
    amount: 2,
    targets,
  })

const revert = (target: {
  revertsOperationId?: string
  revertsBatchId?: string
}) =>
  as(ctx, storyteller, 'POST', `/chronicles/${chronicleId}/operations`, {
    clientOperationId: crypto.randomUUID(),
    kind: 'revert',
    ...target,
  })

const row = (id: string) =>
  ctx.db
    .selectFrom('characters')
    .select(['sheet_data', 'sheet_version'])
    .where('id', '=', id)
    .executeTakeFirstOrThrow()

const health = async (id: string) =>
  ((await row(id)).sheet_data as { values: Record<string, unknown> }).values
    .health

const both = () => [
  { characterId: helena, sheetVersion: 0 },
  { characterId: caio, sheetVersion: 0 },
]

describe('prévia', () => {
  it('recuperação usa só o período do template: prévia, reenvio e reversão', async () => {
    const request = {
      kind: 'recovery',
      recoveryId: 'newNight',
      targets: both(),
    }
    const pre = await as(
      ctx,
      storyteller,
      'POST',
      `/chronicles/${chronicleId}/operations/preview`,
      request
    )
    expect(pre.status).toBe(200)
    const preview = (await pre.json()) as {
      characters: { ok: boolean; changes: { label: string }[] }[]
    }
    expect(
      preview.characters.every(c => c.ok && c.changes[0]?.label === 'Sangue')
    ).toBe(true)
    const body = { ...request, clientOperationId: crypto.randomUUID() }
    const first = await as(
      ctx,
      storyteller,
      'POST',
      `/chronicles/${chronicleId}/operations`,
      body
    )
    expect(first.status).toBe(201)
    const result = (await first.json()) as { operationId: string }
    const duplicate = await as(
      ctx,
      storyteller,
      'POST',
      `/chronicles/${chronicleId}/operations`,
      body
    )
    expect(await duplicate.json()).toMatchObject({ ...result, duplicate: true })
    expect((await row(helena)).sheet_data).toMatchObject({
      values: { blood: { current: 8 } },
    })
    expect(
      (await revert({ revertsOperationId: result.operationId })).status
    ).toBe(201)
    expect((await row(helena)).sheet_data).toMatchObject({
      values: { blood: { current: 9 } },
    })
    expect((await row(caio)).sheet_data).not.toHaveProperty('values.blood')
  })

  it('recuperação indisponível ou versão vencida recusa o grupo inteiro', async () => {
    const post = (recoveryId: string, targets = both()) =>
      as(ctx, storyteller, 'POST', `/chronicles/${chronicleId}/operations`, {
        clientOperationId: crypto.randomUUID(),
        kind: 'recovery',
        recoveryId,
        targets,
      })
    expect((await post('missing')).status).toBe(422)
    expect((await post('storyEnd')).status).toBe(422)
    const stale = await post(
      'newNight',
      both().map(t => ({ ...t, sheetVersion: 1 }))
    )
    expect(stale.status).toBe(409)
    expect(await stale.json()).toHaveProperty('preview')
    expect((await row(helena)).sheet_version).toBe(0)
    expect((await row(caio)).sheet_version).toBe(0)
  })
  it('por ficha, o texto da mudança e a versão lida; não grava nada', async () => {
    const res = await as(
      ctx,
      storyteller,
      'POST',
      `/chronicles/${chronicleId}/operations/preview`,
      {
        kind: 'damage',
        type: 'lethal',
        amount: 2,
        targets: [{ characterId: helena }, { characterId: caio }],
      }
    )
    expect(res.status).toBe(200)
    const { characters } = (await res.json()) as {
      characters: { characterId: string; sheetVersion: number; ok: boolean }[]
    }
    expect(characters).toEqual([
      expect.objectContaining({
        characterId: helena,
        name: 'Helena Varga',
        sheetVersion: 0,
        ok: true,
        changes: [{ label: 'Vitalidade', change: expect.any(String) }],
      }),
      expect.objectContaining({ characterId: caio, ok: true }),
    ])
    expect((await row(helena)).sheet_version).toBe(0)
  })
})

describe('aplicar', () => {
  it('não aceita a mesma ficha duas vezes, nem grava lotes duplicados', async () => {
    expect((await lethal([both()[0]!, both()[0]!])).status).toBe(422)
    expect((await row(helena)).sheet_version).toBe(0)
  })
  it('um lote por ficha, com a operação e o papel do narrador', async () => {
    const res = await lethal(both())
    expect(res.status).toBe(201)
    const body = (await res.json()) as {
      operationId: string
      duplicate: boolean
      characters: { characterId: string; sheetVersion: number }[]
    }
    expect(body.duplicate).toBe(false)
    expect(body.characters.map(c => c.sheetVersion)).toEqual([1, 1])
    expect(await health(helena)).toEqual({
      aggravated: 0,
      lethal: 2,
      bashing: 0,
    })
    const batches = await ctx.db
      .selectFrom('character_batches')
      .select(['by_role', 'operation_id'])
      .execute()
    expect(batches).toEqual([
      { by_role: 'storyteller', operation_id: body.operationId },
      { by_role: 'storyteller', operation_id: body.operationId },
    ])
  })

  it('reenviar a mesma operação (resposta perdida) aplica uma vez', async () => {
    const key = crypto.randomUUID()
    const first = (await (await lethal(both(), key)).json()) as object
    const again = await lethal(both(), key)
    expect(again.status).toBe(200)
    const body = (await again.json()) as { duplicate: boolean }
    expect(body.duplicate).toBe(true)
    expect({ ...body, duplicate: false } as object).toEqual(first)
    expect(await health(helena)).toEqual({
      aggravated: 0,
      lethal: 2,
      bashing: 0,
    })
  })

  it('uma ficha alterada entre a prévia e a aplicação: 409 com a prévia nova, e nenhuma muda', async () => {
    await as(ctx, player, 'POST', `/characters/${caio}/events`, {
      clientBatchId: crypto.randomUUID(),
      events: [{ path: 'values.concept', from: null, to: 'Brigão' }],
    })
    const res = await lethal(both())
    expect(res.status).toBe(409)
    const body = (await res.json()) as {
      preview: { characterId: string; sheetVersion: number }[]
    }
    expect(body.preview.find(p => p.characterId === caio)?.sheetVersion).toBe(1)
    expect(await health(helena)).toEqual(unhurt)
    // Com a prévia nova, aplica
    const retry = await lethal([
      { characterId: helena, sheetVersion: 0 },
      { characterId: caio, sheetVersion: 1 },
    ])
    expect(retry.status).toBe(201)
  })

  it('uma ficha de outra crônica no meio da lista: 404, e nenhuma muda', async () => {
    const other = await createUser(ctx, 'outra')
    const elsewhere = await createChronicle(ctx, other, 'vtm-v20', 'Outra')
    const theirs = await createCharacter(ctx, other, elsewhere, { name: 'X' })
    const res = await lethal([
      { characterId: helena, sheetVersion: 0 },
      { characterId: theirs, sheetVersion: 0 },
    ])
    expect(res.status).toBe(404)
    expect(await health(helena)).toEqual(unhurt)
    expect((await row(theirs)).sheet_version).toBe(0)
  })

  it('uma ficha sem efeito recusa a operação inteira (422, com a prévia)', async () => {
    const res = await as(
      ctx,
      storyteller,
      'POST',
      `/chronicles/${chronicleId}/operations`,
      {
        clientOperationId: crypto.randomUUID(),
        kind: 'heal',
        type: 'lethal',
        amount: 1,
        targets: both(),
      }
    )
    expect(res.status).toBe(422)
    expect(await res.json()).toMatchObject({
      preview: expect.arrayContaining([expect.objectContaining({ ok: false })]),
    })
    expect(
      await ctx.db.selectFrom('chronicle_operations').select('id').execute()
    ).toEqual([])
  })

  it('o narrador opera ficha arquivada e a de quem acabou de sair', async () => {
    await setStatus(ctx, helena, 'archived')
    await as(ctx, player, 'DELETE', `/chronicles/${chronicleId}/members/me`)
    const res = await lethal(both())
    expect(res.status).toBe(201)
  })

  it('só o narrador: o jogador recebe 403, e nada muda', async () => {
    const res = await as(
      ctx,
      player,
      'POST',
      `/chronicles/${chronicleId}/operations`,
      {
        clientOperationId: crypto.randomUUID(),
        kind: 'damage',
        amount: 1,
        targets: both(),
      }
    )
    expect(res.status).toBe(403)
    expect(await health(helena)).toEqual(unhurt)
  })
})

describe('reverter', () => {
  it('o custo de uma rolagem com FdV implícita volta a ficar sem valor guardado', async () => {
    const rolled = await as(ctx, player, 'POST', `/characters/${caio}/rolls`, {
      clientRollId: crypto.randomUUID(),
      slots: { attribute: 'dexterity' },
      difficulty: 6,
      boosts: ['willpower'],
    })
    expect(rolled.status).toBe(201)
    const batch = await ctx.db
      .selectFrom('character_batches')
      .select('id')
      .where('character_id', '=', caio)
      .executeTakeFirstOrThrow()
    const before = await ctx.db
      .selectFrom('character_events')
      .select('from_absent')
      .where('batch_id', '=', batch.id)
      .executeTakeFirstOrThrow()
    expect(before.from_absent).toBe(true)
    expect((await revert({ revertsBatchId: batch.id })).status).toBe(201)
    expect(
      ((await row(caio)).sheet_data as { values: Record<string, unknown> })
        .values.willpower
    ).toBeUndefined()
  })

  async function damaged() {
    const res = await lethal(both())
    return ((await res.json()) as { operationId: string }).operationId
  }

  it('desfaz a operação inteira; o campo que estava vazio volta vazio', async () => {
    const op = await damaged()
    const res = await revert({ revertsOperationId: op })
    expect(res.status).toBe(201)
    expect(await health(helena)).toEqual(unhurt)
    expect(await health(caio)).toBeUndefined()
  })

  it('depois de o jogador mexer no mesmo campo: recusa com o campo em conflito, e nada muda', async () => {
    const op = await damaged()
    await as(ctx, player, 'POST', `/characters/${helena}/events`, {
      clientBatchId: crypto.randomUUID(),
      events: [
        {
          path: 'values.health',
          from: { aggravated: 0, lethal: 2, bashing: 0 },
          to: { aggravated: 0, lethal: 1, bashing: 0 },
        },
      ],
    })
    const res = await revert({ revertsOperationId: op })
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({
      code: 'REVERT_CONFLICT',
      conflicts: [{ characterId: helena, paths: ['values.health'] }],
    })
    // Nada de reversão parcial: o Caio continua ferido
    expect(await health(caio)).toEqual({ aggravated: 0, lethal: 2, bashing: 0 })
  })

  it('reverter duas vezes a mesma operação: 409 na segunda', async () => {
    const op = await damaged()
    expect((await revert({ revertsOperationId: op })).status).toBe(201)
    expect((await revert({ revertsOperationId: op })).status).toBe(409)
  })

  it('uma operação com um lote já desfeito não pode ser revertida inteira', async () => {
    const op = await damaged()
    const batch = await ctx.db
      .selectFrom('character_batches')
      .select('id')
      .where('operation_id', '=', op)
      .where('character_id', '=', helena)
      .executeTakeFirstOrThrow()
    expect((await revert({ revertsBatchId: batch.id })).status).toBe(201)
    expect((await revert({ revertsOperationId: op })).status).toBe(409)
    expect(await health(caio)).toEqual({ aggravated: 0, lethal: 2, bashing: 0 })
  })

  it('a reversão não se desfaz (422)', async () => {
    const op = await damaged()
    const undo = (await (await revert({ revertsOperationId: op })).json()) as {
      operationId: string
    }
    expect(
      (await revert({ revertsOperationId: undo.operationId })).status
    ).toBe(422)
  })

  it('um lote comum de uma ficha: desfaz o gasto de Sangue; um lote com texto, 422', async () => {
    await as(ctx, player, 'POST', `/characters/${helena}/events`, {
      clientBatchId: crypto.randomUUID(),
      events: [
        { path: 'values.blood', from: { current: 9 }, to: { current: 7 } },
      ],
    })
    await as(ctx, player, 'POST', `/characters/${helena}/events`, {
      clientBatchId: crypto.randomUUID(),
      events: [{ path: 'values.concept', from: null, to: 'Erudita' }],
    })
    const batches = await ctx.db
      .selectFrom('character_batches')
      .select(['id', 'sheet_version'])
      .where('character_id', '=', helena)
      .orderBy('sheet_version')
      .execute()
    const [spend, text] = batches
    expect((await revert({ revertsBatchId: spend?.id })).status).toBe(201)
    expect(
      ((await row(helena)).sheet_data as { values: Record<string, unknown> })
        .values.blood
    ).toEqual({ current: 9 })
    expect((await revert({ revertsBatchId: text?.id })).status).toBe(422)
  })

  it('o histórico diz quais lotes dá para desfazer', async () => {
    const op = await damaged()
    ctx.clock.advance(1000)
    await revert({ revertsOperationId: op })
    const res = await as(
      ctx,
      storyteller,
      'GET',
      `/characters/${helena}/history`
    )
    const { items } = (await res.json()) as {
      items: { operationId: string | null; reversible: boolean }[]
    }
    // Do mais novo: a reversão (não se desfaz) e o dano (já desfeito)
    expect(items.map(i => i.reversible)).toEqual([false, false])
    expect(items[1]?.operationId).toBe(op)
  })

  it('nem a operação nem o lote: 422', async () => {
    expect((await revert({})).status).toBe(422)
    const op = await damaged()
    const batch = await ctx.db
      .selectFrom('character_batches')
      .select('id')
      .executeTakeFirstOrThrow()
    expect(
      (await revert({ revertsOperationId: op, revertsBatchId: batch.id }))
        .status
    ).toBe(422)
  })
})
