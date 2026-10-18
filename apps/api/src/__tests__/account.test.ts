/// <reference types="bun-types" />
import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test'
import { BLOCKED_BY_CHRONICLES } from '../account/routes'
import { CONFIRM_DELETE } from '../chronicles/routes'
import { createRateLimiter } from '../http/rate-limit'
import { logger } from '../logger'
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
  makeRequest,
  type TestContext,
} from '../test/helpers'

// Exclusão de conta (LGPD art. 18, VI; doc/plano-v0.md, Etapa 22) e exclusão
// de crônica pelo narrador.

const PASSWORD = 'senha de teste longa o bastante'

let ctx: TestContext
let storyteller: TestUser
let owner: TestUser
let player: TestUser
let solo: TestUser
let otherStoryteller: TestUser
let chronicleId: string
let characterId: string
let soloChronicleId: string

async function setup(extra: Parameters<typeof createTestContext>[0] = {}) {
  await destroyTestDb()
  ctx = await createTestContext(extra)
  await publish(ctx, 'vtm-v20')
  storyteller = await createUser(ctx, 'narradora')
  owner = await createUser(ctx, 'dona')
  player = await createUser(ctx, 'jogador')
  solo = await createUser(ctx, 'sozinha')
  otherStoryteller = await createUser(ctx, 'alheio')
  chronicleId = await createChronicle(ctx, storyteller)
  await addMember(ctx, chronicleId, owner)
  await addMember(ctx, chronicleId, player)
  characterId = await createCharacter(ctx, owner, chronicleId)
  await createChronicle(ctx, otherStoryteller, 'vtm-v20', 'Outra')
  // Narra só para si: crônica sem mais ninguém, com a própria ficha
  soloChronicleId = await createChronicle(ctx, solo, 'vtm-v20', 'Solo')
  await createCharacter(ctx, solo, soloChronicleId, { name: 'Própria' })
}

beforeEach(async () => {
  await setup()
})
afterEach(async () => {
  await destroyTestDb()
})

const deleteAccount = (user: TestUser | null, password: unknown = PASSWORD) =>
  as(ctx, user, 'DELETE', '/me', { password })

const login = (user: TestUser, headers: Record<string, string> = {}) =>
  makeRequest(
    ctx.app,
    'POST',
    '/auth/login',
    { email: `${user.username}@example.test`, password: PASSWORD },
    headers
  )

const exists = async (
  table: 'users' | 'chronicles' | 'characters',
  id: string
) =>
  Boolean(
    await ctx.db
      .selectFrom(table)
      .select('id')
      .where('id', '=', id)
      .executeTakeFirst()
  )

