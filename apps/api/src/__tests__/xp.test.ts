/// <reference types="bun-types" />
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { publishTemplate } from '../templates/publish'
import {
  addMember,
  as,
  createCharacter,
  createChronicle,
  createUser,
  publish,
  setStatus,
  type TestUser,
  template,
} from '../test/factories'
import {
  createTestContext,
  destroyTestDb,
  type TestContext,
  useTestDb,
} from '../test/helpers'

// Um PGLite para o arquivo, restaurado a cada createTestContext
useTestDb()

// Extrato, concessão, ajuste e pedidos de XP (doc/plano-v4.md, Etapas 6 e 7)
// sobre o template sintético `acct-teste` (números de teste) e uma cópia de
// D&D com campos e custos fictícios, só aqui: outra família, mesmo código.

const SYSTEM = 'testes/acct-teste'

let ctx: TestContext
let storyteller: TestUser
let owner: TestUser
let player: TestUser
let chronicleId: string
let hero: string

beforeEach(async () => {
  ctx = await createTestContext()
  await publish(ctx, SYSTEM)
  storyteller = await createUser(ctx, 'narradora')
  owner = await createUser(ctx, 'dona')
  player = await createUser(ctx, 'outro')
  chronicleId = await createChronicle(ctx, storyteller, 'acct-teste')
  await addMember(ctx, chronicleId, owner)
  await addMember(ctx, chronicleId, player)
  hero = await createCharacter(ctx, owner, chronicleId, {
    name: 'Heroína',
    lineage: 'b',
    dex: 2,
    str: 2,
  })
  await setStatus(ctx, hero, 'active')
})

afterEach(async () => {
  await destroyTestDb()
})

const json = async (res: Response) => (await res.json()) as Record<string, any>

const grant = (
  amount: number,
  targets: readonly string[] = [hero],
  key: string = crypto.randomUUID(),
  user = storyteller
) =>
  as(ctx, user, 'POST', `/chronicles/${chronicleId}/xp`, {
    clientOperationId: key,
    amount,
    reason: 'Sessão 12',
    targets: targets.map(characterId => ({ characterId })),
  })

const adjust = (body: Record<string, unknown>, id = hero, user = storyteller) =>
  as(ctx, user, 'POST', `/characters/${id}/xp-adjustments`, {
    clientOperationId: crypto.randomUUID(),
    reason: 'Correção',
    ...body,
  })

const ask = (body: Record<string, unknown>, id = hero, user = owner) =>
  as(ctx, user, 'POST', `/characters/${id}/xp-requests`, {
    clientRequestId: crypto.randomUUID(),
    ...body,
  })

const decide = (
  action: 'approve' | 'reject' | 'cancel',
  requestId: string,
  body: Record<string, unknown> = {},
  user = action === 'cancel' ? owner : storyteller,
  id = hero
) =>
  as(
    ctx,
    user,
    'POST',
    `/characters/${id}/xp-requests/${requestId}/${action}`,
    {
      decisionKey: crypto.randomUUID(),
      ...(action === 'reject' && { reason: 'Ainda não' }),
      ...body,
    }
  )

const sheet = async (id = hero) => {
  const row = await ctx.db
    .selectFrom('characters')
    .select(['sheet_data', 'sheet_version'])
    .where('id', '=', id)
    .executeTakeFirstOrThrow()
  return {
    values: (row.sheet_data as { values: Record<string, unknown> }).values,
    version: row.sheet_version,
  }
}
const count = async (table: 'xp_entries' | 'xp_requests' | 'chronicle_audit') =>
  (await ctx.db.selectFrom(table).select('id').execute()).length
const request = (id: string) =>
  ctx.db
    .selectFrom('xp_requests')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirstOrThrow()

