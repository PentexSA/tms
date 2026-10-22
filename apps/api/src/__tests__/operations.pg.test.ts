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

// Operações em grupo concorrentes num Postgres real (doc/plano-v3.md, Etapa
// 11): o PGLite serializa tudo. As fichas são travadas em ordem de id e a
// idempotência é conferida depois das travas. Nenhum cenário termina em
// deadlock (o Postgres o reportaria, e a rota daria 500). Roda no job
// "postgres" do CI com PG_TEST_URL; só aceita banco *_test.
const URL_ = process.env.PG_TEST_URL

describe.skipIf(!URL_)('operações num Postgres real', () => {
  let ctx: TestContext
  let storyteller: TestUser
  let player: TestUser
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
    await publish(ctx, 'vtm-v20')
    storyteller = await createUser(ctx, 'narradora')
    player = await createUser(ctx, 'jogadora')
    chronicleId = await createChronicle(ctx, storyteller)
    await addMember(ctx, chronicleId, player)
  })

  afterAll(async () => {
    await ctx?.db.destroy()
  })

  const unhurt = { aggravated: 0, lethal: 0, bashing: 0 }
  const fresh = (name: string) =>
    createCharacter(ctx, player, chronicleId, { name, health: unhurt })

  const send = (
    targets: { characterId: string; sheetVersion: number }[],
    key = crypto.randomUUID()
  ) =>
    as(ctx, storyteller, 'POST', `/chronicles/${chronicleId}/operations`, {
      clientOperationId: key,
      kind: 'damage',
      type: 'bashing',
      amount: 1,
      targets,
    })

  const health = async (id: string) =>
    (
      (
        await ctx.db
          .selectFrom('characters')
          .select('sheet_data')
          .where('id', '=', id)
          .executeTakeFirstOrThrow()
      ).sheet_data as { values: { health: Record<string, number> } }
    ).values.health

  it('mesma prévia, chaves diferentes: uma aplica; a outra recebe 409 com a prévia nova, e confirmando de novo aplica', async () => {
    const a = await fresh('A')
    const b = await fresh('B')
    const targets = [
      { characterId: a, sheetVersion: 0 },
      { characterId: b, sheetVersion: 0 },
    ]
    const [x, y] = await Promise.all([send(targets), send(targets)])
    expect([x.status, y.status].sort()).toEqual([201, 409])
    expect(await health(a)).toEqual({ ...unhurt, bashing: 1 })
    const loser = x.status === 409 ? x : y
    const { preview } = (await loser.json()) as {
      preview: { characterId: string; sheetVersion: number }[]
    }
    // A perdedora confirma com a prévia do 409
    const again = await send(
      preview.map(p => ({
        characterId: p.characterId,
        sheetVersion: p.sheetVersion,
      }))
    )
    expect(again.status).toBe(201)
    expect(await health(a)).toEqual({ ...unhurt, bashing: 2 })
    expect(await health(b)).toEqual({ ...unhurt, bashing: 2 })
  })

  it('mesma chave ao mesmo tempo: aplica uma vez, e o outro recebe o mesmo resultado', async () => {
    const a = await fresh('C')
    const b = await fresh('D')
    const key = crypto.randomUUID()
    const targets = [
      { characterId: a, sheetVersion: 0 },
      { characterId: b, sheetVersion: 0 },
    ]
    const results = await Promise.all([send(targets, key), send(targets, key)])
    expect(results.map(r => r.status).sort()).toEqual([200, 201])
    const [one, two] = (await Promise.all(results.map(r => r.json()))) as {
      operationId: string
      duplicate: boolean
      characters: unknown[]
    }[]
    expect(one?.operationId).toBe(two?.operationId as string)
    expect(one?.characters).toEqual(two?.characters as unknown[])
    const operations = await ctx.db
      .selectFrom('chronicle_operations')
      .select('id')
      .where('client_operation_id', '=', key)
      .execute()
    expect(operations).toHaveLength(1)
    const batches = await ctx.db
      .selectFrom('character_batches')
      .select('id')
      .where('operation_id', '=', operations[0]?.id as string)
      .execute()
    expect(batches).toHaveLength(2)
    expect(await health(a)).toEqual({ ...unhurt, bashing: 1 })
  })

  it('mesma chave com alvos diferentes: o índice único devolve o resultado original, sem 500', async () => {
    const a = await fresh('Chave A')
    const b = await fresh('Chave B')
    const key = crypto.randomUUID()
    const results = await Promise.all([
      send([{ characterId: a, sheetVersion: 0 }], key),
      send([{ characterId: b, sheetVersion: 0 }], key),
    ])
    expect(results.map(r => r.status).sort()).toEqual([200, 201])
    const [one, two] = (await Promise.all(results.map(r => r.json()))) as {
      operationId: string
      characters: unknown[]
    }[]
    expect(one?.operationId).toBe(two?.operationId as string)
    expect(one?.characters).toEqual(two?.characters as unknown[])
    const h = await Promise.all([health(a), health(b)])
    expect(h.map(v => v.bashing).sort()).toEqual([0, 1])
  })

  it('conjuntos que se cruzam (A, B e C, B), em ordens diferentes: ambas terminam, sem deadlock', async () => {
    for (let round = 0; round < 6; round++) {
      const a = await fresh(`A${round}`)
      const b = await fresh(`B${round}`)
      const c = await fresh(`C${round}`)
      const [x, y] = await Promise.all([
        send([
          { characterId: a, sheetVersion: 0 },
          { characterId: b, sheetVersion: 0 },
        ]),
        send([
          { characterId: c, sheetVersion: 0 },
          { characterId: b, sheetVersion: 0 },
        ]),
      ])
      // A segunda vê a versão nova de B: 409. Nenhuma dá 500
      expect([x.status, y.status].sort()).toEqual([201, 409])
    }
  })
})