describe('DELETE /me', () => {
  it('sem sessão: 401', async () => {
    expect((await deleteAccount(null)).status).toBe(401)
  })

  it('senha errada: 401 genérico, nada apagado', async () => {
    const res = await deleteAccount(owner, 'outra senha qualquer')
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({
      error: 'não foi possível confirmar a senha',
    })
    expect(await exists('users', owner.id)).toBe(true)
    expect(await exists('characters', characterId)).toBe(true)
  })

  it('sem senha ou com o tipo errado: 400', async () => {
    expect((await as(ctx, owner, 'DELETE', '/me', {})).status).toBe(400)
    expect((await deleteAccount(owner, 123)).status).toBe(400)
  })

  it('rate limit por usuário (força bruta na senha)', async () => {
    await setup({
      limits: {
        ...defaultLimits(() => new Date()),
        accountDeletion: createRateLimiter({ limit: 2, windowMs: 60_000 }),
      },
    })
    expect((await deleteAccount(owner, 'errada 1')).status).toBe(401)
    expect((await deleteAccount(owner, 'errada 2')).status).toBe(401)
    const res = await deleteAccount(owner)
    expect(res.status).toBe(429)
    expect(res.headers.get('retry-after')).toMatch(/^\d+$/)
    expect(await exists('users', owner.id)).toBe(true)
  })

  it('jogadora: a conta, as fichas e os vínculos saem; a crônica dos outros fica', async () => {
    // Narradora mexeu na ficha da dona: esse histórico é da ficha da dona
    await as(ctx, storyteller, 'POST', `/characters/${characterId}/events`, {
      clientBatchId: crypto.randomUUID(),
      events: [{ path: 'values.blood', from: null, to: { current: 9 } }],
    })
    const res = await deleteAccount(owner)
    expect(res.status).toBe(204)
    expect(await exists('users', owner.id)).toBe(false)
    expect(await exists('characters', characterId)).toBe(false)
    expect(
      await ctx.db
        .selectFrom('character_batches')
        .select('id')
        .where('character_id', '=', characterId)
        .execute()
    ).toEqual([])
    expect(
      await ctx.db
        .selectFrom('chronicle_members')
        .select('user_id')
        .where('user_id', '=', owner.id)
        .execute()
    ).toEqual([])
    expect(await exists('chronicles', chronicleId)).toBe(true)
    expect(await exists('users', player.id)).toBe(true)
  })

  it('narradora de crônica com outras pessoas: 409 com a lista, nada apagado', async () => {
    const res = await deleteAccount(storyteller)
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({
      error: BLOCKED_BY_CHRONICLES,
      chronicles: [{ id: chronicleId, name: 'Crônica da Liberdade' }],
    })
    expect(await exists('users', storyteller.id)).toBe(true)
    expect(await exists('chronicles', chronicleId)).toBe(true)
    expect((await login(storyteller)).status).toBe(200)
  })

  it('crônica só dela: sai junto, com a ficha e os convites', async () => {
    await as(ctx, solo, 'POST', `/chronicles/${soloChronicleId}/invites`)
    const res = await deleteAccount(solo)
    expect(res.status).toBe(204)
    expect(await exists('chronicles', soloChronicleId)).toBe(false)
    expect(
      await ctx.db
        .selectFrom('characters')
        .select('id')
        .where('user_id', '=', solo.id)
        .execute()
    ).toEqual([])
    expect(
      await ctx.db
        .selectFrom('chronicle_invites')
        .select('id')
        .where('chronicle_id', '=', soloChronicleId)
        .execute()
    ).toEqual([])
  })

  it('o que fez em ficha alheia fica anônimo: "Conta excluída" no histórico e nas rolagens', async () => {
    // A narradora edita e rola na ficha da dona...
    await as(ctx, storyteller, 'POST', `/characters/${characterId}/events`, {
      clientBatchId: crypto.randomUUID(),
      events: [{ path: 'values.blood', from: null, to: { current: 9 } }],
    })
    const rolled = await as(
      ctx,
      storyteller,
      'POST',
      `/characters/${characterId}/rolls`,
      {
        clientRollId: crypto.randomUUID(),
        slots: { attribute: 'dexterity' },
        difficulty: 6,
      }
    )
    expect(rolled.status).toBe(201)
    // ...e depois passa a narração (ainda sem rota: direto no banco)
    await ctx.db
      .updateTable('chronicles')
      .set({ storyteller_id: player.id })
      .where('id', '=', chronicleId)
      .execute()
    expect((await deleteAccount(storyteller)).status).toBe(204)

    const history = (await (
      await as(ctx, owner, 'GET', `/characters/${characterId}/history`)
    ).json()) as { items: { by: unknown; byRole: string }[] }
    expect(history.items).toEqual([
      expect.objectContaining({ by: null, byRole: 'storyteller' }),
    ])
    const rolls = (await (
      await as(ctx, owner, 'GET', `/characters/${characterId}/rolls`)
    ).json()) as { items: { by: unknown }[] }
    expect(rolls.items).toEqual([expect.objectContaining({ by: null })])
    // A ficha é da dona e continua lá
    expect(await exists('characters', characterId)).toBe(true)
  })

  it('depois: não entra mais, e o refresh token antigo não renova', async () => {
    const native = await login(owner, { 'x-tms-client': 'native' })
    const { refreshToken } = (await native.json()) as { refreshToken: string }
    expect((await deleteAccount(owner)).status).toBe(204)
    expect((await login(owner)).status).toBe(401)
    const refreshed = await makeRequest(ctx.app, 'POST', '/auth/refresh', {
      refreshToken,
    })
    expect(refreshed.status).toBe(401)
    expect(
      await ctx.db
        .selectFrom('refresh_tokens')
        .select('id')
        .where('user_id', '=', owner.id)
        .execute()
    ).toEqual([])
    // O token de acesso que ainda não venceu não alcança mais nada
    expect((await as(ctx, owner, 'GET', '/me')).status).toBe(401)
    expect(
      (await as(ctx, owner, 'GET', `/chronicles/${chronicleId}`)).status
    ).toBe(404)
  })

  it('no web, o cookie do refresh é apagado', async () => {
    const res = await deleteAccount(owner)
    const cookie = res.headers.get('set-cookie') ?? ''
    expect(cookie).toContain('tms_refresh=')
    expect(cookie).toMatch(/Max-Age=0/i)
    expect(cookie).toMatch(/Path=\/auth/i)
    expect(cookie).toMatch(/HttpOnly/i)
  })

  it('o e-mail fica livre para um cadastro novo', async () => {
    expect((await deleteAccount(owner)).status).toBe(204)
    const res = await makeRequest(ctx.app, 'POST', '/auth/register', {
      email: 'dona@example.test',
      username: 'dona',
      password: 'outra senha longa o bastante',
    })
    expect(res.status).toBe(201)
  })

  it('o log tem só id e contagens, nunca e-mail ou nome', async () => {
    const info = spyOn(logger, 'info')
    try {
      expect((await deleteAccount(owner)).status).toBe(204)
      await new Promise(r => setTimeout(r, 10))
      const text = JSON.stringify(info.mock.calls)
      expect(text).toContain('account.deleted')
      expect(text).not.toContain('dona@example.test')
      expect(text).not.toContain('"dona"')
      expect(text).not.toContain(PASSWORD)
      const entry = info.mock.calls.find(
        c => (c[0] as { event?: string }).event === 'account.deleted'
      )?.[0]
      expect(entry).toEqual({
        event: 'account.deleted',
        userId: owner.id,
        chronicles: 0,
        characters: 1,
      })
    } finally {
      info.mockRestore()
    }
  })
})