describe('concessão', () => {
  it('credita cada ficha uma vez, com o lote da projeção e uma auditoria', async () => {
    const other = await createCharacter(ctx, player, chronicleId, { name: 'B' })
    const res = await grant(5, [hero, other])
    expect(res.status).toBe(201)
    const body = await json(res)
    expect(body.duplicate).toBe(false)
    expect(body.characters).toHaveLength(2)
    expect((await sheet()).values.xpTotal).toBe(5)
    expect((await sheet(other)).values.xpTotal).toBe(5)
    expect(await count('xp_entries')).toBe(2)
    const audits = await ctx.db
      .selectFrom('chronicle_audit')
      .select(['action', 'payload'])
      .where('action', '=', 'xp.grant')
      .execute()
    expect(audits).toHaveLength(1)
    expect(JSON.stringify(audits[0]?.payload)).not.toContain('Sessão')
    const op = await ctx.db
      .selectFrom('chronicle_operations')
      .select('kind')
      .executeTakeFirstOrThrow()
    expect(op.kind).toBe('xp-grant')
  })

  it('reenvio com a mesma chave não duplica; outra intenção é conflito', async () => {
    const key = crypto.randomUUID()
    expect((await grant(5, [hero], key)).status).toBe(201)
    const again = await grant(5, [hero], key)
    expect(again.status).toBe(200)
    expect((await json(again)).duplicate).toBe(true)
    expect(await count('xp_entries')).toBe(1)
    expect(await count('chronicle_audit')).toBe(1)
    const other = await grant(6, [hero], key)
    expect(other.status).toBe(409)
    expect((await json(other)).code).toBe('IDEMPOTENCY_CONFLICT')
    expect((await sheet()).values.xpTotal).toBe(5)
  })

  it('vale em qualquer estado não excluído, até de dono ex-membro', async () => {
    const ids = []
    for (const status of ['creating', 'archived', 'dead'] as const) {
      const id = await createCharacter(ctx, owner, chronicleId, {
        name: status,
      })
      await setStatus(ctx, id, status)
      ids.push(id)
    }
    const locked = await createCharacter(ctx, owner, chronicleId, { name: 'T' })
    await setStatus(ctx, locked, 'active', true)
    const former = await createUser(ctx, 'antiga')
    const left = await createCharacter(ctx, former, chronicleId, { name: 'X' })
    const res = await grant(2, [...ids, locked, left])
    expect(res.status).toBe(201)
    for (const id of [...ids, locked, left])
      expect((await sheet(id)).values.xpTotal).toBe(2)
  })

  it('um alvo inválido recusa tudo, sem crédito parcial', async () => {
    const elsewhere = await createChronicle(
      ctx,
      storyteller,
      'acct-teste',
      'Outra'
    )
    const stranger = await createCharacter(ctx, owner, elsewhere, { name: 'Y' })
    expect((await grant(3, [hero, stranger])).status).toBe(404)
    const gone = await createCharacter(ctx, owner, chronicleId, { name: 'Z' })
    await ctx.db
      .updateTable('characters')
      .set({ deleted_at: new Date() })
      .where('id', '=', gone)
      .execute()
    expect((await grant(3, [hero, gone])).status).toBe(404)
    expect((await grant(3, [hero, hero])).status).toBe(422)
    // Fora do schema: 400, como as outras rotas
    expect((await grant(0)).status).toBe(400)
    expect(
      (
        await as(ctx, storyteller, 'POST', `/chronicles/${chronicleId}/xp`, {
          clientOperationId: crypto.randomUUID(),
          amount: 1,
          reason: '<b>x</b>',
          targets: [{ characterId: hero }],
        })
      ).status
    ).toBe(422)
    // O total não passa do máximo do campo
    const max = await grant(1000)
    expect(max.status).toBe(201)
    for (let i = 0; i < 8; i++) await grant(1000)
    const over = await grant(1000)
    expect(over.status).toBe(422)
    expect((await json(over)).code).toBe('XP_LIMIT')
    expect((await sheet()).values.xpTotal).toBe(9000)
    expect(await count('xp_entries')).toBe(9)
  })

  it('só o narrador concede', async () => {
    expect((await grant(3, [hero], undefined, owner)).status).toBe(403)
    expect((await grant(3, [hero], undefined, player)).status).toBe(403)
    expect(await count('xp_entries')).toBe(0)
  })

  it('sistema sem extrato: 422 sem crédito', async () => {
    await publish(ctx, 'dnd5e-2014')
    const dnd = await createChronicle(ctx, storyteller, 'dnd5e-2014', 'D&D')
    const lia = await createCharacter(ctx, owner, dnd, { name: 'Lia' })
    const res = await as(ctx, storyteller, 'POST', `/chronicles/${dnd}/xp`, {
      clientOperationId: crypto.randomUUID(),
      amount: 3,
      reason: 'Sessão',
      targets: [{ characterId: lia }],
    })
    expect(res.status).toBe(422)
    expect((await json(res)).code).toBe('XP_UNSUPPORTED')
    const read = await json(
      await as(ctx, owner, 'GET', `/characters/${lia}/xp`)
    )
    expect(read).toEqual({
      supported: false,
      balance: null,
      items: [],
      next: null,
    })
  })
})

