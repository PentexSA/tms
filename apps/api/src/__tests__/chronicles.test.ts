/// <reference types="bun-types" />
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import {
  hashInviteCode,
  newInviteCode,
  normalizeInviteCode,
} from '../chronicles/invite-code'
import { createRateLimiter } from '../http/rate-limit'
import { defaultLimits } from '../options'
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

// Um PGLite para o arquivo, restaurado a cada createTestContext
useTestDb()

// Crônicas e convites (doc/plano-v0.md, Etapa 10).

let ctx: TestContext
let storyteller: TestUser
let player: TestUser
let otherStoryteller: TestUser
let stranger: TestUser
let chronicleId: string

async function scenario(extra: Parameters<typeof createTestContext>[0] = {}) {
  await destroyTestDb()
  ctx = await createTestContext(extra)
  await publish(ctx, 'vtm-v20')
  storyteller = await createUser(ctx, 'narradora')
  player = await createUser(ctx, 'jogador')
  otherStoryteller = await createUser(ctx, 'outro')
  stranger = await createUser(ctx, 'estranho')
  chronicleId = await createChronicle(ctx, storyteller)
  await addMember(ctx, chronicleId, player)
  await createChronicle(ctx, otherStoryteller, 'vtm-v20', 'Outra crônica')
}

async function newInvite(user: TestUser = storyteller, body?: unknown) {
  const res = await as(
    ctx,
    user,
    'POST',
    `/chronicles/${chronicleId}/invites`,
    body
  )
  return (await res.json()) as {
    id: string
    code: string
    expiresAt: string
    maxUses: number
  }
}

beforeEach(async () => {
  await scenario()
})
afterEach(async () => {
  await destroyTestDb()
})

describe('GET /systems', () => {
  it('lista só sistemas com template publicado', async () => {
    await ctx.db
      .insertInto('game_systems')
      .values({ code: 'sem-template', name: 'Sem template', family: 'x' })
      .execute()
    const res = await as(ctx, stranger, 'GET', '/systems')
    // Os do produto vêm da migration; o sem template fica de fora
    expect(await res.json()).toEqual([
      {
        code: 'wta-w20',
        name: 'Lobisomem: O Apocalipse — Edição de 20º Aniversário',
        family: 'wod',
      },
      {
        code: 'mta-m20',
        name: 'Mago: A Ascensão — Edição de 20º Aniversário',
        family: 'wod',
      },
      {
        code: 'vtm-v20',
        name: 'Vampiro: A Máscara — Edição de 20º Aniversário',
        family: 'wod',
      },
    ])
  })

  it('exige sessão', async () => {
    expect((await as(ctx, null, 'GET', '/systems')).status).toBe(401)
  })
})

