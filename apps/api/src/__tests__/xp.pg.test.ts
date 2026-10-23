/// <reference types="bun-types" />
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { type DB, migrationProvider } from '@tms/db'
import { Kysely, Migrator, PostgresDialect, sql } from 'kysely'
import pg from 'pg'
import { type App, createApp } from '../index'
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
import { fakeClock, type TestContext } from '../test/helpers'

// Extrato e pedidos de XP concorrentes num Postgres real (doc/plano-v4.md
// §6.3): o PGLite serializa tudo. Concessões e ajustes travam as fichas em
// ordem de id; decisões travam o pedido e depois a ficha. Nenhum cenário
// pode terminar em deadlock ou 500, gastar mais que o saldo ou deixar a
// projeção diferente do extrato. Roda no job "postgres" do CI com
// PG_TEST_URL; só aceita banco *_test.
const URL_ = process.env.PG_TEST_URL

describe.skipIf(!URL_)('XP num Postgres real', () => {
  let ctx: TestContext
  let storyteller: TestUser
  let owner: TestUser
  let chronicleId: string

  beforeAll(async () => {
    const url = new URL(URL_ as string)
    const database = url.pathname.slice(1)
    if (!database.endsWith('_test'))
      throw new Error('PG_TEST_URL precisa apontar para um banco *_test')
    const admin = new pg.Client({
      connectionString: new URL('/postgres', url).toString(),
    })
    await admin.connect()
    const exists = await admin.query(
      'select 1 from pg_database where datname = $1',
      [database]
    )
    if (!exists.rowCount)
      await admin.query(`create database "${database.replace(/"/g, '')}"`)
    await admin.end()

    const db = new Kysely<DB>({
      dialect: new PostgresDialect({
        pool: new pg.Pool({ connectionString: URL_, max: 10 }),
      }),
    })
    await sql`drop schema if exists public cascade; create schema public`.execute(
      db
    )
    const { error } = await new Migrator({
      db,
      provider: migrationProvider,
    }).migrateToLatest()
    if (error) throw error
    const clock = fakeClock()
    const secret = crypto.getRandomValues(new Uint8Array(32))
    const tokens = {
      secret,
      issuer: 'tms-api',
      audience: 'tms-app',
      ttlSeconds: 900,
      now: clock.now,
    }
    const app: App = createApp(db, { now: clock.now, tokens })
    ctx = { app, db, clock, tokens }
    await publish(ctx, 'testes/acct-teste')
    storyteller = await createUser(ctx, 'narradora')
    owner = await createUser(ctx, 'dona')
    chronicleId = await createChronicle(ctx, storyteller, 'acct-teste')
    await addMember(ctx, chronicleId, owner)
  })

  afterAll(async () => {
    await ctx?.db.destroy()
  })

  const fresh = async (name: string) => {
    const id = await createCharacter(ctx, owner, chronicleId, {
      name,
      lineage: 'b',
      dex: 2,
      str: 2,
    })
    await setStatus(ctx, id, 'active')
    return id
  }
  const grant = (amount: number, ids: string[], key = crypto.randomUUID()) =>
    as(ctx, storyteller, 'POST', `/chronicles/${chronicleId}/xp`, {
      clientOperationId: key,
      amount,
      reason: 'Sessão',
      targets: ids.map(characterId => ({ characterId })),
    })
  const ask = async (id: string, field: string) =>
    as(ctx, owner, 'POST', `/characters/${id}/xp-requests`, {
      clientRequestId: crypto.randomUUID(),
      field,
    })
  const pending = async (id: string, field: string) => {
    const res = await ask(id, field)
    expect(res.status).toBe(201)
    return ((await res.json()) as { request: { id: string } }).request.id
  }
  const decide = (
    action: 'approve' | 'reject' | 'cancel',
    id: string,
    requestId: string
  ) =>
    as(
      ctx,
      action === 'cancel' ? owner : storyteller,
      'POST',
      `/characters/${id}/xp-requests/${requestId}/${action}`,
      {
        decisionKey: crypto.randomUUID(),
        ...(action === 'reject' && { reason: 'Não' }),
      }
    )
  const code = async (res: Response) =>
    ((await res.clone().json()) as { code?: string }).code
  const values = async (id: string) =>
    (
      (
        await ctx.db
          .selectFrom('characters')
          .select('sheet_data')
          .where('id', '=', id)
          .executeTakeFirstOrThrow()
      ).sheet_data as { values: Record<string, unknown> }
    ).values
  // A projeção da ficha bate com a soma do extrato, e o gasto nunca passa
  const reconciled = async (id: string) => {
    const sums = await ctx.db
      .selectFrom('xp_entries')
      .select(eb => [
        eb.fn.coalesce(eb.fn.sum<string>('total_delta'), eb.lit(0)).as('t'),
        eb.fn.coalesce(eb.fn.sum<string>('spent_delta'), eb.lit(0)).as('s'),
      ])
      .where('character_id', '=', id)
      .executeTakeFirstOrThrow()
    const v = await values(id)
    expect(v.xpTotal ?? 0).toBe(Number(sums.t))
    expect(v.xpSpent ?? 0).toBe(Number(sums.s))
    expect(Number(sums.t)).toBeGreaterThanOrEqual(Number(sums.s))
    return { total: Number(sums.t), spent: Number(sums.s) }
  }
  const status = async (requestId: string) =>
    (
      await ctx.db
        .selectFrom('xp_requests')
        .select('status')
        .where('id', '=', requestId)
        .executeTakeFirstOrThrow()
    ).status

  it('concessão duplicada simultânea: um crédito, o mesmo resultado, uma auditoria', async () => {
    const a = await fresh('A')
    const key = crypto.randomUUID()
    const results = await Promise.all([
      grant(5, [a], key),
      grant(5, [a], key),
      grant(5, [a], key),
    ])
    expect(results.map(r => r.status).sort()).toEqual([200, 200, 201])
    expect(await reconciled(a)).toEqual({ total: 5, spent: 0 })
    const audits = await ctx.db
      .selectFrom('chronicle_audit')
      .select('id')
      .where('action', '=', 'xp.grant')
      .where(sql<boolean>`payload->'characters' ? ${a}`)
      .execute()
    expect(audits).toHaveLength(1)
  })

  it('grupos sobrepostos em ordens diferentes: tudo ou nada, sem deadlock', async () => {
    const ids = [await fresh('B'), await fresh('C'), await fresh('D')]
    const reversed = [...ids].reverse()
    const results = await Promise.all(
      Array.from({ length: 6 }, (_, i) => grant(1, i % 2 ? ids : reversed))
    )
    expect(results.map(r => r.status)).toEqual(Array(6).fill(201))
    for (const id of ids)
      expect(await reconciled(id)).toEqual({ total: 6, spent: 0 })
  })

  it('dois pendentes para o mesmo traço ao mesmo tempo: um fica, o outro 409', async () => {
    const e = await fresh('E')
    await grant(30, [e])
    const results = await Promise.all(
      Array.from({ length: 4 }, () => ask(e, 'dex'))
    )
    const statuses = results.map(r => r.status).sort()
    expect(statuses).toEqual([201, 409, 409, 409])
    for (const r of results.filter(x => x.status === 409))
      expect(await code(r)).toBe('XP_REQUEST_PENDING')
    const rows = await ctx.db
      .selectFrom('xp_requests')
      .select('id')
      .where('character_id', '=', e)
      .where('status', '=', 'pending')
      .execute()
    expect(rows).toHaveLength(1)
  })

  it('duas aprovações do mesmo pedido: uma aplica, a outra 409, débito uma vez', async () => {
    const f = await fresh('F')
    await grant(30, [f])
    const r = await pending(f, 'dex')
    const results = await Promise.all([
      decide('approve', f, r),
      decide('approve', f, r),
      decide('approve', f, r),
    ])
    expect(results.map(x => x.status).sort()).toEqual([200, 409, 409])
    expect(await reconciled(f)).toEqual({ total: 30, spent: 8 })
    expect((await values(f)).dex).toBe(3)
  })

  it('aprovar contra recusar e contra cancelar: uma decisão terminal', async () => {
    for (const other of ['reject', 'cancel'] as const) {
      const g = await fresh(`G-${other}`)
      await grant(30, [g])
      const r = await pending(g, 'dex')
      const [x, y] = await Promise.all([
        decide('approve', g, r),
        decide(other, g, r),
      ])
      expect([x.status, y.status].sort()).toEqual([200, 409])
      const final = await status(r)
      const { spent } = await reconciled(g)
      if (final === 'approved') expect(spent).toBe(8)
      else {
        expect(final).toBe(other === 'reject' ? 'rejected' : 'cancelled')
        expect(spent).toBe(0)
      }
    }
  })

  it('dois traços disputando o mesmo saldo: nunca gasta mais que o disponível', async () => {
    const h = await fresh('H')
    await grant(10, [h])
    const a = await pending(h, 'dex')
    const b = await pending(h, 'str')
    const [x, y] = await Promise.all([
      decide('approve', h, a),
      decide('approve', h, b),
    ])
    expect([x.status, y.status].sort()).toEqual([200, 409])
    const loser = x.status === 409 ? x : y
    expect(await code(loser)).toBe('XP_INSUFFICIENT_BALANCE')
    expect(await reconciled(h)).toEqual({ total: 10, spent: 8 })
    expect([await status(a), await status(b)].sort()).toEqual([
      'approved',
      'pending',
    ])
  })

  it('aprovar contra edição do alvo: evolução anterior válida ou stale, sem débito indevido', async () => {
    const i = await fresh('I')
    await grant(10, [i])
    const r = await pending(i, 'dex')
    const [approve, edit] = await Promise.all([
      decide('approve', i, r),
      as(ctx, storyteller, 'POST', `/characters/${i}/events`, {
        clientBatchId: crypto.randomUUID(),
        events: [{ path: 'values.dex', from: 2, to: 3 }],
      }),
    ])
    const final = await status(r)
    const { spent } = await reconciled(i)
    expect((await values(i)).dex).toBe(3)
    if (final === 'approved') {
      // A aprovação entrou antes: a edição chega com "de" antigo e conflita
      expect(approve.status).toBe(200)
      expect(edit.status).toBe(409)
      expect(spent).toBe(8)
    } else {
      expect(final).toBe('stale')
      expect(approve.status).toBe(409)
      expect(edit.status).toBe(200)
      expect(spent).toBe(0)
    }
  })

  it('aprovar contra concessão e contra remoção: protocolo consistente, sem deadlock', async () => {
    const j = await fresh('J')
    await grant(8, [j])
    const r = await pending(j, 'dex')
    const [approve, more] = await Promise.all([
      decide('approve', j, r),
      grant(5, [j]),
    ])
    expect(approve.status).toBe(200)
    expect(more.status).toBe(201)
    expect(await reconciled(j)).toEqual({ total: 13, spent: 8 })

    const removed = await createUser(ctx, 'removida')
    await addMember(ctx, chronicleId, removed)
    const k = await createCharacter(ctx, removed, chronicleId, {
      name: 'K',
      lineage: 'b',
      dex: 2,
    })
    await setStatus(ctx, k, 'active')
    await grant(10, [k])
    const req = await as(ctx, removed, 'POST', `/characters/${k}/xp-requests`, {
      clientRequestId: crypto.randomUUID(),
      field: 'dex',
    })
    const kr = ((await req.json()) as { request: { id: string } }).request.id
    const [x, y] = await Promise.all([
      decide('approve', k, kr),
      as(
        ctx,
        storyteller,
        'DELETE',
        `/chronicles/${chronicleId}/members/${removed.id}`
      ),
    ])
    expect(y.status).toBe(204)
    if (x.status === 409) {
      expect(await code(x)).toBe('XP_TARGET_UNAVAILABLE')
      expect(await status(kr)).toBe('pending')
      expect((await reconciled(k)).spent).toBe(0)
    } else {
      expect(x.status).toBe(200)
      expect((await reconciled(k)).spent).toBe(8)
    }
  })

  it('ajuste contra aprovação: o total nunca fica abaixo do gasto', async () => {
    const l = await fresh('L')
    await grant(10, [l])
    const r = await pending(l, 'dex')
    const [approve, cut] = await Promise.all([
      decide('approve', l, r),
      as(ctx, storyteller, 'POST', `/characters/${l}/xp-adjustments`, {
        clientOperationId: crypto.randomUUID(),
        delta: -5,
        reason: 'Correção',
      }),
    ])
    const { total, spent } = await reconciled(l)
    if (approve.status === 200) {
      expect(cut.status).toBe(409)
      expect(await code(cut)).toBe('XP_ADJUST_LIMIT')
      expect({ total, spent }).toEqual({ total: 10, spent: 8 })
    } else {
      expect(cut.status).toBe(201)
      expect(await code(approve)).toBe('XP_INSUFFICIENT_BALANCE')
      expect({ total, spent }).toEqual({ total: 5, spent: 0 })
    }
  })

  it('dois estornos da mesma concessão: nunca além do concedido', async () => {
    const m = await fresh('M')
    const g = (await (await grant(10, [m])).json()) as {
      characters: { entryId: string }[]
    }
    const entry = g.characters[0]?.entryId
    const results = await Promise.all(
      [0, 1, 2].map(() =>
        as(ctx, storyteller, 'POST', `/characters/${m}/xp-adjustments`, {
          clientOperationId: crypto.randomUUID(),
          delta: -6,
          reason: 'Estorno',
          reversesEntryId: entry,
        })
      )
    )
    expect(results.map(r => r.status).sort()).toEqual([201, 409, 409])
    expect(await reconciled(m)).toEqual({ total: 4, spent: 0 })
  })
})
