/// <reference types="bun-types" />
// S-04: o seed do roteiro termina com a API em processo, uma instância por
// conta, nos limites padrão e sem TRUST_PROXY. Antes, os 13 aceites de
// convite passavam do limite de 10 por IP (o IP simulado no X-Forwarded-For
// só valia com TRUST_PROXY=true).
import { afterAll, beforeAll, describe, expect, it, spyOn } from 'bun:test'
import {
  type CreationChoices,
  checkCreation,
  compileTemplate,
  effectiveCreationConfig,
} from '@tms/sheet-core'
import {
  checkSeedDatabase,
  type Handle,
  type Key,
  runSeed,
} from '../../../../scripts/seed-roteiro'
import { template } from '../test/factories'
import {
  createTestContext,
  createTestContextOn,
  type TestContext,
  useTestDb,
} from '../test/helpers'

useTestDb()

describe('seed-roteiro (S-04)', () => {
  let ctx: TestContext
  const log = spyOn(console, 'log').mockImplementation(() => undefined)

  beforeAll(async () => {
    ctx = await createTestContext()
  })
  afterAll(() => log.mockRestore())

  // Uma API por conta, como o main() do seed: limites padrão e
  // trustProxy padrão (falso), sem nenhum override
  const inProcess = () => {
    const apps = new Map<Key, Handle>()
    return (key: Key): Handle => {
      let handle = apps.get(key)
      if (!handle) {
        const { app } = createTestContextOn(ctx.db)
        handle = request => app.handle(request)
        apps.set(key, handle)
      }
      return handle
    }
  }

  async function narrated(email: string) {
    return ctx.db
      .selectFrom('chronicles as c')
      .innerJoin('users as u', 'u.id', 'c.storyteller_id')
      .where('u.email', '=', email)
      .select('c.id')
      .execute()
  }

  async function memberships(email: string) {
    return ctx.db
      .selectFrom('chronicle_members as m')
      .innerJoin('users as u', 'u.id', 'm.user_id')
      .innerJoin('chronicles as c', 'c.id', 'm.chronicle_id')
      .where('u.email', '=', email)
      .whereRef('c.storyteller_id', '!=', 'm.user_id')
      .select('m.chronicle_id')
      .execute()
  }

  it('cria as 7 crônicas e os 13 aceites com os limites padrão', async () => {
    const result = await runSeed({
      api: inProcess(),
      base: 'http://localhost',
      now: () => new Date('2026-11-01T12:00:00'),
    })

    expect(result.chronicles).toHaveLength(7)
    expect(result.accounts.map(a => a.email)).toEqual([
      'roteiro_narrador@roteiro.test',
      'roteiro_jogador1@roteiro.test',
      'roteiro_jogador2@roteiro.test',
      'roteiro_narrador2@roteiro.test',
    ])
    expect(await narrated('roteiro_narrador@roteiro.test')).toHaveLength(7)
    // J1 nas 6 crônicas e na do limite 20; J2 só nas 6
    expect(await memberships('roteiro_jogador1@roteiro.test')).toHaveLength(7)
    expect(await memberships('roteiro_jogador2@roteiro.test')).toHaveLength(6)
    expect(await memberships('roteiro_narrador2@roteiro.test')).toHaveLength(0)
  })

  it('com uma API só para todas as contas, o limite por IP continua valendo', async () => {
    // O cenário do ORQ-07: todas as contas no mesmo IP, sem TRUST_PROXY.
    // O limite não muda; o seed é que não divide mais a instância
    const { app } = createTestContextOn(ctx.db)
    const shared: Handle = request => app.handle(request)
    await expect(
      runSeed({ api: () => shared, base: 'http://localhost' })
    ).rejects.toThrow('limite de requisições da API (429)')
  })

  it('com 429 no meio, para e diz que a rodada ficou incompleta', async () => {
    const api = inProcess()
    // Os aceites de convite esbarram no limite (o caso do modo remoto, em
    // que as contas dividem o IP)
    const limited =
      (key: Key): Handle =>
      request =>
        new URL(request.url).pathname === '/invites/accept'
          ? Promise.resolve(new Response('{}', { status: 429 }))
          : api(key)(request)
    const run = runSeed({
      api: limited,
      base: 'http://localhost',
      remote: true,
    })
    await expect(run).rejects.toThrow(
      'O seed parou em POST /invites/accept: limite de requisições da API (429).'
    )
    await expect(run).rejects.toThrow('incompletas (0 de 7 prontas)')
    await expect(run).rejects.toThrow('No modo remoto (SEED_API_URL)')
  })

  it('a segunda rodada entra nas mesmas contas e troca as crônicas', async () => {
    const result = await runSeed({ api: inProcess(), base: 'http://localhost' })
    expect(result.chronicles).toHaveLength(7)
    expect(result.sheets).toEqual([])
    expect(await narrated('roteiro_narrador@roteiro.test')).toHaveLength(7)
  })

  // Onda 3 (onda-3.md §4.9): as fichas de J1 dos roteiros manuais do P03-D,
  // do P04-D e do P09-C, pela API, sem convite nem crônica a mais
  it('--fichas-criacao: as fichas de J1 dos roteiros manuais da onda 3', async () => {
    const result = await runSeed({
      api: inProcess(),
      base: 'http://localhost',
      creationSheets: true,
    })
    expect(result.chronicles).toHaveLength(7)
    expect(result.sheets.map(f => f.name)).toEqual([
      'Isadora Web',
      'Otto Web',
      'Isadora Android',
      'Otto Android',
      'Isadora iOS',
      'Otto iOS',
      'Ficha Livre R',
      'Ficha Pontos R',
      'Ficha Aprovação R',
      'Ficha XP R',
    ])
    const rows = await ctx.db
      .selectFrom('characters as ch')
      .innerJoin('users as u', 'u.id', 'ch.user_id')
      .innerJoin('chronicles as c', 'c.id', 'ch.chronicle_id')
      .where('u.email', '=', 'roteiro_jogador1@roteiro.test')
      .where('c.name', 'not like', 'Vampiro limite 20%')
      .select([
        'ch.id',
        'ch.name',
        'ch.status',
        'ch.sheet_data',
        'ch.creation',
        'c.name as chronicle',
        'c.character_approval',
      ])
      .execute()
    const sheet = (name: string) => {
      const row = rows.find(r => r.name === name)
      if (!row) throw new Error(`sem a ficha ${name}`)
      return row
    }
    expect(rows).toHaveLength(10)

    // P03-D: falta 1 de Vigor, ainda em criação por pontos; Otto, livre
    const isadora = sheet('Isadora iOS')
    expect(isadora.chronicle).toStartWith('Vampiro v4 · ')
    expect(isadora.status).toBe('creating')
    const values = (isadora.sheet_data as { values: Record<string, unknown> })
      .values
    expect(values).toMatchObject({ clan: 'tremere', strength: 4, stamina: 2 })
    expect(sheet('Otto Web').chronicle).toStartWith('Vampiro v3/v5 · ')

    // P04-D: a aprovação ligada em Mago v4 e a conta fechada, sem enviar
    const approval = sheet('Ficha Aprovação R')
    expect(approval.chronicle).toStartWith('Mago v4 · ')
    expect(approval.character_approval).toBe(true)
    expect(approval.status).toBe('creating')
    const mage = compileTemplate(template('mta-m20'))
    const check = checkCreation(mage, approval.sheet_data, {
      config: effectiveCreationConfig(mage),
      choices: (approval.creation as unknown as { choices: CreationChoices })
        .choices,
    })
    expect(check.complete).toBe(true)
    expect(sheet('Ficha Pontos R').chronicle).toStartWith('Vampiro v4 · ')
    expect(sheet('Ficha Livre R').chronicle).toStartWith('Vampiro v3/v5 · ')

    // P09-C: concluída pelo N, 10 de XP e um pedido pendente
    const xp = sheet('Ficha XP R')
    expect(xp.status).toBe('active')
    const entries = await ctx.db
      .selectFrom('xp_entries')
      .where('character_id', '=', xp.id)
      .select(['total_delta'])
      .execute()
    expect(entries.reduce((n, e) => n + e.total_delta, 0)).toBe(10)
    const requests = await ctx.db
      .selectFrom('xp_requests')
      .where('character_id', '=', xp.id)
      .select(['status', 'target_field'])
      .execute()
    expect(requests).toEqual([{ status: 'pending', target_field: 'strength' }])
  })
})

