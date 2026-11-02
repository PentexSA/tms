/// <reference types="bun-types" />
// S-04: o seed do roteiro termina com a API em processo, uma instância por
// conta, nos limites padrão e sem TRUST_PROXY. Antes, os 13 aceites de
// convite passavam do limite de 10 por IP (o IP simulado no X-Forwarded-For
// só valia com TRUST_PROXY=true).
import { afterAll, beforeAll, describe, expect, it, spyOn } from 'bun:test'
import {
  checkSeedDatabase,
  type Handle,
  type Key,
  runSeed,
} from '../../../../scripts/seed-roteiro'
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
    expect(await narrated('roteiro_narrador@roteiro.test')).toHaveLength(7)
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
