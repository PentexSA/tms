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

// Disputas próprias da v5. PGLite não oferece conexões independentes, então
// este arquivo só roda com um banco descartável cujo nome termina em _test.
const URL_ = process.env.PG_TEST_URL

describe.skipIf(!URL_)('bastidores concorrentes num Postgres real', () => {
  let ctx: TestContext
  let storyteller: TestUser
  let recipient: TestUser
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
    storyteller = await createUser(ctx, 'narradora-backstage-pg')
    recipient = await createUser(ctx, 'destinataria-backstage-pg')
    owner = await createUser(ctx, 'dona-backstage-pg')
  })

  afterAll(async () => {
    await ctx?.db.destroy()
  })

  const campaign = async (suffix: string) => {
    const id = await createChronicle(
      ctx,
      storyteller,
      'vtm-v20',
      `Crônica concorrente ${suffix}`
    )
    await addMember(ctx, id, recipient)
    await addMember(ctx, id, owner)
    return id
  }

  it('criação duplicada de NPC produz uma ficha e uma auditoria', async () => {
    const chronicleId = await campaign('npc')
    const body = {
      kind: 'npc',
      clientCommandId: crypto.randomUUID(),
      values: { name: 'NPC único' },
    }
    const responses = await Promise.all(
      Array.from({ length: 4 }, () =>
        as(
          ctx,
          storyteller,
          'POST',
          `/chronicles/${chronicleId}/characters`,
          body
        )
      )
    )
    expect(responses.map(response => response.status).sort()).toEqual([
      200, 200, 200, 201,
    ])
    const characters = await ctx.db
      .selectFrom('characters')
      .select('id')
      .where('chronicle_id', '=', chronicleId)
      .where('kind', '=', 'npc')
      .execute()
    const audits = await ctx.db
      .selectFrom('chronicle_audit')
      .select('id')
      .where('chronicle_id', '=', chronicleId)
      .where('action', '=', 'character.create-npc')
      .execute()
    expect(characters).toHaveLength(1)
    expect(audits).toHaveLength(1)
  })

  it('duas visibilidades na mesma revisão têm uma vencedora', async () => {
    const chronicleId = await campaign('visibilidade')
    const npc = await as(
      ctx,
      storyteller,
      'POST',
      `/chronicles/${chronicleId}/characters`,
      {
        kind: 'npc',
        clientCommandId: crypto.randomUUID(),
        values: { name: 'NPC disputado' },
      }
    )
    const { id } = (await npc.json()) as { id: string }
    const responses = await Promise.all(
      (['identity', 'full'] as const).map(visibility =>
        as(ctx, storyteller, 'POST', `/characters/${id}/visibility`, {
          clientCommandId: crypto.randomUUID(),
          revision: 0,
          visibility,
        })
      )
    )
    expect(responses.map(response => response.status).sort()).toEqual([
      200, 409,
    ])
    const row = await ctx.db
      .selectFrom('characters')
      .select(['visibility', 'visibility_revision'])
      .where('id', '=', id)
      .executeTakeFirstOrThrow()
    expect(['identity', 'full']).toContain(row.visibility)
    expect(row.visibility_revision).toBe(1)
  })

  it('a mesma chave em fichas distintas grava um resultado e um conflito', async () => {
    const chronicleId = await campaign('rolagens')
    const first = await createCharacter(ctx, owner, chronicleId, {
      name: 'Primeira ficha',
      dexterity: 2,
    })
    const second = await createCharacter(ctx, recipient, chronicleId, {
      name: 'Segunda ficha',
      dexterity: 2,
    })
    const key = crypto.randomUUID()
    const responses = await Promise.all(
      [first, second].map(id =>
        as(ctx, storyteller, 'POST', `/characters/${id}/rolls`, {
          clientRollId: key,
          slots: { attribute: 'dexterity' },
          difficulty: 6,
          hidden: true,
        })
      )
    )
    expect(responses.map(response => response.status).sort()).toEqual([
      201, 409,
    ])
    const rolls = await ctx.db
      .selectFrom('character_rolls')
      .select('id')
      .where('chronicle_id', '=', chronicleId)
      .where('client_roll_id', '=', key)
      .execute()
    expect(rolls).toHaveLength(1)
  })

  it('transferência serializa com a autoridade antiga e preserva o NPC', async () => {
    const oldStoryteller = await createUser(
      ctx,
      'antiga-narradora-backstage-pg'
    )
    const chronicleId = await createChronicle(
      ctx,
      oldStoryteller,
      'vtm-v20',
      'Crônica concorrente transferência'
    )
    await addMember(ctx, chronicleId, recipient)
    await addMember(ctx, chronicleId, owner)
    const target = await createCharacter(ctx, owner, chronicleId, {
      name: 'Alvo da operação',
      health: { aggravated: 0, lethal: 0, bashing: 0 },
    })
    const npc = await createCharacter(ctx, oldStoryteller, chronicleId, {
      name: 'NPC preservado',
    })
    await ctx.db
      .updateTable('characters')
      .set({ kind: 'npc' })
      .where('id', '=', npc)
      .execute()
    const proposed = await as(
      ctx,
      oldStoryteller,
      'POST',
      `/chronicles/${chronicleId}/transfer`,
      { clientCommandId: crypto.randomUUID(), recipientId: recipient.id }
    )
    const transfer = (await proposed.json()) as { id: string }
    const [accepted, operation] = await Promise.all([
      as(
        ctx,
        recipient,
        'POST',
        `/chronicles/${chronicleId}/transfer/${transfer.id}/accept`,
        { clientCommandId: crypto.randomUUID() }
      ),
      as(ctx, oldStoryteller, 'POST', `/chronicles/${chronicleId}/operations`, {
        clientOperationId: crypto.randomUUID(),
        kind: 'damage',
        amount: 1,
        type: 'bashing',
        targets: [{ characterId: target, sheetVersion: 0 }],
      }),
    ])
    expect(accepted.status).toBe(200)
    expect([201, 404]).toContain(operation.status)
    expect(
      (
        await as(
          ctx,
          oldStoryteller,
          'POST',
          `/chronicles/${chronicleId}/operations/preview`,
          {
            kind: 'damage',
            amount: 1,
            type: 'bashing',
            targets: [{ characterId: target }],
          }
        )
      ).status
    ).toBe(403)
    const moved = await ctx.db
      .selectFrom('characters')
      .select('user_id')
      .where('id', '=', npc)
      .executeTakeFirstOrThrow()
    expect(moved.user_id).toBe(recipient.id)
    await ctx.db
      .deleteFrom('users')
      .where('id', '=', oldStoryteller.id)
      .execute()
    expect(
      await ctx.db
        .selectFrom('characters')
        .select('id')
        .where('id', '=', npc)
        .executeTakeFirst()
    ).toEqual({ id: npc })
  })

  // Cada disputa roda em várias crônicas: a ordem das transações varia
  const ROUNDS = 6

  const proposeTo = async (chronicleId: string, user = recipient) => {
    const res = await as(
      ctx,
      storyteller,
      'POST',
      `/chronicles/${chronicleId}/transfer`,
      { clientCommandId: crypto.randomUUID(), recipientId: user.id }
    )
    expect(res.status).toBe(201)
    return ((await res.json()) as { id: string }).id
  }
  const decision = (
    user: TestUser,
    chronicleId: string,
    transferId: string,
    action: 'accept' | 'cancel'
  ) =>
    as(
      ctx,
      user,
      'POST',
      `/chronicles/${chronicleId}/transfer/${transferId}/${action}`,
      { clientCommandId: crypto.randomUUID() }
    )
  const stateOf = async (chronicleId: string, transferId: string) => ({
    storyteller: (
      await ctx.db
        .selectFrom('chronicles')
        .select('storyteller_id')
        .where('id', '=', chronicleId)
        .executeTakeFirstOrThrow()
    ).storyteller_id,
    status: (
      await ctx.db
        .selectFrom('chronicle_transfers')
        .select('status')
        .where('id', '=', transferId)
        .executeTakeFirstOrThrow()
    ).status,
    members: (
      await ctx.db
        .selectFrom('chronicle_members')
        .select('user_id')
        .where('chronicle_id', '=', chronicleId)
        .execute()
    )
      .map(row => row.user_id)
      .sort(),
    decisions: Number(
      (
        await ctx.db
          .selectFrom('chronicle_audit')
          .select(eb => eb.fn.countAll<string>().as('n'))
          .where('chronicle_id', '=', chronicleId)
          .where('action', 'in', [
            'chronicle.transfer.accept',
            'chronicle.transfer.cancel',
          ])
          .executeTakeFirstOrThrow()
      ).n
    ),
  })

  it('aceite contra cancelamento: uma decisão terminal e uma troca', async () => {
    for (let round = 0; round < ROUNDS; round++) {
      const chronicleId = await campaign(`aceite-cancela-${round}`)
      const transferId = await proposeTo(chronicleId)
      const [accept, cancel] = await Promise.all([
        decision(recipient, chronicleId, transferId, 'accept'),
        decision(storyteller, chronicleId, transferId, 'cancel'),
      ])
      const state = await stateOf(chronicleId, transferId)
      expect(state.decisions).toBe(1)
      if (accept.status === 200) {
        // Depois do aceite, quem cancela já não narra: 404
        expect(cancel.status).toBe(404)
        expect(state).toMatchObject({
          storyteller: recipient.id,
          status: 'accepted',
          members: [storyteller.id, owner.id].sort(),
        })
      } else {
        expect(accept.status).toBe(409)
        expect(cancel.status).toBe(200)
        expect(state).toMatchObject({
          storyteller: storyteller.id,
          status: 'cancelled',
          members: [recipient.id, owner.id].sort(),
        })
      }
    }
  })

  it('aceite contra a saída do destinatário: nunca uma troca parcial', async () => {
    for (let round = 0; round < ROUNDS; round++) {
      const chronicleId = await campaign(`aceite-sai-${round}`)
      const transferId = await proposeTo(chronicleId)
      const [accept, leave] = await Promise.all([
        decision(recipient, chronicleId, transferId, 'accept'),
        as(ctx, recipient, 'DELETE', `/chronicles/${chronicleId}/members/me`),
      ])
      expect(accept.status).not.toBe(500)
      expect(leave.status).not.toBe(500)
      const state = await stateOf(chronicleId, transferId)
      if (accept.status === 200) {
        // Narrando, já não é membro para sair
        expect(leave.status).not.toBe(204)
        expect(state).toMatchObject({
          storyteller: recipient.id,
          status: 'accepted',
          members: [storyteller.id, owner.id].sort(),
        })
      } else {
        expect(accept.status).toBe(409)
        expect(leave.status).toBe(204)
        expect(state).toMatchObject({
          storyteller: storyteller.id,
          status: 'pending',
          members: [owner.id],
          decisions: 0,
        })
      }
    }
  })

  it('aceite contra a configuração do narrador antigo', async () => {
    for (let round = 0; round < ROUNDS; round++) {
      const chronicleId = await campaign(`aceite-config-${round}`)
      const transferId = await proposeTo(chronicleId)
      const [accept, settings] = await Promise.all([
        decision(recipient, chronicleId, transferId, 'accept'),
        as(ctx, storyteller, 'PATCH', `/chronicles/${chronicleId}`, {
          clientCommandId: crypto.randomUUID(),
          revision: 0,
          name: `Renomeada ${round}`,
        }),
      ])
      expect(accept.status).toBe(200)
      // Antes da troca grava; depois, a autoridade antiga não passa
      expect([200, 403]).toContain(settings.status)
      const row = await ctx.db
        .selectFrom('chronicles')
        .select(['name', 'storyteller_id', 'settings_revision'])
        .where('id', '=', chronicleId)
        .executeTakeFirstOrThrow()
      expect(row.storyteller_id).toBe(recipient.id)
      expect(row.settings_revision).toBe(settings.status === 200 ? 1 : 0)
    }
  })

  it('duas edições da sessão na mesma revisão: uma vence, nada se perde', async () => {
    const chronicleId = await campaign('sessao')
    for (let round = 0; round < ROUNDS; round++) {
      const created = await as(
        ctx,
        storyteller,
        'POST',
        `/chronicles/${chronicleId}/sessions`,
        {
          clientCommandId: crypto.randomUUID(),
          date: '2026-10-23',
          title: `Sessão ${round}`,
        }
      )
      const { id } = (await created.json()) as { id: string }
      const edit = (title: string) =>
        as(
          ctx,
          storyteller,
          'PATCH',
          `/chronicles/${chronicleId}/sessions/${id}`,
          {
            clientCommandId: crypto.randomUUID(),
            revision: 0,
            date: '2026-10-23',
            title,
          }
        )
      const results = await Promise.all([edit('Versão A'), edit('Versão B')])
      expect(results.map(r => r.status).sort()).toEqual([200, 409])
      const winner = results.find(r => r.status === 200) as Response
      const row = await ctx.db
        .selectFrom('chronicle_sessions')
        .select(['title', 'revision'])
        .where('id', '=', id)
        .executeTakeFirstOrThrow()
      expect(row).toEqual({
        title: ((await winner.json()) as { title: string }).title,
        revision: 1,
      })
    }
  })
})
