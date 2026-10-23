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
  setStatus,
  type TestUser,
} from '../test/factories'
import { fakeClock, type TestContext } from '../test/helpers'

// O protocolo de trava do vínculo (doc/plano-v3.md, Etapa 7), num Postgres
// real: o PGLite serializa tudo. Quem depende do vínculo trava primeiro a
// linha de chronicle_members e depois as fichas, em ordem de id; quem trava
// uma ficha nunca espera pelo vínculo. Nenhum cenário termina em deadlock
// (o Postgres o reportaria como erro, e a rota daria 500). Roda no job
// "postgres" do CI com PG_TEST_URL; só aceita banco *_test.
const URL_ = process.env.PG_TEST_URL

const ROUNDS = 8

describe.skipIf(!URL_)('membros num Postgres real', () => {
  let ctx: TestContext
  let storyteller: TestUser
  let chronicleId: string
  let n = 0

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
    // Relógio de verdade: a hora gravada diz quem pegou a trava primeiro
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
    chronicleId = await createChronicle(ctx, storyteller)
  })

  afterAll(async () => {
    await ctx?.db.destroy()
  })

  const newMember = async () => {
    const user = await createUser(ctx, `jogador${++n}`)
    await addMember(ctx, chronicleId, user)
    return user
  }
  const remove = (user: TestUser) =>
    as(
      ctx,
      storyteller,
      'DELETE',
      `/chronicles/${chronicleId}/members/${user.id}`,
      { revokeInvites: false }
    )
  const create = (user: TestUser, name: string) =>
    as(ctx, user, 'POST', `/chronicles/${chronicleId}/characters`, {
      values: { name },
    })
  const sheetsOf = (user: TestUser) =>
    ctx.db
      .selectFrom('characters')
      .select(['id', 'status'])
      .where('user_id', '=', user.id)
      .where('deleted_at', 'is', null)
      .execute()

  it('criar ficha e remover a mesma pessoa: nunca sobra ficha creating de quem saiu', async () => {
    for (let round = 0; round < ROUNDS; round++) {
      const user = await newMember()
      const [created, removed] = await Promise.all([
        create(user, `Ficha ${round}`),
        remove(user),
      ])
      expect(removed.status).toBe(204)
      const sheets = await sheetsOf(user)
      if (created.status === 201) {
        // Nasceu antes: a remoção a arquivou
        expect(sheets).toHaveLength(1)
        expect(sheets[0]?.status).toBe('archived')
      } else {
        expect(created.status).toBe(403)
        expect(await created.json()).toMatchObject({ code: 'NOT_MEMBER' })
        expect(sheets).toEqual([])
      }
    }
  })

  it('um lote do jogador e a remoção: o lote entra antes, ou é recusado com NOT_MEMBER', async () => {
    for (let round = 0; round < ROUNDS; round++) {
      const user = await newMember()
      const id = await createCharacter(ctx, user, chronicleId, {
        name: `Ficha ${round}`,
      })
      await setStatus(ctx, id, 'active')
      const [batch, removed] = await Promise.all([
        as(ctx, user, 'POST', `/characters/${id}/events`, {
          clientBatchId: crypto.randomUUID(),
          events: [{ path: 'values.concept', from: null, to: 'Arquivista' }],
        }),
        remove(user),
      ])
      expect(removed.status).toBe(204)
      const row = await ctx.db
        .selectFrom('characters')
        .select(['status', 'sheet_version'])
        .where('id', '=', id)
        .executeTakeFirstOrThrow()
      expect(row.status).toBe('archived')
      if (batch.status === 200) {
        expect(row.sheet_version).toBe(1)
        // Entrou antes da remoção
        const [written, audited] = await Promise.all([
          ctx.db
            .selectFrom('character_batches')
            .select('created_at')
            .where('character_id', '=', id)
            .executeTakeFirstOrThrow(),
          ctx.db
            .selectFrom('chronicle_audit')
            .select('created_at')
            .where('target_user_id', '=', user.id)
            .executeTakeFirstOrThrow(),
        ])
        expect(new Date(written.created_at).getTime()).toBeLessThanOrEqual(
          new Date(audited.created_at).getTime()
        )
      } else {
        expect(batch.status).toBe(403)
        expect(await batch.json()).toMatchObject({ code: 'NOT_MEMBER' })
        expect(row.sheet_version).toBe(0)
      }
    }
  })

  it('duas criações da mesma pessoa no limite: só uma passa', async () => {
    const user = await newMember()
    for (let i = 0; i < MAX_CHARACTERS_PER_CHRONICLE - 1; i++)
      await createCharacter(ctx, user, chronicleId, { name: `Ficha ${i}` })
    const results = await Promise.all([
      create(user, 'Penúltima'),
      create(user, 'Última'),
    ])
    expect(results.map(r => r.status).sort()).toEqual([201, 422])
    expect(await sheetsOf(user)).toHaveLength(MAX_CHARACTERS_PER_CHRONICLE)
  })
})
