/// <reference types="bun-types" />
// S-04: o seed do roteiro termina com a API em processo, uma instância por
// conta, nos limites padrão e sem TRUST_PROXY. Antes, os 13 aceites de
// convite passavam do limite de 10 por IP (o IP simulado no X-Forwarded-For
// só valia com TRUST_PROXY=true).
import { afterAll, beforeAll, describe, expect, it, spyOn } from 'bun:test'
import {
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
    ).rejects.toThrow('rate limit')
  })

  it('a segunda rodada entra nas mesmas contas e troca as crônicas', async () => {
    const result = await runSeed({ api: inProcess(), base: 'http://localhost' })
    expect(result.chronicles).toHaveLength(7)
    expect(await narrated('roteiro_narrador@roteiro.test')).toHaveLength(7)
  })
})
