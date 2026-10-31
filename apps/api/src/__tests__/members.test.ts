/// <reference types="bun-types" />
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import {
  addMember,
  as,
  createCharacter,
  createChronicle,
  createUser,
  publish,
  setStatus,
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

// Remover jogador, sair e o ex-membro (doc/painel-narrador.md §5.2;
// doc/plano-v3.md, Etapa 7). Nada é apagado: as fichas vão para `archived`, o
// vínculo sai, e o ex-membro lê o que é dele e não escreve.

let ctx: TestContext
let storyteller: TestUser
let player: TestUser
let other: TestUser
let chronicleId: string
let characterId: string

beforeEach(async () => {
  await destroyTestDb()
  ctx = await createTestContext()
  await publish(ctx, 'vtm-v20')
  storyteller = await createUser(ctx, 'narradora')
  player = await createUser(ctx, 'jogadora')
  other = await createUser(ctx, 'outro')
  chronicleId = await createChronicle(ctx, storyteller)
  await addMember(ctx, chronicleId, player)
  await addMember(ctx, chronicleId, other)
  characterId = await createCharacter(ctx, player, chronicleId, {
    name: 'Helena Varga',
    willpower: { current: 5, permanent: 5 },
  })
  await setStatus(ctx, characterId, 'active', true)
})
afterEach(async () => {
  await destroyTestDb()
})

const remove = (user: TestUser, revokeInvites?: boolean) =>
  as(
    ctx,
    storyteller,
    'DELETE',
    `/chronicles/${chronicleId}/members/${user.id}`,
    revokeInvites === undefined ? undefined : { revokeInvites }
  )
const leave = (user: TestUser) =>
  as(ctx, user, 'DELETE', `/chronicles/${chronicleId}/members/me`)

const characterRow = (id = characterId) =>
  ctx.db
    .selectFrom('characters')
    .select(['status', 'locked_at'])
    .where('id', '=', id)
    .executeTakeFirstOrThrow()

const memberRows = () =>
  ctx.db
    .selectFrom('chronicle_members')
    .select('user_id')
    .where('chronicle_id', '=', chronicleId)
    .execute()

const auditRows = () =>
  ctx.db
    .selectFrom('chronicle_audit')
    .select(['action', 'actor_id', 'target_user_id', 'payload'])
    .where('chronicle_id', '=', chronicleId)
    .execute()

async function invite() {
  const res = await as(
    ctx,
    storyteller,
    'POST',
    `/chronicles/${chronicleId}/invites`
  )
  return (await res.json()) as { id: string; code: string }
}

// O ex-membro escreve e rola: os dois recusados com NOT_MEMBER
async function cannotWrite(user: TestUser) {
  const events = await as(
    ctx,
    user,
    'POST',
    `/characters/${characterId}/events`,
    {
      clientBatchId: crypto.randomUUID(),
      events: [{ path: 'values.concept', from: null, to: 'Arquivista' }],
    }
  )
  expect(events.status).toBe(403)
  expect(await events.json()).toMatchObject({ code: 'NOT_MEMBER' })
  const roll = await as(ctx, user, 'POST', `/characters/${characterId}/rolls`, {
    clientRollId: crypto.randomUUID(),
    slots: { attribute: 'dexterity' },
    difficulty: 6,
  })
  expect(roll.status).toBe(403)
  expect(await roll.json()).toMatchObject({ code: 'NOT_MEMBER' })
}

describe('remover', () => {
  it('as fichas vão para archived (sem trava), o vínculo sai e há uma linha no registro', async () => {
    const second = await createCharacter(ctx, player, chronicleId, {
      name: 'Segunda',
    })
    expect((await remove(player)).status).toBe(204)
    expect(await characterRow()).toEqual({
      status: 'archived',
      locked_at: null,
    })
    expect((await characterRow(second)).status).toBe('archived')
    expect((await memberRows()).map(r => r.user_id)).toEqual([other.id])
    const [row, ...rest] = await auditRows()
    expect(rest).toEqual([])
    expect(row).toEqual({
      action: 'member.remove',
      actor_id: storyteller.id,
      target_user_id: player.id,
      payload: {
        characters: [characterId, second].sort(),
        invitesRevoked: true,
      },
    })
  })

  it('o ex-membro lê a ficha e recebe 403 NOT_MEMBER em /events e /rolls', async () => {
    await remove(player)
    const read = await as(ctx, player, 'GET', `/characters/${characterId}`)
    expect(read.status).toBe(200)
    expect(await read.json()).toMatchObject({
      status: 'archived',
      member: false,
      roles: ['owner'],
    })
    await cannotWrite(player)
    // Nem o narrador reativando a ficha devolve a escrita
    await as(ctx, storyteller, 'POST', `/characters/${characterId}/status`, {
      status: 'active',
    })
    await cannotWrite(player)
  })

  it('revoga os convites ativos por padrão; pode deixá-los', async () => {
    const first = await invite()
    await remove(player)
    const revoked = await as(ctx, player, 'POST', '/invites/accept', {
      code: first.code,
    })
    expect(revoked.status).toBe(404)
    const kept = await invite()
    expect((await remove(other, false)).status).toBe(204)
    const accepted = await as(ctx, other, 'POST', '/invites/accept', {
      code: kept.code,
    })
    expect(accepted.status).toBe(200)
  })

  it('o narrador não remove a si mesmo: ele não está nos membros (404)', async () => {
    expect((await remove(storyteller)).status).toBe(404)
    expect(await auditRows()).toEqual([])
  })

  it('remover quem já saiu dá 404, sem linha nova', async () => {
    await remove(player)
    expect((await remove(player)).status).toBe(404)
    expect(await auditRows()).toHaveLength(1)
  })
})

describe('sair', () => {
  it('o mesmo efeito, pelo próprio membro, sem revogar convites', async () => {
    const kept = await invite()
    expect((await leave(player)).status).toBe(204)
    expect((await characterRow()).status).toBe('archived')
    expect((await memberRows()).map(r => r.user_id)).toEqual([other.id])
    expect(await auditRows()).toEqual([
      {
        action: 'member.leave',
        actor_id: player.id,
        target_user_id: player.id,
        payload: { characters: [characterId] },
      },
    ])
    await cannotWrite(player)
    const invites = await as(
      ctx,
      storyteller,
      'GET',
      `/chronicles/${chronicleId}/invites`
    )
    const [listed] = (await invites.json()) as { id: string; active: boolean }[]
    expect(listed).toMatchObject({ id: kept.id, active: true })
  })

  it('o narrador não sai: 403', async () => {
    const res = await leave(storyteller)
    expect(res.status).toBe(403)
    expect(await auditRows()).toEqual([])
  })
})

describe('o ex-membro (former)', () => {
  beforeEach(async () => {
    await leave(player)
  })

  it('a crônica continua na lista dele, como former, contando só as fichas dele', async () => {
    await createCharacter(ctx, other, chronicleId, { name: 'Do outro' })
    const res = await as(ctx, player, 'GET', '/chronicles')
    expect(await res.json()).toEqual([
      expect.objectContaining({
        id: chronicleId,
        role: 'former',
        characterCount: 1,
      }),
    ])
  })

  it('lê a crônica sem os membros, e só as fichas dele', async () => {
    await createCharacter(ctx, other, chronicleId, { name: 'Do outro' })
    const detail = await as(ctx, player, 'GET', `/chronicles/${chronicleId}`)
    expect(await detail.json()).toMatchObject({ role: 'former', members: [] })
    const list = await as(
      ctx,
      player,
      'GET',
      `/chronicles/${chronicleId}/characters`
    )
    const body = (await list.json()) as { id: string }[]
    expect(body.map(c => c.id)).toEqual([characterId])
    expect(JSON.stringify(body)).not.toContain(other.id)
  })

  it('criando ficha: 403 NOT_MEMBER, e nenhuma linha nova', async () => {
    const res = await as(
      ctx,
      player,
      'POST',
      `/chronicles/${chronicleId}/characters`,
      { values: { name: 'Nova' } }
    )
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ code: 'NOT_MEMBER' })
    const rows = await ctx.db
      .selectFrom('characters')
      .select('id')
      .where('user_id', '=', player.id)
      .execute()
    expect(rows.map(r => r.id)).toEqual([characterId])
  })

  it('aceitando um convite válido: vira membro, gasta um uso, e as fichas continuam archived', async () => {
    const code = (await invite()).code
    const res = await as(ctx, player, 'POST', '/invites/accept', { code })
    expect(await res.json()).toEqual({ chronicleId, role: 'player' })
    expect((await memberRows()).map(r => r.user_id).sort()).toEqual(
      [other.id, player.id].sort()
    )
    const [listed] = (await (
      await as(ctx, storyteller, 'GET', `/chronicles/${chronicleId}/invites`)
    ).json()) as { uses: number }[]
    expect(listed?.uses).toBe(1)
    expect((await characterRow()).status).toBe('archived')
    // Membro de novo, mas a ficha arquivada continua só leitura para ele
    const write = await as(
      ctx,
      player,
      'POST',
      `/characters/${characterId}/events`,
      {
        clientBatchId: crypto.randomUUID(),
        events: [{ path: 'values.concept', from: null, to: 'Arquivista' }],
      }
    )
    expect(await write.json()).toMatchObject({ code: 'SHEET_NOT_EDITABLE' })
  })

  it('a ficha excluída tira o former: sem ficha, sem vínculo, 404', async () => {
    await ctx.db
      .updateTable('characters')
      .set({ deleted_at: new Date() })
      .where('id', '=', characterId)
      .execute()
    const res = await as(ctx, player, 'GET', `/chronicles/${chronicleId}`)
    expect(res.status).toBe(404)
  })
})
