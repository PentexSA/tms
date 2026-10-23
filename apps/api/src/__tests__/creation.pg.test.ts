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

// Concorrência da criação num Postgres real (doc/plano-v4.md §6.3): o PGLite
// serializa tudo. Cada cenário dispara os dois pedidos juntos várias vezes e
// confere que o estado final é um dos desfechos válidos, nunca uma mistura.
// Roda com PG_TEST_URL num banco *_test (o teste apaga o schema).
const URL_ = process.env.PG_TEST_URL

const ROUNDS = 10
const PRIORITIES = {
  priorities: {
    attributes: ['phys', 'soc', 'men'],
    abilities: ['talents', 'knowledges'],
  },
}
// Os mesmos números do teste do core: fecha a conta sem bônus
const COMPLETE = {
  name: 'Teste',
  lineage: 'a',
  str: 3,
  dex: 3,
  sta: 2,
  cha: 2,
  man: 2,
  app: 2,
  per: 2,
  int: 2,
  wit: 1,
  alert: 3,
  brawl: 2,
  lore: 2,
  occult: 1,
  powers: [
    { id: 'p1', name: 'Velocidade', value: 2 },
    { id: 'p2', name: 'Visão', value: 1 },
  ],
  gifts: [
    { id: 'g1', name: 'Um' },
    { id: 'g2', name: 'Dois' },
  ],
  con: 3,
  ctl: 3,
}

