/// <reference types="bun-types" />

import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { createHash } from 'node:crypto'
import { type DB, migrationProvider } from '@tms/db'
import { Kysely, Migrator, PostgresDialect, sql } from 'kysely'
import pg from 'pg'
import {
  createSession,
  rotateSession,
  type SessionConfig,
} from '../auth/sessions'

// A tolerância do token anterior (onda 5, seção 11.6) num Postgres real: o
// PGLite serializa tudo. A rotação trava, na mesma transação e nesta ordem,
// a pessoa, o token apresentado e, na tolerância, o sucessor (FOR UPDATE).
// Apresentações simultâneas do mesmo token anterior: no máximo uma ganha
// token, e as outras caem na detecção de reuso, que revoga a família (fail
// secure). Nenhum cenário termina em deadlock (o Postgres o reportaria como
// erro, e o Promise.all rejeitaria): sem a trava da pessoa primeiro, o token
// anterior e o sucessor apresentados juntos davam 40P01. Roda com
// PG_TEST_URL; só aceita banco *_test.
const URL_ = process.env.PG_TEST_URL

const ROUNDS = 20
const DAY = 24 * 60 * 60_000

describe.skipIf(!URL_)('tolerância do refresh num Postgres real', () => {
  let db: Kysely<DB>
  let userId: string
  // Relógio de verdade: cada rodada leva bem menos que a janela
  const cfg: SessionConfig = {
    now: () => new Date(),
    refreshTtlMs: 30 * DAY,
    familyTtlMs: 90 * DAY,
  }

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

    db = new Kysely<DB>({
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
    const user = await db
      .insertInto('users')
      .values({
        email: 'sessao@example.test',
        username: 'sessao',
        hashed_password: 'sem-uso',
      })
      .returning('id')
      .executeTakeFirstOrThrow()
    userId = user.id
  })

  afterAll(async () => {
    await db?.destroy()
  })

  // T do login girado para S, que o cliente não chegou a receber
  const rotated = async () => {
    const old = await createSession(db, cfg, userId)
    const next = await rotateSession(db, cfg, old)
    if (!next) throw new Error('a rotação inicial falhou')
    return { old, successor: next.refreshToken }
  }

  const familyAlive = async (raw: string) => {
    const hash = createHash('sha256').update(raw).digest('hex')
    const rows = await db
      .selectFrom('refresh_tokens as t')
      .innerJoin('refresh_tokens as f', 'f.family_id', 't.family_id')
      .select('f.id')
      .where('t.token_hash', '=', hash)
      .where('f.revoked_at', 'is', null)
      .execute()
    return rows.length
  }

  for (const parallel of [2, 5]) {
    it(`${parallel} apresentações simultâneas do token anterior: só uma ganha token, e a família cai`, async () => {
      for (let round = 0; round < ROUNDS; round++) {
        const { old, successor } = await rotated()
        const results = await Promise.all(
          Array.from({ length: parallel }, () => rotateSession(db, cfg, old))
        )
        const winners = results.filter(r => r !== null)
        expect(winners).toHaveLength(1)
        // As perdedoras viram reuso: a família inteira foi revogada, e nem o
        // token que a vencedora recebeu nem S renovam mais
        expect(await familyAlive(old)).toBe(0)
        expect(await rotateSession(db, cfg, successor)).toBeNull()
        expect(
          await rotateSession(db, cfg, winners[0]?.refreshToken ?? '')
        ).toBeNull()
      }
    })
  }

  it('o token anterior e o sucessor ao mesmo tempo: só um ganha token, e a família cai', async () => {
    for (let round = 0; round < ROUNDS; round++) {
      const { old, successor } = await rotated()
      const results = await Promise.all([
        rotateSession(db, cfg, old),
        rotateSession(db, cfg, successor),
      ])
      expect(results.filter(r => r !== null)).toHaveLength(1)
      // Quem chegou depois encontrou S já usado (ou revogado pela
      // tolerância, sem sucessor) e revogou a família
      expect(await familyAlive(old)).toBe(0)
    }
  })
})
