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
  type TestUser,
} from '../test/factories'
import { fakeClock, type TestContext } from '../test/helpers'

// Concorrência de verdade (doc/plano-v0.md, Etapa 15): o PGLite tem uma
// conexão só e serializa tudo, então o SELECT ... FOR UPDATE só é posto à
// prova num Postgres real. Roda no job "postgres" do CI com PG_TEST_URL.
// O teste apaga o schema: só aceita banco cujo nome termina em _test.
const URL_ = process.env.PG_TEST_URL

describe.skipIf(!URL_)('eventos concorrentes num Postgres real', () => {
  let ctx: TestContext
  let owner: TestUser
  let storyteller: TestUser
  let characterId: string

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
    await publish(ctx, 'vtm-v20')
    storyteller = await createUser(ctx, 'narradora')
    owner = await createUser(ctx, 'dona')
    const chronicleId = await createChronicle(ctx, storyteller)
    await addMember(ctx, chronicleId, owner)
    characterId = await createCharacter(ctx, owner, chronicleId, {
      name: 'Helena Varga',
      blood: { current: 9 },
    })
  })

  afterAll(async () => {
    await ctx?.db.destroy()
  })

  const send = (user: TestUser, to: number, clientBatchId: string) =>
    as(ctx, user, 'POST', `/characters/${characterId}/events`, {
      clientBatchId,
      events: [
        { path: 'values.blood', from: { current: 9 }, to: { current: to } },
      ],
    })

  it('dois lotes com o mesmo from: um aplica, o outro é 409', async () => {
    const [a, b] = await Promise.all([
      send(owner, 8, crypto.randomUUID()),
      send(storyteller, 7, crypto.randomUUID()),
    ])
    expect([a.status, b.status].sort()).toEqual([200, 409])
    const row = await ctx.db
      .selectFrom('characters')
      .select(['sheet_version', 'sheet_data'])
      .where('id', '=', characterId)
      .executeTakeFirstOrThrow()
    expect(row.sheet_version).toBe(1)
    const events = await ctx.db
      .selectFrom('character_events')
      .select('to_value')
      .execute()
    expect(events).toHaveLength(1)
    expect(
      (row.sheet_data as { values: { blood: unknown } }).values.blood
    ).toEqual(events[0]?.to_value)
  })

  it('o mesmo lote em paralelo é aplicado uma vez (idempotência)', async () => {
    const id = crypto.randomUUID()
    const from = { current: (await currentBlood()) as number }
    const body = {
      clientBatchId: id,
      events: [
        { path: 'values.blood', from, to: { current: from.current - 1 } },
      ],
    }
    const results = await Promise.all(
      Array.from({ length: 4 }, () =>
        as(ctx, owner, 'POST', `/characters/${characterId}/events`, body)
      )
    )
    expect(results.map(r => r.status)).toEqual([200, 200, 200, 200])
    const bodies = (await Promise.all(results.map(r => r.json()))) as {
      duplicate: boolean
    }[]
    expect(bodies.filter(b => !b.duplicate)).toHaveLength(1)
    const batches = await ctx.db
      .selectFrom('character_batches')
      .select('id')
      .where('client_batch_id', '=', id)
      .execute()
    expect(batches).toHaveLength(1)
  })

  async function currentBlood() {
    const row = await ctx.db
      .selectFrom('characters')
      .select('sheet_data')
      .where('id', '=', characterId)
      .executeTakeFirstOrThrow()
    return (row.sheet_data as { values: { blood: { current: number } } }).values
      .blood.current
  }
})