// O seed apaga e recria dados: em processo, só no banco local
describe('checkSeedDatabase', () => {
  it('aceita localhost, 127.0.0.1, ::1 e socket local', () => {
    for (const url of [
      'postgres://postgres:postgres@localhost:5432/tms',
      'postgres://u:p@127.0.0.1/tms',
      'postgres://u:p@[::1]:5432/tms',
      'postgres:///tms',
      'postgres:///tms?host=/var/run/postgresql',
    ])
      expect(checkSeedDatabase(url, {})).toBeNull()
  })

  it('recusa host remoto dizendo só o host, nunca a URL nem a senha', () => {
    const url = 'postgres://admin:s3nh4-secreta@db.prod.example.com:5432/tms'
    const message = checkSeedDatabase(url, {})
    expect(message).toContain('"db.prod.example.com"')
    expect(message).toContain('SEED_ALLOW_REMOTE_DB=1')
    expect(message).not.toContain('s3nh4-secreta')
    expect(message).not.toContain('admin')
    expect(message).not.toContain(url)
    // ?host= também é destino
    expect(
      checkSeedDatabase('postgres://u:p@localhost/tms?host=10.0.0.5', {})
    ).toContain('"10.0.0.5"')
  })

  it('banco remoto só com SEED_ALLOW_REMOTE_DB=1', () => {
    const url = 'postgres://u:p@db.homolog.example.com/tms'
    expect(
      checkSeedDatabase(url, { SEED_ALLOW_REMOTE_DB: 'true' })
    ).not.toBeNull()
    expect(checkSeedDatabase(url, { SEED_ALLOW_REMOTE_DB: '1' })).toBeNull()
  })

  it('URL inválida é recusada sem ecoar o valor', () => {
    expect(checkSeedDatabase('nao é url com senha', {})).toBe(
      'DATABASE_URL inválido: confira o .env.'
    )
  })
})
