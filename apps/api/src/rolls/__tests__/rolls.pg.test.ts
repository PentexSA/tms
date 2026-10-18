/// <reference types="bun-types" />
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { type DB, migrationProvider } from '@tms/db'
import { Kysely, Migrator, PostgresDialect, sql } from 'kysely'
import pg from 'pg'
import { type App, createApp } from '../../index'
import {
  addMember,
  as,
  createCharacter,
  createChronicle,
  createUser,
  publish,
  type TestUser,
} from '../../test/factories'
import { fakeClock, type TestContext } from '../../test/helpers'

// Rolagens concorrentes num Postgres real (doc/plano-v0.md, Etapa 21): a FdV
// é debitada uma vez só. O PGLite tem uma conexão e serializa tudo; o
// SELECT ... FOR UPDATE só é posto à prova aqui. Roda no job "postgres" do
// CI com PG_TEST_URL. Apaga o schema: só aceita banco cujo nome termina em
// _test.
const URL_ = process.env.PG_TEST_URL

describe.skipIf(!URL_)('rolagens concorrentes num Postgres real', () => {
  let ctx: TestContext
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
    const tokens = {
      secret: crypto.getRandomValues(new Uint8Array(32)),
      issuer: 'tms-api',
      audience: 'tms-app',
      ttlSeconds: 900,
      now: clock.now,
    }
    const app: App = createApp(db, { now: clock.now, tokens })
    ctx = { app, db, clock, tokens }
    await publish(ctx, 'vtm-v20')
    const storyteller = await createUser(ctx, 'narradora')
    owner = await createUser(ctx, 'dona')
    chronicleId = await createChronicle(ctx, storyteller)
    await addMember(ctx, chronicleId, owner)
  })

  afterAll(async () => {
    await ctx?.db.destroy()
  })

  const character = (current: number) =>
    createCharacter(ctx, owner, chronicleId, {
      name: 'Helena Varga',
      dexterity: 3,
      willpower: { current, permanent: 7 },
    })
  const willpower = async (id: string) => {
    const row = await ctx.db
      .selectFrom('characters')
      .select(['sheet_data', 'sheet_version'])
      .where('id', '=', id)
      .executeTakeFirstOrThrow()
    return {
      version: row.sheet_version,
      current: (
        row.sheet_data as { values: { willpower: { current: number } } }
      ).values.willpower.current,
    }
  }
  const body = (clientRollId = crypto.randomUUID()) => ({
    clientRollId,
    slots: { attribute: 'dexterity' },
    difficulty: 6,
    boosts: ['willpower'],
  })

  it('o mesmo clientRollId em paralelo rola e cobra uma vez', async () => {
    const id = await character(5)
    const same = body()
    const results = await Promise.all(
      Array.from({ length: 4 }, () =>
        as(ctx, owner, 'POST', `/characters/${id}/rolls`, same)
      )
    )
    expect(results.map(r => r.status).sort()).toEqual([200, 200, 200, 201])
    expect(await willpower(id)).toEqual({ version: 1, current: 4 })
    const rolls = await ctx.db
      .selectFrom('character_rolls')
      .select('id')
      .where('character_id', '=', id)
      .execute()
    expect(rolls).toHaveLength(1)
  })

  it('com 1 de FdV, duas rolagens com boost em paralelo: só uma paga', async () => {
    const id = await character(1)
    const [a, b] = await Promise.all([
      as(ctx, owner, 'POST', `/characters/${id}/rolls`, body()),
      as(ctx, owner, 'POST', `/characters/${id}/rolls`, body()),
    ])
    expect([a.status, b.status].sort()).toEqual([201, 422])
    expect(await willpower(id)).toEqual({ version: 1, current: 0 })
  })
})
