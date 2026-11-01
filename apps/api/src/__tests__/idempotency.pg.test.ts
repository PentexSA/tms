/// <reference types="bun-types" />
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { type DB, migrationProvider } from '@tms/db'
import { Kysely, Migrator, PostgresDialect, sql } from 'kysely'
import pg from 'pg'
import { type App, createApp } from '../index'
import { MAX_CHARACTERS_PER_CHRONICLE } from '../sheets/routes'
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

// T-02: dois toques em "Criar ficha" ou "Criar crônica" chegam juntos ao
// servidor. A trava da crônica (ficha) e a do usuário (crônica) serializam os
// pedidos com a mesma chave; o PGLite tem uma conexão só, então a corrida só
// se prova aqui, num banco descartável cujo nome termina em _test.
const URL_ = process.env.PG_TEST_URL

describe.skipIf(!URL_)('criação idempotente num Postgres real', () => {
  let ctx: TestContext
  let storyteller: TestUser
  let owner: TestUser

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
        pool: new pg.Pool({ connectionString: URL_, max: 12 }),
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
    storyteller = await createUser(ctx, 'narradora-idempotencia-pg')
    owner = await createUser(ctx, 'dona-idempotencia-pg')
  })

  afterAll(async () => {
    await ctx?.db.destroy()
  })

  const campaign = async (suffix: string) => {
    const id = await createChronicle(
      ctx,
      storyteller,
      'vtm-v20',
      `Crônica idempotente ${suffix}`
    )
    await addMember(ctx, id, owner)
    return id
  }
  const ownerCharacters = (chronicleId: string) =>
    ctx.db
      .selectFrom('characters')
      .select('id')
      .where('chronicle_id', '=', chronicleId)
      .where('user_id', '=', owner.id)
      .where('deleted_at', 'is', null)
      .execute()
  const createPc = (chronicleId: string, name: string, key: string) =>
    as(ctx, owner, 'POST', `/chronicles/${chronicleId}/characters`, {
      values: { name },
      clientCommandId: key,
    })

  it('quatro pedidos da ficha do jogador com a mesma chave criam uma ficha', async () => {
    const chronicleId = await campaign('pc')
    const key = crypto.randomUUID()
    const responses = await Promise.all(
      Array.from({ length: 4 }, () => createPc(chronicleId, 'Isadora', key))
    )
    expect(responses.map(r => r.status).sort()).toEqual([200, 200, 200, 201])
    const ids = await Promise.all(
      responses.map(async r => ((await r.json()) as { id: string }).id)
    )
    expect(new Set(ids).size).toBe(1)
    expect(await ownerCharacters(chronicleId)).toHaveLength(1)
  })

  it('com 19 fichas, quatro repetições da mesma chave fecham em 20', async () => {
    const chronicleId = await campaign('limite')
    for (let i = 0; i < MAX_CHARACTERS_PER_CHRONICLE - 1; i++)
      await createCharacter(ctx, owner, chronicleId, { name: `F${i}` })
    const key = crypto.randomUUID()
    const responses = await Promise.all(
      Array.from({ length: 4 }, () => createPc(chronicleId, 'Vigésima', key))
    )
    expect(responses.map(r => r.status).sort()).toEqual([200, 200, 200, 201])
    expect(await ownerCharacters(chronicleId)).toHaveLength(
      MAX_CHARACTERS_PER_CHRONICLE
    )
  })

  it('com 19 fichas, duas chaves diferentes: uma cria e a outra bate no limite', async () => {
    const chronicleId = await campaign('duas-chaves')
    for (let i = 0; i < MAX_CHARACTERS_PER_CHRONICLE - 1; i++)
      await createCharacter(ctx, owner, chronicleId, { name: `F${i}` })
    const responses = await Promise.all([
      createPc(chronicleId, 'Uma', crypto.randomUUID()),
      createPc(chronicleId, 'Outra', crypto.randomUUID()),
    ])
    expect(responses.map(r => r.status).sort()).toEqual([201, 422])
    expect(await ownerCharacters(chronicleId)).toHaveLength(
      MAX_CHARACTERS_PER_CHRONICLE
    )
  })
})