describe('POST /chronicles e GET /chronicles', () => {
  it('quem cria é o narrador', async () => {
    const res = await as(ctx, stranger, 'POST', '/chronicles', {
      name: '  Noites de São Paulo  ',
      systemCode: 'vtm-v20',
    })
    expect(res.status).toBe(201)
    const body = (await res.json()) as {
      id: string
      name: string
      role: string
    }
    expect(body).toMatchObject({
      name: 'Noites de São Paulo',
      role: 'storyteller',
      system: { code: 'vtm-v20' },
    })
    const row = await ctx.db
      .selectFrom('chronicles')
      .select('storyteller_id')
      .where('id', '=', body.id)
      .executeTakeFirstOrThrow()
    expect(row.storyteller_id).toBe(stranger.id)
  })

  it.each([
    ['vazio', '   '],
    ['com HTML', '<b>Crônica</b>'],
    ['com bidi', 'Crônica‮acinôrC'],
    ['com quebra de linha', 'Crônica\nda Liberdade'],
    ['longo demais', 'x'.repeat(81)],
  ])('nome %s é recusado', async (_, name) => {
    const res = await as(ctx, stranger, 'POST', '/chronicles', {
      name,
      systemCode: 'vtm-v20',
    })
    expect(res.status).toBe(400)
  })

  it('sistema sem template publicado: 422', async () => {
    const res = await as(ctx, stranger, 'POST', '/chronicles', {
      name: 'Crônica',
      systemCode: 'dnd5e-2014',
    })
    expect(res.status).toBe(422)
  })

  it('a lista traz as que eu narro e as de que participo, com o papel', async () => {
    const mine = (await (
      await as(ctx, player, 'GET', '/chronicles')
    ).json()) as {
      id: string
      role: string
      storyteller: { username: string }
      characterCount: number
    }[]
    expect(mine).toEqual([
      expect.objectContaining({
        id: chronicleId,
        role: 'player',
        storyteller: { username: 'narradora' },
        characterCount: 0,
      }),
    ])
    const theirs = (await (
      await as(ctx, storyteller, 'GET', '/chronicles')
    ).json()) as { role: string }[]
    expect(theirs.map(c => c.role)).toEqual(['storyteller'])
    expect(
      await (await as(ctx, stranger, 'GET', '/chronicles')).json()
    ).toEqual([])
  })

  // U-04: a data civil da última sessão, sem hora, só para narrador e membro
  it('a lista traz a última sessão como data civil; o ex-membro recebe null (U-04)', async () => {
    const lastOf = async (user: TestUser) => {
      const list = (await (
        await as(ctx, user, 'GET', '/chronicles')
      ).json()) as {
        id: string
        lastSession: string | null
      }[]
      return list.find(c => c.id === chronicleId)?.lastSession
    }
    expect(await lastOf(storyteller)).toBeNull()
    expect(await lastOf(player)).toBeNull()

    const register = (date: string) =>
      as(ctx, storyteller, 'POST', `/chronicles/${chronicleId}/sessions`, {
        clientCommandId: crypto.randomUUID(),
        date,
        title: `Sessão de ${date}`,
        summary: '',
        privateNotes: '',
      })
    for (const date of ['2026-10-20', '2026-11-01', '2026-10-25'])
      expect((await register(date)).status).toBe(201)
    // A maior data vence, como texto AAAA-MM-DD (sem hora nem fuso)
    expect(await lastOf(storyteller)).toBe('2026-11-01')
    expect(await lastOf(player)).toBe('2026-11-01')
    // A outra crônica não tem sessão
    const other = (await (
      await as(ctx, otherStoryteller, 'GET', '/chronicles')
    ).json()) as { lastSession: string | null }[]
    expect(other.map(c => c.lastSession)).toEqual([null])

    // O ex-membro (tem ficha e saiu) continua vendo a crônica, sem a sessão
    await createCharacter(ctx, player, chronicleId)
    expect(
      (await as(ctx, player, 'DELETE', `/chronicles/${chronicleId}/members/me`))
        .status
    ).toBe(204)
    const former = (await (
      await as(ctx, player, 'GET', '/chronicles')
    ).json()) as {
      id: string
      role: string
      lastSession: string | null
      transferOffer: unknown
    }[]
    expect(former).toEqual([
      expect.objectContaining({
        id: chronicleId,
        role: 'former',
        lastSession: null,
        transferOffer: null,
      }),
    ])
  })
})

// T-02: dois toques em "Criar crônica" mandam a mesma chave; uma crônica só
describe('POST /chronicles idempotente pela chave do comando', () => {
  const key = '3c9e1f7a-2b4d-4e6f-8a1b-5c7d9e0f2a3b'
  const send = (user: TestUser, name: string, clientCommandId = key) =>
    as(ctx, user, 'POST', '/chronicles', {
      name,
      systemCode: 'vtm-v20',
      clientCommandId,
    })
  const narrated = (user: TestUser) =>
    ctx.db
      .selectFrom('chronicles')
      .select('id')
      .where('storyteller_id', '=', user.id)
      .execute()

  it('a mesma chave: 201 e depois 200 com o mesmo corpo e duplicate', async () => {
    const first = await send(stranger, 'Noites de Lisboa')
    expect(first.status).toBe(201)
    const created = (await first.json()) as Record<string, unknown>
    expect(created).toMatchObject({
      name: 'Noites de Lisboa',
      role: 'storyteller',
      system: { code: 'vtm-v20' },
      duplicate: false,
    })
    const again = await send(stranger, 'Noites de Lisboa')
    expect(again.status).toBe(200)
    expect(await again.json()).toEqual({ ...created, duplicate: true })
    expect(await narrated(stranger)).toHaveLength(1)
  })

  it('o hash usa o nome normalizado: espaços em volta são o mesmo pedido', async () => {
    const first = (await (await send(stranger, 'Lisboa')).json()) as {
      id: string
    }
    const again = await send(stranger, '  Lisboa  ')
    expect(again.status).toBe(200)
    expect(((await again.json()) as { id: string }).id).toBe(first.id)
  })

  it('a mesma chave com outro nome: 409, sem o id', async () => {
    const first = await send(stranger, 'Noites de Lisboa')
    const { id } = (await first.json()) as { id: string }
    const res = await send(stranger, 'Outra')
    expect(res.status).toBe(409)
    const text = await res.text()
    expect(text).toContain('IDEMPOTENCY_CONFLICT')
    expect(text).not.toContain(id)
    expect(await narrated(stranger)).toHaveLength(1)
  })

  it('a mesma chave em outra conta é outra crônica', async () => {
    const mine = (await (await send(stranger, 'Lisboa')).json()) as {
      id: string
    }
    const res = await send(otherStoryteller, 'Lisboa')
    expect(res.status).toBe(201)
    const theirs = (await res.json()) as { id: string }
    expect(theirs.id).not.toBe(mine.id)
    expect(await narrated(stranger)).toHaveLength(1)
  })

  it('repetir depois de excluir a crônica: 404, sem recriar', async () => {
    const { id } = (await (await send(stranger, 'Lisboa')).json()) as {
      id: string
    }
    await ctx.db.deleteFrom('chronicles').where('id', '=', id).execute()
    expect((await send(stranger, 'Lisboa')).status).toBe(404)
    expect(await narrated(stranger)).toHaveLength(0)
  })

  it('sem chave continua criando (app antigo)', async () => {
    const body = { name: 'Lisboa', systemCode: 'vtm-v20' }
    expect((await as(ctx, stranger, 'POST', '/chronicles', body)).status).toBe(
      201
    )
    expect((await as(ctx, stranger, 'POST', '/chronicles', body)).status).toBe(
      201
    )
    expect(await narrated(stranger)).toHaveLength(2)
  })

  it('chave que não é UUID: 400', async () => {
    expect((await send(stranger, 'Lisboa', 'não-é-uuid')).status).toBe(400)
  })
})