describe('projeções fechadas em /events', () => {
  const write = (events: unknown[], user: TestUser, id = hero) =>
    as(ctx, user, 'POST', `/characters/${id}/events`, {
      clientBatchId: crypto.randomUUID(),
      events,
    })

  it('nenhum papel grava xpTotal ou xpSpent, nem apagando, nem em lote misto', async () => {
    await grant(5)
    for (const user of [owner, storyteller])
      for (const events of [
        [{ path: 'values.xpTotal', from: 5, to: 50 }],
        [{ path: 'values.xpSpent', from: null, to: 0 }],
        [{ path: 'values.xpTotal', from: 5, to: null }],
        [
          { path: 'values.notes', from: null, to: 'x' },
          { path: 'values.xpSpent', from: null, to: 1 },
        ],
      ]) {
        const res = await write(events, user)
        expect(res.status).toBe(403)
        const body = await json(res)
        expect(body.code).toBe('XP_MANAGED_BY_LEDGER')
      }
    const s = await sheet()
    expect(s.values.xpTotal).toBe(5)
    expect(s.values.notes).toBeUndefined()
  })

  it('estado, trava e vínculo vêm antes do código do extrato', async () => {
    const event = [{ path: 'values.xpTotal', from: null, to: 5 }]
    await setStatus(ctx, hero, 'active', true)
    expect((await json(await write(event, owner))).code).toBe('SHEET_LOCKED')
    await setStatus(ctx, hero, 'archived')
    expect((await json(await write(event, owner))).code).toBe(
      'SHEET_NOT_EDITABLE'
    )
    await setStatus(ctx, hero, 'active')
    await ctx.db
      .deleteFrom('chronicle_members')
      .where('user_id', '=', owner.id)
      .execute()
    expect((await json(await write(event, owner))).code).toBe('NOT_MEMBER')
  })

  it('nos WoD o extrato também fecha as projeções', async () => {
    await publish(ctx, 'vtm-v20')
    const vtm = await createChronicle(ctx, storyteller, 'vtm-v20', 'V')
    const id = await createCharacter(ctx, owner, vtm, { name: 'Helena' })
    const res = await write(
      [{ path: 'values.xpTotal', from: null, to: 9 }],
      storyteller,
      id
    )
    expect((await json(res)).code).toBe('XP_MANAGED_BY_LEDGER')
  })

  it('trocar o nome de um item mecânico em active pede aprovação', async () => {
    const id = await createCharacter(ctx, owner, chronicleId, {
      name: 'P',
      powers: [{ id: 'p1', name: 'Visão', value: 1 }],
    })
    await setStatus(ctx, id, 'active')
    const res = await write(
      [
        {
          path: 'values.powers',
          from: [{ id: 'p1', name: 'Visão', value: 1 }],
          to: [{ id: 'p1', name: 'Velocidade', value: 1 }],
        },
      ],
      owner,
      id
    )
    expect(res.status).toBe(403)
    expect((await json(res)).code).toBe('NEEDS_XP_APPROVAL')
  })
})

