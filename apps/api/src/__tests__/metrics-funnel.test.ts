/// <reference types="bun-types" />
// Fase 5a (doc/plano-observabilidade-fase-5.md §2): o relatório confere com
// uma fixture pequena, roda com o role restrito de scripts/metrics-role.sql e
// não imprime ids nem conteúdo, nem no erro.
import { beforeAll, describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { DB } from '@tms/db'
import { type Kysely, sql } from 'kysely'
import {
  ALLOWED_COLUMNS,
  describeError,
  formatText,
  main,
  type Params,
  parseParams,
  type Report,
  readOnlySnapshot,
  runReport,
  UNCLASSIFIED,
  UsageError,
} from '../../../../scripts/metrics-funnel'
import { createTestContext, useTestDb } from '../test/helpers'

useTestDb()

const ROLE_SQL = readFileSync(
  join(import.meta.dir, '../../../../scripts/metrics-role.sql'),
  'utf8'
)
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
const NOW = new Date('2026-11-05T12:00:00Z')
const OCTOBER: Params = {
  from: '2026-10-01',
  to: '2026-11-01',
  timezone: 'America/Sao_Paulo',
  windowDays: 7,
  format: 'json',
  timeoutMs: 30000,
}

/** Horário local de São Paulo (UTC-3, sem horário de verão). */
const sp = (local: string) => new Date(`${local}-03:00`)

async function applyRole(db: Kysely<DB>) {
  await sql`
    do $$ begin
      if not exists (select 1 from pg_roles where rolname = 'tms_metrics')
      then create role tms_metrics nologin; end if;
    end $$`.execute(db)
  const statements = ROLE_SQL.split('\n')
    .filter(l => !l.trimStart().startsWith('--'))
    .join('\n')
    .split(/;\s*$/m)
    .map(s => s.trim())
    .filter(Boolean)
  for (const s of statements) await sql.raw(s).execute(db)
}

/** Roda com o role restrito; o PGLite tem uma conexão só. */
async function asMetrics<T>(db: Kysely<DB>, fn: () => Promise<T>) {
  await sql`set role tms_metrics`.execute(db)
  try {
    return await fn()
  } finally {
    await sql`reset role`.execute(db)
  }
}

interface Fixture {
  readonly db: Kysely<DB>
  /** Todos os ids e textos que o relatório não pode imprimir. */
  readonly secrets: readonly string[]
}

async function fixture(): Promise<Fixture> {
  const { db } = await createTestContext()
  await applyRole(db)
  const secrets: string[] = []
  const system = async (code: string, family: string | null) => {
    const { id } = await db
      .insertInto('game_systems')
      .values({ code, name: `Sistema ${code}`, family })
      .returning('id')
      .executeTakeFirstOrThrow()
    return id
  }
  const wod = await system('metrics-wod', 'wod')
  const d20 = await system('metrics-d20', 'd20')
  const fate = await system('metrics-fate', 'fate')
  const legacy = await system('metrics-legacy', null)

  const user = async (name: string, created: Date) => {
    const email = `${name}.segredo@example.test`
    const { id } = await db
      .insertInto('users')
      .values({
        email,
        username: `${name}_canario`,
        hashed_password: 'hash-canario',
        created_at: created,
      })
      .returning('id')
      .executeTakeFirstOrThrow()
    secrets.push(id, email, `${name}_canario`)
    return id
  }
  // N narra; J joga; K cria e passa a narração para T; D entra e conclui
  // sozinho; R entrou, saiu e voltou; L se cadastra no fim do mês; A
  // cadastra no primeiro instante do período e B no instante em que acaba
  const N = await user('n', sp('2026-10-02T10:00'))
  const J = await user('j', sp('2026-10-02T11:00'))
  const K = await user('k', sp('2026-09-15T10:00'))
  const T = await user('t', sp('2026-09-01T10:00'))
  const D = await user('d', sp('2026-08-01T10:00'))
  const R = await user('r', sp('2026-09-20T10:00'))
  const L = await user('l', sp('2026-10-28T10:00'))
  await user('a', sp('2026-10-01T00:00'))
  await user('b', sp('2026-11-01T00:00'))

  const chronicle = async (storyteller: string, systemId: string) => {
    const name = `Crônica canário ${secrets.length}`
    const { id } = await db
      .insertInto('chronicles')
      .values({ storyteller_id: storyteller, system_id: systemId, name })
      .returning('id')
      .executeTakeFirstOrThrow()
    secrets.push(id, name)
    return id
  }
  const C1 = await chronicle(N, wod)
  const C2 = await chronicle(N, d20)
  const C3 = await chronicle(T, wod)
  const C4 = await chronicle(L, fate)
  const C5 = await chronicle(K, legacy)

  const audit = async (
    chronicleId: string,
    actor: string | null,
    action: string,
    at: Date,
    target: { character?: string; user?: string } = {}
  ) => {
    await db
      .insertInto('chronicle_audit')
      .values({
        chronicle_id: chronicleId,
        actor_id: actor,
        action,
        target_character_id: target.character ?? null,
        target_user_id: target.user ?? null,
        payload: JSON.stringify({ note: 'payload-canario' }),
        created_at: at,
      })
      .execute()
  }
  const member = async (chronicleId: string, userId: string, at: Date) => {
    await db
      .insertInto('chronicle_members')
      .values({ chronicle_id: chronicleId, user_id: userId, joined_at: at })
      .execute()
  }
  const character = async (
    chronicleId: string,
    owner: string,
    systemId: string,
    at: Date,
    kind: 'pc' | 'npc' = 'pc'
  ) => {
    const name = `Ficha canário ${secrets.length}`
    const { id } = await db
      .insertInto('characters')
      .values({
        chronicle_id: chronicleId,
        user_id: owner,
        system_id: systemId,
        name,
        sheet_data: JSON.stringify({ values: { notes: 'nota-canario' } }),
        template_version: '1.0.0',
        kind,
        created_at: at,
      })
      .returning('id')
      .executeTakeFirstOrThrow()
    secrets.push(id, name)
    return id
  }
  const roll = async (
    chronicleId: string,
    characterId: string | null,
    by: string | null,
    at: Date
  ) => {
    await db
      .insertInto('character_rolls')
      .values({
        chronicle_id: chronicleId,
        character_id: characterId,
        client_roll_id: crypto.randomUUID(),
        created_by: by,
        by_role: by === null || characterId === null ? 'storyteller' : 'owner',
        label: 'rolagem-canario',
        request: JSON.stringify({}),
        result: JSON.stringify({ faces: [7] }),
        created_at: at,
      })
      .execute()
  }
  const batch = async (characterId: string, by: string, at: Date) => {
    await db
      .insertInto('character_batches')
      .values({
        character_id: characterId,
        client_batch_id: crypto.randomUUID(),
        created_by: by,
        by_role: 'owner',
        sheet_version: 1,
        created_at: at,
      })
      .execute()
  }

  // Narrador: C1 e convite (e um segundo convite, sem entrada nova), C2 sem
  // convite; K cria C3 e C5 (conta antiga), L cria C4 com a janela aberta
  await audit(C1, N, 'chronicle.create', sp('2026-10-03T10:00'))
  await audit(C1, N, 'invite.create', sp('2026-10-04T10:00'))
  await audit(C1, N, 'invite.create', sp('2026-10-26T10:00'))
  await audit(C2, N, 'chronicle.create', sp('2026-10-20T10:00'))
  await audit(C3, K, 'chronicle.create', sp('2026-10-10T10:00'))
  await audit(C3, K, 'invite.create', sp('2026-10-10T11:00'))
  await audit(C5, K, 'chronicle.create', sp('2026-10-10T12:00'))
  await audit(C4, L, 'chronicle.create', sp('2026-10-29T10:00'))

  // J em C1: rascunho, envio, aprovação do narrador, rolagens de J (duas),
  // do narrador e de uma conta excluída; edições repetidas
  await member(C1, J, sp('2026-10-05T09:00'))
  const P1 = await character(C1, J, wod, sp('2026-10-05T10:00'))
  await batch(P1, J, sp('2026-10-06T09:00'))
  await batch(P1, J, sp('2026-10-06T09:30'))
  await audit(C1, J, 'character.creation.submit', sp('2026-10-06T10:00'), {
    character: P1,
    user: J,
  })
  await audit(C1, N, 'character.creation.approve', sp('2026-10-07T10:00'), {
    character: P1,
    user: J,
  })
  await roll(C1, P1, J, sp('2026-10-08T10:00'))
  await roll(C1, P1, J, sp('2026-10-08T10:05'))
  await roll(C1, P1, N, sp('2026-10-08T11:00'))
  await roll(C1, P1, null, sp('2026-10-09T11:00'))
  // Parada livre do narrador; NPC com rolagem (fora dos funis e das rolagens)
  await roll(C1, null, N, sp('2026-10-08T12:00'))
  const npc = await character(C1, N, wod, sp('2026-10-09T09:00'), 'npc')
  await roll(C1, npc, N, sp('2026-10-09T10:00'))
  // Pedido de XP de uma conta já excluída
  await audit(C1, null, 'xp.request.create', sp('2026-10-15T10:00'), {
    character: P1,
  })

  // J em C2: aviso de criação livre, o narrador conclui e só ele rola
  await member(C2, J, sp('2026-10-21T09:00'))
  const P2 = await character(C2, J, d20, sp('2026-10-21T10:00'))
  await audit(C2, J, 'character.creation.ready', sp('2026-10-22T10:00'), {
    character: P2,
    user: J,
  })
  await audit(C2, N, 'character.creation.complete', sp('2026-10-23T10:00'), {
    character: P2,
    user: J,
  })
  await roll(C2, P2, N, sp('2026-10-23T11:00'))

  // C3: D entra por convite e conclui sozinho; K vira membro ao passar a
  // narração para T (não é aceite)
  await member(C3, D, sp('2026-10-11T09:00'))
  const P4 = await character(C3, D, wod, sp('2026-10-11T10:00'))
  await audit(C3, D, 'character.creation.complete', sp('2026-10-12T10:00'), {
    character: P4,
    user: D,
  })
  // No instante em que o período acaba: fora
  await batch(P4, D, sp('2026-11-01T00:00'))
  const transfer = sp('2026-10-12T15:00')
  await member(C3, K, transfer)
  await audit(C3, T, 'chronicle.transfer.accept', transfer, { user: K })

  // R: a ficha é da entrada anterior; a reentrada guarda só a data nova
  await character(C1, R, wod, sp('2026-10-03T10:00'))
  await member(C1, R, sp('2026-10-25T12:00'))

  return { db, secrets }
}

const report = async (f: Fixture, p: Params = OCTOBER, now = NOW) =>
  asMetrics(f.db, () => runReport(f.db, p, now))

describe('metrics-funnel (Fase 5a)', () => {
  let f: Fixture
  let r: Report

  beforeAll(async () => {
    f = await fixture()
    r = await report(f)
  })

  it('o período é semiaberto, no fuso, e acaba no `to`', () => {
    expect(r.period).toEqual({
      from: '2026-10-01',
      to: '2026-11-01',
      timezone: 'America/Sao_Paulo',
      fromInstant: '2026-10-01T03:00:00.000Z',
      toInstant: '2026-11-01T03:00:00.000Z',
      observedUntil: '2026-11-01T03:00:00.000Z',
      open: false,
    })
    expect(r.extractedAt).toBe(NOW.toISOString())
  })

  it('funil do narrador: cadastro → crônica → convite, na janela', () => {
    // N, J, L e A (B fica fora, no limite); L ainda tem a janela aberta
    expect(r.narrator.signupCohort).toEqual({
      all: { signed_up: 4, created_chronicle: 2, created_invite: 1 },
      mature: { signed_up: 3, created_chronicle: 1, created_invite: 1 },
      matureAccounts: 3,
    })
    expect(r.narrator.anyAccount).toEqual({
      chroniclesCreated: 5,
      invitesCreated: 3,
      peopleWhoCreatedChronicle: 3,
      ofWhichAccountBeforePeriod: 1,
      peopleWhoInvitedToOwnChronicle: 2,
    })
  })

  it('funil do jogador: por vínculo, sem multiplicar fichas e rolagens', () => {
    expect(r.player.all).toEqual({
      joined: 4,
      drafted: 3,
      sent: 2,
      activated: 3,
      activated_by_owner: 1,
      activated_by_other: 2,
      activated_direct: 1,
      player_rolled: 1,
      only_other_rolled: 1,
    })
    // A reentrada de R (25/10) ainda não fechou os 7 dias
    expect(r.player.mature).toEqual({ ...r.player.all, joined: 3 })
    expect(r.player.people).toBe(3)
    expect(r.player.matureMemberships).toBe(3)
    expect(r.player.transfersExcluded).toBe(1)
  })

  it('retenção: só semanas encerradas, coorte pela primeira atividade', () => {
    expect(r.retention).toEqual([
      {
        // N e R; a semana começa em 28/09, antes do período
        week: '2026-09-28',
        size: 2,
        partial: true,
        returns: [
          { k: 1, people: 1 },
          { k: 2, people: 0 },
          { k: 3, people: 1 },
        ],
      },
      {
        // J, K e D (D volta na segunda, 12/10; J em 19/10)
        week: '2026-10-05',
        size: 3,
        partial: false,
        returns: [
          { k: 1, people: 1 },
          { k: 2, people: 1 },
        ],
      },
      // L: a semana de 26/10 só termina depois do período
      { week: '2026-10-26', size: 1, partial: true, returns: [] },
    ])
  })

  it('uso por família, com categoria para o que não é classificável', () => {
    expect(r.families).toEqual([
      {
        family: 'd20',
        people: 2,
        operations: {
          chronicles: 1,
          invites: 0,
          pcs: 1,
          pc_edits: 0,
          pc_rolls: 1,
          free_rolls: 0,
          xp_requests: 0,
        },
      },
      {
        family: 'fate',
        people: 1,
        operations: {
          chronicles: 1,
          invites: 0,
          pcs: 0,
          pc_edits: 0,
          pc_rolls: 0,
          free_rolls: 0,
          xp_requests: 0,
        },
      },
      {
        family: 'wod',
        // N, K, J, R e D; o pedido de XP sem autor conta como operação
        people: 5,
        operations: {
          chronicles: 2,
          invites: 3,
          pcs: 3,
          pc_edits: 2,
          pc_rolls: 4,
          free_rolls: 1,
          xp_requests: 1,
        },
      },
      {
        family: UNCLASSIFIED,
        people: 1,
        operations: {
          chronicles: 1,
          invites: 0,
          pcs: 0,
          pc_edits: 0,
          pc_rolls: 0,
          free_rolls: 0,
          xp_requests: 0,
        },
      },
    ])
  })

  it('mostra o que ficou sem autoria, sem tentar reconstruir', () => {
    expect(r.gaps).toEqual({
      auditSince: { chronicleCreate: '2026-10-03', inviteCreate: '2026-10-04' },
      auditWithoutActor: 1,
      creationWithoutCharacter: 0,
      rollsWithoutAuthor: 1,
      editsWithoutAuthor: 0,
    })
  })

  it('não imprime ids, e-mails, nomes nem conteúdo, em texto ou JSON', () => {
    for (const out of [JSON.stringify(r), formatText(r)]) {
      expect(out).not.toMatch(UUID)
      for (const s of f.secrets) expect(out).not.toContain(s)
      expect(out).not.toContain('canario')
      expect(out).not.toContain('canário')
    }
    expect(formatText(r)).toContain('Com rolagem do próprio jogador')
  })

  it('período ainda aberto: observa até a extração e avisa', async () => {
    const open = await report(
      f,
      { ...OCTOBER, to: '2026-12-01' },
      sp('2026-10-15T00:00')
    )
    expect(open.period.open).toBe(true)
    expect(open.period.observedUntil).toBe('2026-10-15T03:00:00.000Z')
    // Até 15/10: N e J se cadastraram; L ainda não
    expect(open.narrator.signupCohort.all.signed_up).toBe(3)
    expect(formatText(open)).toContain('período ainda aberto')
    // A auditoria de crônica começa depois de 01/10: o texto avisa
    expect(formatText(open)).toContain(
      'crônica 2026-10-03, convite 2026-10-04 (antes disso, zero não é medida)'
    )
  })

  it('o role do script lê exatamente a lista e não escreve', async () => {
    const { rows } = await sql<{ n: number }>`
      select count(*)::int as n from information_schema.column_privileges
      where grantee = 'tms_metrics' and privilege_type = 'SELECT'`.execute(f.db)
    expect(rows[0]?.n).toBe(Object.values(ALLOWED_COLUMNS).flat().length)
    await asMetrics(f.db, async () => {
      await expect(
        sql`select email from users`.execute(f.db)
      ).rejects.toMatchObject({ code: '42501' })
      await expect(
        sql`select payload from chronicle_audit`.execute(f.db)
      ).rejects.toMatchObject({ code: '42501' })
      await expect(
        sql`select sheet_data from characters`.execute(f.db)
      ).rejects.toMatchObject({ code: '42501' })
      await expect(
        sql`update users set created_at = now()`.execute(f.db)
      ).rejects.toMatchObject({ code: '42501' })
    })
  })

  it('escrita dentro da transação do relatório é recusada', async () => {
    // Como superusuário, para provar o modo da transação e não o grant
    await expect(
      readOnlySnapshot(f.db, 1000, trx =>
        sql`delete from chronicle_members`.execute(trx)
      )
    ).rejects.toMatchObject({ code: '25006' })
    const { rows } = await sql<{ n: number }>`
      select count(*)::int as n from chronicle_members`.execute(f.db)
    expect(rows[0]?.n).toBe(5)
  })

  it('recusa a credencial administrativa, sem fallback', async () => {
    // Sem set role: o superusuário do PGLite lê tudo
    const err = await runReport(f.db, OCTOBER, NOW).catch(e => e)
    const msg = describeError(err)
    expect(msg).toStartWith('Recusado: o role lê colunas fora da lista')
    // As sensíveis vêm antes das outras
    expect(msg).toMatch(/fora da lista \(\d+\): characters\.sheet_data, /)
    expect(msg).toContain('users.email, users.hashed_password')
    expect(msg).not.toMatch(UUID)
  })

  it('o erro do banco sai só com o código, sem o texto', () => {
    const e = Object.assign(
      new Error('duplicate key (email)=(n.segredo@example.test)'),
      { code: '23505' }
    )
    expect(describeError(e)).toBe('Falha ao gerar o relatório (23505)')
    expect(describeError(new Error('qualquer coisa com segredo'))).toBe(
      'Falha ao gerar o relatório'
    )
    expect(describeError({ code: '57014' })).toContain('timeout')
  })
})

describe('metrics-funnel: CLI', () => {
  it('valida os argumentos', () => {
    expect(
      parseParams(['--from', '2026-10-01', '--to=2026-11-01', '--format=text'])
    ).toEqual({ ...OCTOBER, format: 'text' })
    const bad = [
      [],
      ['--from', '2026-10-01'],
      ['--from', '2026-10-01', '--to', '2026-10-01'],
      ['--from', '2026-02-30', '--to', '2026-03-01'],
      ['--from', '2026-10-01', '--to', '2026-11-01', '--timezone', 'Lua/Base'],
      ['--from', '2026-10-01', '--to', '2026-11-01', '--window-days', '0'],
      ['--from', '2026-10-01', '--to', '2026-11-01', '--format', 'csv'],
      ['--from', '2026-10-01', '--to', '2026-11-01', '--extra'],
    ]
    for (const argv of bad) expect(() => parseParams(argv)).toThrow(UsageError)
  })

  it('sem METRICS_DATABASE_URL não usa a DATABASE_URL', async () => {
    const err: string[] = []
    let connected = false
    const code = await main({
      argv: ['--from', '2026-10-01', '--to', '2026-11-01'],
      env: { DATABASE_URL: 'postgres://admin@localhost/tms' },
      out: () => undefined,
      err: s => err.push(s),
      connect: () => {
        connected = true
        throw new Error('não devia conectar')
      },
    })
    expect(code).toBe(2)
    expect(connected).toBe(false)
    expect(err.join()).toContain('METRICS_DATABASE_URL')
  })

  it('imprime o JSON e fecha a conexão, também no erro', async () => {
    const f = await fixture()
    let closed = 0
    const out: string[] = []
    const run = (argv: string[]) =>
      asMetrics(f.db, () =>
        main({
          argv,
          env: { METRICS_DATABASE_URL: 'postgres://tms_metrics@x/tms' },
          out: s => out.push(s),
          err: s => out.push(s),
          now: NOW,
          connect: () => ({
            db: f.db,
            close: async () => {
              closed++
            },
          }),
        })
      )
    const ok = await run([
      '--from=2026-10-01',
      '--to=2026-11-01',
      '--format=json',
    ])
    expect(ok).toBe(0)
    expect(JSON.parse(out.join('')).player.people).toBe(3)
    expect(out.join('')).not.toMatch(UUID)
    // Começa depois da extração: erro de uso, conexão fechada mesmo assim
    out.length = 0
    const late = await run(['--from=2026-12-01', '--to=2027-01-01'])
    expect(late).toBe(2)
    expect(out.join('')).toContain('depois da extração')
    expect(closed).toBe(2)
  })
})
