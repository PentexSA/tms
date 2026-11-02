/// <reference types="bun-types" />
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'bun:test'
import { sql } from 'kysely'
import {
  addMember,
  as,
  createCharacter,
  createChronicle,
  createUser,
  publish,
  type TestUser,
} from '../test/factories'
import {
  createTestContext,
  destroyTestDb,
  type TestContext,
  useTestDb,
} from '../test/helpers'

// T-47: com a API em Brasília e o banco em UTC, a ficha recém-criada aparecia
// na Mesa "alterada às 15:25" às 12:25. O CI roda processo e banco em UTC, e
// por isso nunca pegou. Aqui o processo fica em America/Sao_Paulo (o Bun
// aplica o process.env.TZ em tempo de execução) e a sessão do banco em UTC.
// O mesmo cenário com o driver pg, onde as duas origens se misturam, está em
// timestamps.pg.test.ts.

useTestDb()

const ZONE = 'America/Sao_Paulo'
const MINUTE = 60_000
let previousZone: string | undefined
beforeAll(() => {
  previousZone = process.env.TZ
  process.env.TZ = ZONE
})
afterAll(() => {
  if (previousZone === undefined) delete process.env.TZ
  else process.env.TZ = previousZone
})

let ctx: TestContext
let storyteller: TestUser
let owner: TestUser
let chronicleId: string

beforeEach(async () => {
  await destroyTestDb()
  // Relógio de verdade: o default now() do banco e o Date da API precisam
  // falar do mesmo instante
  ctx = await createTestContext({ now: () => new Date() })
  await sql`set time zone 'UTC'`.execute(ctx.db)
  await publish(ctx, 'vtm-v20')
  storyteller = await createUser(ctx, 'narradora-fuso')
  owner = await createUser(ctx, 'dona-fuso')
  chronicleId = await createChronicle(ctx, storyteller)
  await addMember(ctx, chronicleId, owner)
})
afterEach(async () => destroyTestDb())

interface Row {
  id: string
  name: string
  updatedAt: string
}
const table = async () =>
  (await (
    await as(ctx, storyteller, 'GET', `/chronicles/${chronicleId}/table`)
  ).json()) as Row[]

describe('datas com fuso (T-47)', () => {
  it('o processo do teste está fora de UTC', () => {
    expect(new Date('2026-11-01T15:00:00Z').getHours()).toBe(12)
  })

  it('ficha recém-criada aparece na Mesa com a hora da criação, em qualquer fuso', async () => {
    const before = Date.now()
    await createCharacter(ctx, owner, chronicleId, { name: 'Recém-criada' })
    const [row] = await table()
    const at = new Date(row?.updatedAt ?? 0).getTime()
    expect(Math.abs(at - before)).toBeLessThan(MINUTE)
  })

  // A ficha criada antes e editada depois vem primeiro; com as datas sem
  // fuso, a nova ficava 3 h no futuro e passava à frente
  it('última alteração ordena certo entre ficha nova e editada', async () => {
    const edited = await createCharacter(ctx, owner, chronicleId, {
      name: 'Editada',
      blood: { current: 9 },
    })
    const fresh = await createCharacter(ctx, owner, chronicleId, {
      name: 'Nova',
    })
    await new Promise(resolve => setTimeout(resolve, 20))
    const batch = await as(ctx, owner, 'POST', `/characters/${edited}/events`, {
      clientBatchId: crypto.randomUUID(),
      events: [
        { path: 'values.blood', from: { current: 9 }, to: { current: 8 } },
      ],
    })
    expect(batch.ok).toBe(true)
    const rows = (await table()).filter(r => r.id === edited || r.id === fresh)
    const newest = [...rows].sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
    expect(newest.map(r => r.name)).toEqual(['Editada', 'Nova'])
    for (const row of rows)
      expect(
        Math.abs(new Date(row.updatedAt).getTime() - Date.now())
      ).toBeLessThan(MINUTE)
  })
})
