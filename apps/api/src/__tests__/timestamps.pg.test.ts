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

// T-47 com o driver pg, onde as duas origens de data se misturavam: o
// default now() gravava a hora de parede da sessão do banco (UTC) e o Date
// da API, a do processo (Brasília), numa coluna sem fuso. A ficha nova vinha
// 3 h no futuro e passava à frente da editada depois dela. O processo fica em
// America/Sao_Paulo (o Bun aplica o process.env.TZ em tempo de execução) e a
// sessão do Postgres em UTC (-c TimeZone=UTC). Roda no job "postgres" do CI
// com PG_TEST_URL; só aceita banco *_test.
const URL_ = process.env.PG_TEST_URL
const ZONE = 'America/Sao_Paulo'
const MINUTE = 60_000

describe.skipIf(!URL_)('datas com fuso num Postgres real (T-47)', () => {
  let ctx: TestContext
  let storyteller: TestUser
  let owner: TestUser
  let chronicleId: string
  let previousZone: string | undefined

  beforeAll(async () => {
    previousZone = process.env.TZ
    process.env.TZ = ZONE
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
        pool: new pg.Pool({
          connectionString: URL_,
          max: 4,
          options: '-c TimeZone=UTC',
        }),
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
    // Relógio de verdade: o default now() do banco e o Date da API precisam
    // falar do mesmo instante
    const now = () => new Date()
    const tokens = {
      secret: crypto.getRandomValues(new Uint8Array(32)),
      issuer: 'tms-api',
      audience: 'tms-app',
      ttlSeconds: 900,
      now,
    }
    const app: App = createApp(db, { now, tokens })
    ctx = { app, db, clock: fakeClock(), tokens }
    await publish(ctx, 'vtm-v20')
    storyteller = await createUser(ctx, 'narradora-fuso')
    owner = await createUser(ctx, 'dona-fuso')
    chronicleId = await createChronicle(ctx, storyteller)
    await addMember(ctx, chronicleId, owner)
  })

  afterAll(async () => {
    await ctx?.db.destroy()
    if (previousZone === undefined) delete process.env.TZ
    else process.env.TZ = previousZone
  })

  interface Row {
    id: string
    name: string
    updatedAt: string
  }
  const table = async () =>
    (await (
      await as(ctx, storyteller, 'GET', `/chronicles/${chronicleId}/table`)
    ).json()) as Row[]

  it('o processo está fora de UTC e a sessão do banco em UTC', async () => {
    expect(new Date('2026-11-01T15:00:00Z').getHours()).toBe(12)
    const { rows } = await sql<{
      zone: string
    }>`select current_setting('TimeZone') as zone`.execute(ctx.db)
    expect(rows[0]?.zone).toBe('UTC')
  })

  it('ficha recém-criada aparece na Mesa com a hora da criação, em qualquer fuso', async () => {
    const before = Date.now()
    const id = await createCharacter(ctx, owner, chronicleId, {
      name: 'Recém-criada',
    })
    const row = (await table()).find(r => r.id === id)
    const at = new Date(row?.updatedAt ?? 0).getTime()
    expect(Math.abs(at - before)).toBeLessThan(MINUTE)
  })

  // A ficha criada antes e editada depois vem primeiro; com as datas sem
  // fuso, a nova ficava 3 h no futuro e passava à frente
  it('última alteração ordena certo entre ficha nova e editada', async () => {
    const edited = await createCharacter(ctx, owner, chronicleId, {
      name: 'Editada',
      blood: { current: 9 },
    })
    const fresh = await createCharacter(ctx, owner, chronicleId, {
      name: 'Nova',
    })
    // O default now() vem do relógio do Postgres e o Date, do processo: no
    // Docker Desktop a VM anda até centenas de ms à frente. A espera passa
    // dessa diferença, para a ordem depender só do fuso
    await new Promise(resolve => setTimeout(resolve, 1500))
    const batch = await as(ctx, owner, 'POST', `/characters/${edited}/events`, {
      clientBatchId: crypto.randomUUID(),
      events: [
        { path: 'values.blood', from: { current: 9 }, to: { current: 8 } },
      ],
    })
    expect(batch.ok).toBe(true)
    const rows = (await table()).filter(r => r.id === edited || r.id === fresh)
    const newest = [...rows].sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
    expect(newest.map(r => r.name)).toEqual(['Editada', 'Nova'])
    for (const row of rows)
      expect(
        Math.abs(new Date(row.updatedAt).getTime() - Date.now())
      ).toBeLessThan(MINUTE)
  })
})