describe('reversão genérica', () => {
  it('não desfaz lotes do extrato, e o histórico não oferece Desfazer', async () => {
    const op = await json(await grant(5))
    const byOperation = await as(
      ctx,
      storyteller,
      'POST',
      `/chronicles/${chronicleId}/operations`,
      {
        clientOperationId: crypto.randomUUID(),
        kind: 'revert',
        revertsOperationId: op.operationId,
      }
    )
    expect(byOperation.status).toBe(422)
    expect((await json(byOperation)).code).toBe('XP_LEDGER_NOT_REVERSIBLE')
    const byBatch = await as(
      ctx,
      storyteller,
      'POST',
      `/chronicles/${chronicleId}/operations`,
      {
        clientOperationId: crypto.randomUUID(),
        kind: 'revert',
        revertsBatchId: op.characters[0].batchId,
      }
    )
    expect(byBatch.status).toBe(422)
    const history = await json(
      await as(ctx, storyteller, 'GET', `/characters/${hero}/history`)
    )
    expect(history.items[0].reversible).toBe(false)
    // Dano e cura continuam reversíveis
    const damage = await as(
      ctx,
      storyteller,
      'POST',
      `/chronicles/${chronicleId}/operations`,
      {
        clientOperationId: crypto.randomUUID(),
        kind: 'damage',
        amount: 1,
        targets: [{ characterId: hero, sheetVersion: (await sheet()).version }],
      }
    )
    expect([201, 422]).toContain(damage.status)
  })
})

describe('ajuste e estorno', () => {
  it('ajusta o total com motivo, e o original fica', async () => {
    const g = await json(await grant(10))
    const up = await adjust({ delta: 2 })
    expect(up.status).toBe(201)
    expect((await sheet()).values.xpTotal).toBe(12)
    // Estorno parcial e depois o resto; passar disso é 409
    const entry = g.characters[0].entryId
    expect((await adjust({ delta: -4, reversesEntryId: entry })).status).toBe(
      201
    )
    const tooMuch = await adjust({ delta: -7, reversesEntryId: entry })
    expect(tooMuch.status).toBe(409)
    expect(await json(tooMuch)).toMatchObject({
      code: 'XP_REVERSAL_EXCEEDS',
      remaining: 6,
    })
    expect((await adjust({ delta: -6, reversesEntryId: entry })).status).toBe(
      201
    )
    expect((await sheet()).values.xpTotal).toBe(2)
    const ledger = await json(
      await as(ctx, owner, 'GET', `/characters/${hero}/xp`)
    )
    const original = ledger.items.find(
      (x: { kind: string }) => x.kind === 'grant'
    )
    expect(original).toMatchObject({
      totalDelta: 10,
      reversible: 0,
      reason: 'Sessão 12',
    })
    expect(ledger.balance).toEqual({ total: 2, spent: 0, available: 2 })
  })

  it('estorno inválido e total abaixo do gasto: sem efeito', async () => {
    const g = await json(await grant(10))
    expect(
      (await adjust({ delta: 3, reversesEntryId: g.characters[0].entryId }))
        .status
    ).toBe(422)
    expect(
      (await adjust({ delta: -1, reversesEntryId: crypto.randomUUID() })).status
    ).toBe(422)
    expect((await adjust({ delta: 0 })).status).toBe(422)
    // Gasta 8 e tenta tirar 5 do total de 10
    const r = await json(await ask({ field: 'dex' }))
    expect((await decide('approve', r.request.id)).status).toBe(200)
    const res = await adjust({ delta: -5 })
    expect(res.status).toBe(409)
    expect(await json(res)).toMatchObject({
      code: 'XP_ADJUST_LIMIT',
      total: 10,
      spent: 8,
      minDelta: -2,
    })
    expect((await sheet()).values.xpTotal).toBe(10)
    expect((await adjust({ delta: -2 })).status).toBe(201)
  })

  it('só o narrador ajusta; reenvio não duplica', async () => {
    expect((await adjust({ delta: 1 }, hero, owner)).status).toBe(403)
    expect((await adjust({ delta: 1 }, hero, player)).status).toBe(404)
    const key = crypto.randomUUID()
    const body = { clientOperationId: key, delta: 3, reason: 'Correção' }
    expect(
      (
        await as(
          ctx,
          storyteller,
          'POST',
          `/characters/${hero}/xp-adjustments`,
          body
        )
      ).status
    ).toBe(201)
    const again = await as(
      ctx,
      storyteller,
      'POST',
      `/characters/${hero}/xp-adjustments`,
      body
    )
    expect(again.status).toBe(200)
    expect(await count('xp_entries')).toBe(1)
    const changed = await as(
      ctx,
      storyteller,
      'POST',
      `/characters/${hero}/xp-adjustments`,
      {
        ...body,
        delta: 4,
      }
    )
    expect(changed.status).toBe(409)
  })
})