describe('GET /chronicles/:id', () => {
  it('detalhe com o narrador e os membros (só nome de usuário)', async () => {
    const res = await as(ctx, player, 'GET', `/chronicles/${chronicleId}`)
    const body = await res.json()
    expect(body).toEqual({
      id: chronicleId,
      name: 'Crônica da Liberdade',
      description: '',
      imageUrl: null,
      options: {},
      optionCatalog: [],
      settingsRevision: 0,
      lastSession: null,
      system: {
        code: 'vtm-v20',
        name: 'Vampiro: A Máscara — Edição de 20º Aniversário',
      },
      role: 'player',
      storyteller: { id: storyteller.id, username: 'narradora' },
      // Aprovação de ficha desligada por padrão (v4)
      creation: { approval: false, defaults: {}, revision: 0 },
      members: [
        { id: player.id, username: 'jogador', joinedAt: expect.any(String) },
      ],
    })
    expect(JSON.stringify(body)).not.toContain('@example.test')
  })

  it('crônica inexistente e crônica alheia dão a mesma resposta', async () => {
    const missing = await as(
      ctx,
      stranger,
      'GET',
      `/chronicles/${crypto.randomUUID()}`
    )
    const foreign = await as(ctx, stranger, 'GET', `/chronicles/${chronicleId}`)
    expect(missing.status).toBe(404)
    expect(foreign.status).toBe(404)
    expect(await missing.json()).toEqual(await foreign.json())
  })

  // P14-D (U-09, D-15): o convite não cria vínculo; quem ainda não entrou
  // não lê a Descrição, e quem entrou lê
  it('o convidado que não entrou recebe 404 sem a Descrição; depois do aceite, lê', async () => {
    const marker = 'marca-descricao-convite-91b2'
    await ctx.db
      .updateTable('chronicles')
      .set({ description: `Abertura. ${marker}` })
      .where('id', '=', chronicleId)
      .execute()
    const invite = await newInvite()
    const before = await as(ctx, stranger, 'GET', `/chronicles/${chronicleId}`)
    const missing = await as(
      ctx,
      stranger,
      'GET',
      `/chronicles/${crypto.randomUUID()}`
    )
    expect(before.status).toBe(404)
    const text = await before.text()
    expect(text).not.toContain(marker)
    expect(text).toEqual(await missing.text())
    const accepted = await as(ctx, stranger, 'POST', '/invites/accept', {
      code: invite.code,
    })
    expect(accepted.status).toBe(200)
    expect(await accepted.text()).not.toContain(marker)
    const after = await as(ctx, stranger, 'GET', `/chronicles/${chronicleId}`)
    expect(after.status).toBe(200)
    expect(await after.json()).toMatchObject({
      role: 'player',
      description: `Abertura. ${marker}`,
    })
  })
})