describe('DELETE /chronicles/:id', () => {
  const remove = (user: TestUser | null, id: string, body?: unknown) =>
    as(ctx, user, 'DELETE', `/chronicles/${id}`, body)

  it('com ficha de outra pessoa: 409 sem o nome digitado, nada apagado', async () => {
    for (const body of [undefined, {}, { confirm: 'outro nome' }]) {
      const res = await remove(storyteller, chronicleId, body)
      expect(res.status).toBe(409)
      expect(await res.json()).toEqual({
        error: CONFIRM_DELETE,
        otherCharacters: 1,
      })
    }
    expect(await exists('chronicles', chronicleId)).toBe(true)
    expect(await exists('characters', characterId)).toBe(true)
  })

  it('com o nome digitado: a crônica, as fichas, os vínculos e os convites saem', async () => {
    await as(ctx, storyteller, 'POST', `/chronicles/${chronicleId}/invites`)
    const res = await remove(storyteller, chronicleId, {
      confirm: '  Crônica da Liberdade ',
    })
    expect(res.status).toBe(204)
    expect(await exists('chronicles', chronicleId)).toBe(false)
    expect(await exists('characters', characterId)).toBe(false)
    for (const table of ['chronicle_members', 'chronicle_invites'] as const)
      expect(
        await ctx.db
          .selectFrom(table)
          .select('chronicle_id')
          .where('chronicle_id', '=', chronicleId)
          .execute()
      ).toEqual([])
    // As contas continuam; a dona só perdeu a crônica
    expect(await exists('users', owner.id)).toBe(true)
    expect((await as(ctx, owner, 'GET', '/chronicles')).status).toBe(200)
  })

  it('só com membros sem ficha (e a do narrador): sai sem confirmação', async () => {
    const lonely = await createChronicle(ctx, storyteller, 'vtm-v20', 'Vazia')
    await addMember(ctx, lonely, player)
    await createCharacter(ctx, storyteller, lonely, { name: 'NPC' })
    expect((await remove(storyteller, lonely)).status).toBe(204)
    expect(await exists('chronicles', lonely)).toBe(false)
  })

  it('IDOR: jogador e dono 403; narrador de outra crônica e estranho 404', async () => {
    const confirm = { confirm: 'Crônica da Liberdade' }
    expect((await remove(player, chronicleId, confirm)).status).toBe(403)
    expect((await remove(owner, chronicleId, confirm)).status).toBe(403)
    expect((await remove(otherStoryteller, chronicleId, confirm)).status).toBe(
      404
    )
    expect((await remove(null, chronicleId, confirm)).status).toBe(401)
    expect((await remove(storyteller, crypto.randomUUID())).status).toBe(404)
    expect(await exists('chronicles', chronicleId)).toBe(true)
  })

  it('depois de excluir a crônica, a narradora consegue excluir a conta', async () => {
    expect(
      (
        await remove(storyteller, chronicleId, {
          confirm: 'Crônica da Liberdade',
        })
      ).status
    ).toBe(204)
    expect((await deleteAccount(storyteller)).status).toBe(204)
    expect(await exists('users', storyteller.id)).toBe(false)
  })
})