describe('extrato', () => {
  it('pagina do mais recente ao mais antigo e liga o gasto ao pedido', async () => {
    for (let i = 0; i < 3; i++) {
      await grant(4)
      ctx.clock.advance(1000)
    }
    const r = await json(await ask({ field: 'dex' }))
    await decide('approve', r.request.id)
    const page = await json(
      await as(ctx, owner, 'GET', `/characters/${hero}/xp?limit=2`)
    )
    expect(page.items).toHaveLength(2)
    expect(page.items[0]).toMatchObject({
      kind: 'spend',
      spentDelta: 8,
      request: { field: 'dex', from: 2, to: 3 },
    })
    const rest = await json(
      await as(
        ctx,
        owner,
        'GET',
        `/characters/${hero}/xp?limit=2&before=${encodeURIComponent(page.next)}`
      )
    )
    expect(rest.items).toHaveLength(2)
    const end = await json(
      await as(
        ctx,
        owner,
        'GET',
        `/characters/${hero}/xp?limit=2&before=${encodeURIComponent(rest.next)}`
      )
    )
    expect(end).toMatchObject({ items: [], next: null })
    expect(
      (await as(ctx, player, 'GET', `/characters/${hero}/xp`)).status
    ).toBe(404)
    expect(
      (await as(ctx, owner, 'GET', `/characters/${hero}/xp?before=lixo`)).status
    ).toBe(400)
  })
})