describe('convites', () => {
  it('o código aparece uma vez e o banco guarda só o hash', async () => {
    const invite = await newInvite()
    expect(invite.code).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/)
    expect(invite.maxUses).toBe(10)
    const row = await ctx.db
      .selectFrom('chronicle_invites')
      .selectAll()
      .executeTakeFirstOrThrow()
    expect(row.code_hash).toBe(hashInviteCode(invite.code))
    expect(JSON.stringify(row)).not.toContain(invite.code)
    const list = (await (
      await as(ctx, storyteller, 'GET', `/chronicles/${chronicleId}/invites`)
    ).json()) as Record<string, unknown>[]
    expect(list).toHaveLength(1)
    expect(JSON.stringify(list)).not.toContain(invite.code)
    expect(list[0]).toMatchObject({ uses: 0, maxUses: 10, active: true })
  })

  it('aceitar põe o usuário na crônica como jogador', async () => {
    const invite = await newInvite()
    const res = await as(ctx, stranger, 'POST', '/invites/accept', {
      code: invite.code,
    })
    expect(await res.json()).toEqual({ chronicleId, role: 'player' })
    expect(
      (await as(ctx, stranger, 'GET', `/chronicles/${chronicleId}`)).status
    ).toBe(200)
  })

  it('aceita o código como a pessoa digitou', async () => {
    const invite = await newInvite()
    const typed = `${invite.code.slice(0, 5).toLowerCase()} - ${invite.code.slice(5)}`
    const res = await as(ctx, stranger, 'POST', '/invites/accept', {
      code: typed,
    })
    expect(res.status).toBe(200)
  })

  it('aceitar de novo e o narrador aceitando o próprio convite não gastam usos', async () => {
    const invite = await newInvite()
    await as(ctx, stranger, 'POST', '/invites/accept', { code: invite.code })
    await as(ctx, stranger, 'POST', '/invites/accept', { code: invite.code })
    const own = await as(ctx, storyteller, 'POST', '/invites/accept', {
      code: invite.code,
    })
    expect(await own.json()).toEqual({ chronicleId, role: 'storyteller' })
    const row = await ctx.db
      .selectFrom('chronicle_invites')
      .select('uses')
      .executeTakeFirstOrThrow()
    expect(row.uses).toBe(1)
  })

  it('expirado, revogado, esgotado ou inexistente: a mesma resposta', async () => {
    const expired = await newInvite(storyteller, { expiresInDays: 1 })
    const revoked = await newInvite()
    await as(
      ctx,
      storyteller,
      'DELETE',
      `/chronicles/${chronicleId}/invites/${revoked.id}`
    )
    const single = await newInvite(storyteller, { maxUses: 1 })
    await as(ctx, otherStoryteller, 'POST', '/invites/accept', {
      code: single.code,
    })
    ctx.clock.advance(24 * 60 * 60 * 1000 + 1)
    const answers = []
    for (const code of [
      expired.code,
      revoked.code,
      single.code,
      newInviteCode(),
    ]) {
      const res = await as(ctx, stranger, 'POST', '/invites/accept', { code })
      expect(res.status).toBe(404)
      answers.push(await res.json())
    }
    expect(new Set(answers.map(a => JSON.stringify(a))).size).toBe(1)
  })

  it('revogar um convite de outra crônica não funciona (IDOR)', async () => {
    const otherChronicle = await createChronicle(
      ctx,
      storyteller,
      'vtm-v20',
      'Segunda crônica'
    )
    const invite = await newInvite()
    const res = await as(
      ctx,
      storyteller,
      'DELETE',
      `/chronicles/${otherChronicle}/invites/${invite.id}`
    )
    expect(res.status).toBe(404)
    const again = await as(
      ctx,
      storyteller,
      'DELETE',
      `/chronicles/${chronicleId}/invites/${invite.id}`
    )
    expect(again.status).toBe(204)
    const twice = await as(
      ctx,
      storyteller,
      'DELETE',
      `/chronicles/${chronicleId}/invites/${invite.id}`
    )
    expect(twice.status).toBe(404)
  })

  it('limites da validade e dos usos', async () => {
    for (const body of [
      { expiresInDays: 31 },
      { maxUses: 51 },
      { maxUses: 0 },
    ]) {
      const res = await as(
        ctx,
        storyteller,
        'POST',
        `/chronicles/${chronicleId}/invites`,
        body
      )
      expect(res.status).toBe(400)
    }
  })

  it('força bruta no código: 429', async () => {
    await scenario({
      limits: {
        ...defaultLimits(() => new Date()),
        invites: createRateLimiter({ limit: 3, windowMs: 60_000 }),
      },
    })
    for (let i = 0; i < 3; i++)
      expect(
        (
          await as(ctx, stranger, 'POST', '/invites/accept', {
            code: newInviteCode(),
          })
        ).status
      ).toBe(404)
    const res = await as(ctx, stranger, 'POST', '/invites/accept', {
      code: newInviteCode(),
    })
    expect(res.status).toBe(429)
  })
})

describe('código de convite', () => {
  it('26 caracteres sem I, L, O e U, sempre diferentes', () => {
    const codes = new Set(Array.from({ length: 200 }, newInviteCode))
    expect(codes.size).toBe(200)
    for (const c of codes) expect(c).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/)
  })

  it('normaliza caixa, espaços, hífens e letras confusas', () => {
    expect(normalizeInviteCode(' abcd-efgh oil ')).toBe('ABCDEFGH011')
    expect(hashInviteCode('abc-def')).toBe(hashInviteCode('ABCDEF'))
  })
})