describe.skipIf(!URL_)('criação num Postgres real', () => {
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
    await publish(ctx, 'testes/acct-teste')
    storyteller = await createUser(ctx, 'narradora')
    owner = await createUser(ctx, 'dona')
    chronicleId = await createChronicle(ctx, storyteller, 'acct-teste')
  })

  afterAll(async () => {
    await ctx?.db.destroy()
  })

  // Ficha com as prioridades salvas (revisão 1), pronta para concluir
  const ready = async (round: number) => {
    const id = await createCharacter(ctx, owner, chronicleId, {
      ...COMPLETE,
      name: `Ficha ${round}`,
    })
    const saved = await as(ctx, owner, 'PATCH', `/characters/${id}/creation`, {
      revision: 0,
      choices: PRIORITIES,
    })
    expect(saved.status).toBe(200)
    return id
  }
  const state = (id: string) =>
    ctx.db
      .selectFrom('characters')
      .select([
        'status',
        'sheet_data',
        'sheet_version',
        'creation_revision',
        'activated_at',
        'approved_at',
      ])
      .where('id', '=', id)
      .executeTakeFirstOrThrow()
  const str = (row: { sheet_data: unknown }) =>
    (row.sheet_data as { values: { str: number } }).values.str
  const setApproval = async (on: boolean) => {
    const { creation_settings_revision: revision } = await ctx.db
      .selectFrom('chronicles')
      .select('creation_settings_revision')
      .where('id', '=', chronicleId)
      .executeTakeFirstOrThrow()
    const res = await as(
      ctx,
      storyteller,
      'PATCH',
      `/chronicles/${chronicleId}/creation-settings`,
      { revision, approval: on }
    )
    expect(res.status).toBe(200)
  }

  it('concluir × evento: a conclusão vale a ficha efetiva', async () => {
    await addMember(ctx, chronicleId, owner)
    const seen = new Set<string>()
    for (let round = 0; round < ROUNDS; round++) {
      const id = await ready(round)
      // Baixar a Força deixa um básico sobrando: com ela, não conclui
      const [batch, done] = await Promise.all([
        as(ctx, owner, 'POST', `/characters/${id}/events`, {
          clientBatchId: crypto.randomUUID(),
          events: [{ path: 'values.str', from: 3, to: 2 }],
        }),
        as(ctx, owner, 'POST', `/characters/${id}/creation/complete`),
      ])
      const row = await state(id)
      if (batch.status === 200) {
        seen.add('evento antes')
        expect(done.status).toBe(422)
        expect(row.status).toBe('creating')
        expect(str(row)).toBe(2)
      } else {
        seen.add('conclusão antes')
        expect(done.status).toBe(200)
        expect(batch.status).toBe(403)
        expect(await batch.json()).toMatchObject({ code: 'NEEDS_XP_APPROVAL' })
        expect(row.status).toBe('active')
        expect(str(row)).toBe(3)
      }
    }
    expect(seen.size).toBeGreaterThan(0)
  })

  it('concluir × ajuste de orçamento: uma revisão consistente vence', async () => {
    for (let round = 0; round < ROUNDS; round++) {
      const id = await ready(100 + round)
      const [budget, done] = await Promise.all([
        as(ctx, storyteller, 'PATCH', `/characters/${id}/creation`, {
          revision: 1,
          config: { freebies: 20 },
        }),
        as(ctx, owner, 'POST', `/characters/${id}/creation/complete`, {
          revision: 1,
        }),
      ])
      // Nunca os dois: quem chega depois vê a revisão (ou o estado) nova
      expect([budget.status, done.status].sort()).toEqual([200, 409])
      const row = await state(id)
      if (done.status === 200) expect(row.status).toBe('active')
      else expect(row.status).toBe('creating')
      expect(row.creation_revision).toBe(2)
    }
  })

  it('submeter × remoção do dono: nunca ativa nem escreve com vínculo velho', async () => {
    await setApproval(true)
    for (let round = 0; round < ROUNDS; round++) {
      const player = await createUser(ctx, `jogador${round}`)
      await addMember(ctx, chronicleId, player)
      const id = await createCharacter(ctx, player, chronicleId, {
        ...COMPLETE,
        name: `Removida ${round}`,
      })
      await as(ctx, player, 'PATCH', `/characters/${id}/creation`, {
        revision: 0,
        choices: PRIORITIES,
      })
      const [done, removed] = await Promise.all([
        as(ctx, player, 'POST', `/characters/${id}/creation/complete`),
        as(
          ctx,
          storyteller,
          'DELETE',
          `/chronicles/${chronicleId}/members/${player.id}`
        ),
      ])
      expect(removed.status).toBe(204)
      const row = await state(id)
      // A remoção arquiva; a submissão que entrou antes fica arquivada
      expect(row.status).toBe('archived')
      expect(row.activated_at).toBeNull()
      expect([200, 403, 409]).toContain(done.status)
    }
    await setApproval(false)
  })

  it('aprovar × arquivar: uma decisão; arquivada antes não é ativada', async () => {
    await setApproval(true)
    for (let round = 0; round < ROUNDS; round++) {
      const id = await ready(200 + round)
      const sent = await as(
        ctx,
        owner,
        'POST',
        `/characters/${id}/creation/complete`
      )
      expect(await sent.json()).toMatchObject({ status: 'pending' })
      const [approved, archived] = await Promise.all([
        as(ctx, storyteller, 'POST', `/characters/${id}/creation/approve`),
        as(ctx, storyteller, 'POST', `/characters/${id}/status`, {
          status: 'archived',
        }),
      ])
      expect(archived.status).toBe(200)
      const row = await state(id)
      expect(row.status).toBe('archived')
      if (approved.status === 200) expect(row.activated_at).not.toBeNull()
      else {
        expect(approved.status).toBe(409)
        expect(row.activated_at).toBeNull()
        expect(row.approved_at).toBeNull()
      }
    }
    await setApproval(false)
  })

  it('desligar a aprovação × submissão: nenhum pendente é ativado implicitamente', async () => {
    const outcomes = new Set<string>()
    for (let round = 0; round < ROUNDS; round++) {
      await setApproval(true)
      const id = await ready(300 + round)
      const { creation_settings_revision: revision } = await ctx.db
        .selectFrom('chronicles')
        .select('creation_settings_revision')
        .where('id', '=', chronicleId)
        .executeTakeFirstOrThrow()
      const [done, off] = await Promise.all([
        as(ctx, owner, 'POST', `/characters/${id}/creation/complete`),
        as(
          ctx,
          storyteller,
          'PATCH',
          `/chronicles/${chronicleId}/creation-settings`,
          { revision, approval: false }
        ),
      ])
      expect(done.status).toBe(200)
      expect(off.status).toBe(200)
      const row = await state(id)
      const body = (await done.json()) as { status: string }
      // A submissão leu uma aprovação consistente; o que ela gravou fica
      expect(row.status).toBe(body.status)
      outcomes.add(row.status)
      if (row.status === 'pending') expect(row.activated_at).toBeNull()
    }
    expect([...outcomes].every(s => s === 'pending' || s === 'active')).toBe(
      true
    )
  })
})