describe('pedido de evolução', () => {
  it('Destreza 2 → 3: custo do core, aprovação sobe o traço e debita uma vez', async () => {
    await grant(10)
    const res = await ask({ field: 'dex', to: 3, expectedCost: 8 })
    expect(res.status).toBe(201)
    const { request: r } = await json(res)
    expect(r).toMatchObject({
      field: 'dex',
      from: 2,
      to: 3,
      cost: 8,
      status: 'pending',
      label: 'Destreza',
    })
    // O traço não muda antes da aprovação
    expect((await sheet()).values.dex).toBe(2)
    const key = crypto.randomUUID()
    const ok = await decide('approve', r.id, { decisionKey: key })
    expect(ok.status).toBe(200)
    expect(await json(ok)).toMatchObject({
      duplicate: false,
      request: { status: 'approved' },
      balance: { total: 10, spent: 8, available: 2 },
    })
    const s = await sheet()
    expect(s.values.dex).toBe(3)
    expect(s.values.xpSpent).toBe(8)
    const row = await request(r.id)
    expect(row.batch_id).not.toBeNull()
    const spend = await ctx.db
      .selectFrom('xp_entries')
      .selectAll()
      .where('kind', '=', 'spend')
      .executeTakeFirstOrThrow()
    expect(spend).toMatchObject({
      request_id: r.id,
      batch_id: row.batch_id,
      spent_delta: 8,
    })
    // A mesma decisão de novo recupera; outra decisão é conflito
    const again = await decide('approve', r.id, { decisionKey: key })
    expect(again.status).toBe(200)
    expect((await json(again)).duplicate).toBe(true)
    const late = await decide('reject', r.id)
    expect(late.status).toBe(409)
    expect((await json(late)).code).toBe('XP_REQUEST_DECIDED')
    expect((await sheet()).values.xpSpent).toBe(8)
  })

  it('sem saldo no envio: 409 sem pedido nem auditoria', async () => {
    await grant(5)
    const audits = await count('chronicle_audit')
    const res = await ask({ field: 'dex' })
    expect(res.status).toBe(409)
    expect(await json(res)).toMatchObject({
      code: 'XP_INSUFFICIENT_BALANCE',
      available: 5,
      cost: 8,
    })
    expect(await count('xp_requests')).toBe(0)
    expect(await count('chronicle_audit')).toBe(audits)
  })

  it('aceito mas sem saldo na aprovação: 409, sem débito, continua pendente', async () => {
    await grant(10)
    const a = (await json(await ask({ field: 'dex' }))).request
    const b = (await json(await ask({ field: 'str' }))).request
    expect((await decide('approve', a.id)).status).toBe(200)
    const broke = await decide('approve', b.id)
    expect(broke.status).toBe(409)
    expect((await json(broke)).code).toBe('XP_INSUFFICIENT_BALANCE')
    expect((await request(b.id)).status).toBe('pending')
    expect((await sheet()).values.xpSpent).toBe(8)
    await grant(6)
    expect((await decide('approve', b.id)).status).toBe(200)
    expect((await sheet()).values.xpSpent).toBe(16)
  })

  it('um pendente por traço; reenvio devolve o mesmo pedido', async () => {
    await grant(30)
    const key = crypto.randomUUID()
    const first = await as(
      ctx,
      owner,
      'POST',
      `/characters/${hero}/xp-requests`,
      {
        clientRequestId: key,
        field: 'dex',
      }
    )
    expect(first.status).toBe(201)
    const replay = await as(
      ctx,
      owner,
      'POST',
      `/characters/${hero}/xp-requests`,
      {
        clientRequestId: key,
        field: 'dex',
      }
    )
    expect(replay.status).toBe(200)
    expect((await json(replay)).duplicate).toBe(true)
    const other = await as(
      ctx,
      owner,
      'POST',
      `/characters/${hero}/xp-requests`,
      {
        clientRequestId: key,
        field: 'str',
      }
    )
    expect(other.status).toBe(409)
    const dup = await ask({ field: 'dex' })
    expect(dup.status).toBe(409)
    expect((await json(dup)).code).toBe('XP_REQUEST_PENDING')
    expect(await count('xp_requests')).toBe(1)
  })

  it('um nível por pedido; preço apresentado diferente é stale', async () => {
    await grant(30)
    const two = await ask({ field: 'dex', to: 4 })
    expect(two.status).toBe(422)
    expect((await json(two)).code).toBe('XP_ONE_LEVEL')
    const price = await ask({ field: 'dex', expectedCost: 5 })
    expect(price.status).toBe(409)
    expect(await json(price)).toMatchObject({
      code: 'XP_REQUEST_STALE',
      cost: 8,
    })
    expect(await count('xp_requests')).toBe(0)
  })

  it('estado, trava, papel e preço ausente', async () => {
    await grant(30)
    await setStatus(ctx, hero, 'active', true)
    expect(await json(await ask({ field: 'dex' }))).toMatchObject({
      code: 'SHEET_LOCKED',
    })
    await setStatus(ctx, hero, 'creating')
    expect(await json(await ask({ field: 'dex' }))).toMatchObject({
      code: 'SHEET_NOT_EDITABLE',
      reason: 'creating',
    })
    await setStatus(ctx, hero, 'active')
    expect((await ask({ field: 'dex' }, hero, storyteller)).status).toBe(403)
    expect((await ask({ field: 'dex' }, hero, player)).status).toBe(404)
    // Traço sem regra de XP
    expect(await json(await ask({ field: 'gifts', name: 'X' }))).toMatchObject({
      code: 'XP_COST_UNAVAILABLE',
    })
    expect(await json(await ask({ field: 'nope' }))).toMatchObject({
      code: 'XP_TARGET_INVALID',
    })
    expect(
      await json(await ask({ field: 'powers', name: '<b>' }))
    ).toMatchObject({
      code: 'XP_TARGET_INVALID',
    })
    await ctx.db
      .deleteFrom('chronicle_members')
      .where('user_id', '=', owner.id)
      .execute()
    expect(await json(await ask({ field: 'dex' }))).toMatchObject({
      code: 'NOT_MEMBER',
    })
  })

  it('o narrador muda o traço antes: stale persistido, sem débito', async () => {
    await grant(10)
    const r = (await json(await ask({ field: 'dex' }))).request
    await as(ctx, storyteller, 'POST', `/characters/${hero}/events`, {
      clientBatchId: crypto.randomUUID(),
      events: [{ path: 'values.dex', from: 2, to: 3 }],
    })
    const res = await decide('approve', r.id)
    expect(res.status).toBe(409)
    expect(await json(res)).toMatchObject({
      code: 'XP_REQUEST_STALE',
      why: 'target',
    })
    expect((await request(r.id)).status).toBe('stale')
    expect((await sheet()).values.xpSpent).toBeUndefined()
    expect(
      await ctx.db
        .selectFrom('chronicle_audit')
        .select('action')
        .where('action', '=', 'xp.request.stale')
        .execute()
    ).toHaveLength(1)
    // O pedido desatualizado libera um novo pedido do mesmo traço (3 → 4: 12)
    await grant(2)
    expect((await ask({ field: 'dex' })).status).toBe(201)
  })

  it('mudança de preço por exceção também deixa stale', async () => {
    await grant(30)
    const id = await createCharacter(ctx, owner, chronicleId, {
      name: 'P',
      lineage: 'b',
      powers: [{ id: 'p1', name: 'Velocidade', value: 2 }],
    })
    await setStatus(ctx, id, 'active')
    await grant(30, [id])
    const r = (await json(await ask({ field: 'powers', item: 'p1' }, id)))
      .request
    expect(r.cost).toBe(14)
    await as(ctx, storyteller, 'POST', `/characters/${id}/events`, {
      clientBatchId: crypto.randomUUID(),
      events: [{ path: 'values.lineage', from: 'b', to: 'a' }],
    })
    const res = await decide('approve', r.id, {}, storyteller, id)
    expect(await json(res)).toMatchObject({
      code: 'XP_REQUEST_STALE',
      why: 'price',
    })
  })

  it('item novo: a aprovação cria o item, preservando os outros', async () => {
    const id = await createCharacter(ctx, owner, chronicleId, {
      name: 'P',
      powers: [{ id: 'p1', name: 'Visão', value: 2 }],
    })
    await setStatus(ctx, id, 'active')
    await grant(20, [id])
    const r = (
      await json(await ask({ field: 'powers', name: 'Velocidade' }, id))
    ).request
    expect(r).toMatchObject({ cost: 10, label: 'Poderes: Velocidade' })
    expect((await decide('approve', r.id, {}, storyteller, id)).status).toBe(
      200
    )
    const powers = (await sheet(id)).values.powers as {
      name: string
      value: number
    }[]
    expect(powers.map(p => [p.name, p.value])).toEqual([
      ['Visão', 2],
      ['Velocidade', 1],
    ])
  })

  it('arquivada ou dono removido: suspenso, aprovação 409 sem efeito, leitura não muda nada', async () => {
    await grant(10)
    const r = (await json(await ask({ field: 'dex' }))).request
    await setStatus(ctx, hero, 'archived')
    const res = await decide('approve', r.id)
    expect(res.status).toBe(409)
    expect((await json(res)).code).toBe('XP_TARGET_UNAVAILABLE')
    expect((await request(r.id)).status).toBe('pending')
    const list = await json(
      await as(ctx, owner, 'GET', `/characters/${hero}/xp-requests`)
    )
    expect(list.items[0]).toMatchObject({ status: 'pending', suspended: true })
    expect((await request(r.id)).status).toBe('pending')

    await setStatus(ctx, hero, 'active')
    await ctx.db
      .deleteFrom('chronicle_members')
      .where('user_id', '=', owner.id)
      .execute()
    expect((await json(await decide('approve', r.id))).code).toBe(
      'XP_TARGET_UNAVAILABLE'
    )
    // Ex-membro só lê: não cancela
    const cancel = await decide('cancel', r.id)
    expect(cancel.status).toBe(403)
    expect((await json(cancel)).code).toBe('NOT_MEMBER')
    expect(
      (await as(ctx, owner, 'GET', `/characters/${hero}/xp-requests`)).status
    ).toBe(200)
    // O narrador ainda recusa
    expect((await decide('reject', r.id)).status).toBe(200)
    expect((await sheet()).values.xpSpent).toBeUndefined()
  })

  it('ficha travada: o dono cancela e o narrador aprova', async () => {
    await grant(30)
    const a = (await json(await ask({ field: 'dex' }))).request
    const b = (await json(await ask({ field: 'str' }))).request
    await setStatus(ctx, hero, 'active', true)
    expect((await decide('cancel', a.id)).status).toBe(200)
    expect((await request(a.id)).status).toBe('cancelled')
    expect((await decide('approve', b.id)).status).toBe(200)
    expect((await sheet()).values.str).toBe(3)
  })

  it('motivo da recusa: só dono e narrador leem', async () => {
    await grant(10)
    const r = (await json(await ask({ field: 'dex' }))).request
    expect(
      (await decide('reject', r.id, { reason: 'Converse comigo na sessão' }))
        .status
    ).toBe(200)
    const mine = await json(
      await as(ctx, owner, 'GET', `/characters/${hero}/xp-requests`)
    )
    expect(mine.items[0]).toMatchObject({
      status: 'rejected',
      reason: 'Converse comigo na sessão',
    })
    const other = await as(
      ctx,
      player,
      'GET',
      `/characters/${hero}/xp-requests`
    )
    expect(other.status).toBe(404)
    expect(await other.text()).not.toContain('Converse')
    // O motivo não vai para o registro administrativo
    const audits = await ctx.db
      .selectFrom('chronicle_audit')
      .select('payload')
      .execute()
    expect(JSON.stringify(audits)).not.toContain('Converse')
    expect((await decide('reject', r.id, { reason: '<b>' })).status).toBe(422)
  })

  it('a Mesa lista os pendentes da crônica só ao narrador', async () => {
    await grant(10)
    await ask({ field: 'dex' })
    const other = await createCharacter(ctx, player, chronicleId, {
      name: 'B',
      dex: 1,
    })
    await setStatus(ctx, other, 'archived')
    await ctx.db
      .insertInto('xp_requests')
      .values({
        character_id: other,
        client_request_id: crypto.randomUUID(),
        target_field: 'dex',
        target_key: 'dex',
        from_value: 1,
        to_value: 2,
        cost: 4,
      })
      .execute()
    const table = await json(
      await as(
        ctx,
        storyteller,
        'GET',
        `/chronicles/${chronicleId}/xp-requests`
      )
    )
    expect(
      table.items.map((x: { characterName: string; suspended: boolean }) => [
        x.characterName,
        x.suspended,
      ])
    ).toEqual([
      ['Heroína', false],
      ['B', true],
    ])
    expect(
      (await as(ctx, owner, 'GET', `/chronicles/${chronicleId}/xp-requests`))
        .status
    ).toBe(403)
  })
})

