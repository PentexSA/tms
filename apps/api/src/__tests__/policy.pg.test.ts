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

// A política vale o estado de quando o lote chega (doc/plano-v3.md, Etapa 5),
// provado num Postgres real: o PGLite serializa tudo. Concluir a criação e um
// lote de Evoluir ao mesmo tempo: ou o lote entra antes e a conclusão vem
// depois dele, ou é recusado; nunca entra depois. Roda no job "postgres" do
// CI com PG_TEST_URL; o teste apaga o schema, só aceita banco *_test.
const URL_ = process.env.PG_TEST_URL

const ROUNDS = 12

describe.skipIf(!URL_)('política num Postgres real', () => {
  let ctx: TestContext
  let owner: TestUser
  let storyteller: TestUser
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
    // Relógio de verdade: cada transação lê a hora depois de travar a ficha,
    // então a hora gravada diz quem pegou a trava primeiro
    const clock = fakeClock()
    const now = () => new Date()
    const secret = crypto.getRandomValues(new Uint8Array(32))
    const tokens = {
      secret,
      issuer: 'tms-api',
      audience: 'tms-app',
      ttlSeconds: 900,
      now,
    }
    const app: App = createApp(db, { now, tokens })
    ctx = { app, db, clock, tokens }
    await publish(ctx, 'vtm-v20')
    storyteller = await createUser(ctx, 'narradora')
    owner = await createUser(ctx, 'dona')
    chronicleId = await createChronicle(ctx, storyteller)
    await addMember(ctx, chronicleId, owner)
  })

  afterAll(async () => {
    await ctx?.db.destroy()
  })

  it('concluir e um lote de Evoluir ao mesmo tempo: o lote nunca entra depois', async () => {
    const seen = new Set<string>()
    for (let round = 0; round < ROUNDS; round++) {
      const id = await createCharacter(ctx, owner, chronicleId, {
        name: `Ficha ${round}`,
      })
      const [batch, done] = await Promise.all([
        as(ctx, owner, 'POST', `/characters/${id}/events`, {
          clientBatchId: crypto.randomUUID(),
          events: [{ path: 'values.strength', from: null, to: 3 }],
        }),
        as(ctx, storyteller, 'POST', `/characters/${id}/creation/complete`),
      ])
      expect(done.status).toBe(200)
      const row = await ctx.db
        .selectFrom('characters')
        .select(['status', 'sheet_version', 'creation_completed_at'])
        .where('id', '=', id)
        .executeTakeFirstOrThrow()
      expect(row.status).toBe('active')
      if (batch.status === 200) {
        seen.add('antes')
        // Entrou antes: gravado com a ficha em creating, antes da conclusão
        const written = await ctx.db
          .selectFrom('character_batches')
          .select('created_at')
          .where('character_id', '=', id)
          .executeTakeFirstOrThrow()
        expect(row.sheet_version).toBe(1)
        expect(new Date(written.created_at).getTime()).toBeLessThanOrEqual(
          new Date(row.creation_completed_at as Date).getTime()
        )
      } else {
        seen.add('recusado')
        expect(batch.status).toBe(403)
        expect(await batch.json()).toMatchObject({ code: 'NEEDS_XP_APPROVAL' })
        expect(row.sheet_version).toBe(0)
      }
    }
    // Pelo menos um dos dois desfechos aconteceu (o teste rodou de verdade)
    expect(seen.size).toBeGreaterThan(0)
  })
})