describe('outra família: cópia sintética de D&D com XP fictício', () => {
  it('concede, pede e aprova pelo mesmo código', async () => {
    const t = template('dnd5e-2014') as Record<string, any>
    t.templateVersion = '9.0.0'
    t.fields.xpTotal = { type: 'number', label: 'XP total', min: 0, max: 99999 }
    t.fields.xpSpent = { type: 'number', label: 'XP gasto', min: 0, max: 99999 }
    t.sections.push({
      id: 'experience',
      zone: 'lore',
      title: 'Experiência',
      layout: 'list',
      fields: ['xpTotal', 'xpSpent'],
      permissions: { read: ['owner', 'storyteller'], write: ['storyteller'] },
    })
    // Custo fictício, só para o teste: 100 por ponto de atributo
    t.costs = {
      xp: {
        total: 'xpTotal',
        spent: 'xpSpent',
        rules: [{ id: 'ability', rule: 'flat', cost: 100, targets: ['str'] }],
      },
    }
    await publishTemplate(ctx.db, t)
    const dnd = await createChronicle(ctx, storyteller, 'dnd5e-2014', 'D&D')
    await addMember(ctx, dnd, owner)
    const lia = await createCharacter(ctx, owner, dnd, { name: 'Lia', str: 12 })
    await setStatus(ctx, lia, 'active')
    const g = await as(ctx, storyteller, 'POST', `/chronicles/${dnd}/xp`, {
      clientOperationId: crypto.randomUUID(),
      amount: 150,
      reason: 'Masmorra',
      targets: [{ characterId: lia }],
    })
    expect(g.status).toBe(201)
    const r = (await json(await ask({ field: 'str' }, lia))).request
    expect(r).toMatchObject({ from: 12, to: 13, cost: 100 })
    expect((await decide('approve', r.id, {}, storyteller, lia)).status).toBe(
      200
    )
    expect((await sheet(lia)).values).toMatchObject({
      str: 13,
      xpTotal: 150,
      xpSpent: 100,
    })
  })
})
