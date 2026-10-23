/// <reference types="bun-types" />
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import type { RandomSource } from '@tms/sheet-core'
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
} from '../test/helpers'
import { systemCase } from '../test/matrix-systems'

let ctx: TestContext
let storyteller: TestUser
let player: TestUser
let other: TestUser
let chronicleId: string
const faces: number[] = []
const random: RandomSource = {
  nextUint32: () => (faces.shift() ?? 6) - 1,
}

beforeEach(async () => {
  await destroyTestDb()
  ctx = await createTestContext({ random })
  await publish(ctx, 'vtm-v20')
  storyteller = await createUser(ctx, 'narradora-v5')
  player = await createUser(ctx, 'jogadora-v5')
  other = await createUser(ctx, 'outra-v5')
  chronicleId = await createChronicle(ctx, storyteller)
  await addMember(ctx, chronicleId, player)
  await addMember(ctx, chronicleId, other)
})

afterEach(async () => destroyTestDb())

describe('NPCs e projeções', () => {
  it('oculta sentinela, revela identidade e depois ficha filtrada', async () => {
    const key = crypto.randomUUID()
    const created = await as(
      ctx,
      storyteller,
      'POST',
      `/chronicles/${chronicleId}/characters`,
      {
        kind: 'npc',
        clientCommandId: key,
        values: { name: 'Sentinela NPC', clan: 'tremere' },
      }
    )
    expect(created.status).toBe(201)
    const { id } = (await created.json()) as { id: string }
    const replay = await as(
      ctx,
      storyteller,
      'POST',
      `/chronicles/${chronicleId}/characters`,
      {
        kind: 'npc',
        clientCommandId: key,
        values: { name: 'Sentinela NPC', clan: 'tremere' },
      }
    )
    expect(await replay.json()).toMatchObject({ id, duplicate: true })
    await ctx.db
      .updateTable('characters')
      .set({
        sheet_data: JSON.stringify({
          values: {
            name: 'Sentinela NPC',
            clan: 'tremere',
            storytellerNotes: 'PRIVADO-NUNCA-VAZA',
          },
          specialties: {},
        }),
      })
      .where('id', '=', id)
      .execute()

    const hiddenList = await as(
      ctx,
      player,
      'GET',
      `/chronicles/${chronicleId}/characters`
    )
    expect(JSON.stringify(await hiddenList.json())).not.toContain('Sentinela')
    expect((await as(ctx, player, 'GET', `/characters/${id}`)).status).toBe(404)

    const identity = await as(
      ctx,
      storyteller,
      'POST',
      `/characters/${id}/visibility`,
      {
        clientCommandId: crypto.randomUUID(),
        visibility: 'identity',
        revision: 0,
      }
    )
    expect(identity.status).toBe(200)
    const publicList = JSON.stringify(
      await (
        await as(ctx, player, 'GET', `/chronicles/${chronicleId}/characters`)
      ).json()
    )
    expect(publicList).toContain('Sentinela NPC')
    expect(publicList).not.toContain('PRIVADO-NUNCA-VAZA')
    expect(publicList).not.toContain('values')

    await as(ctx, storyteller, 'POST', `/characters/${id}/visibility`, {
      clientCommandId: crypto.randomUUID(),
      visibility: 'full',
      revision: 1,
    })
    const full = await as(ctx, player, 'GET', `/characters/${id}`)
    const fullBody = await full.json()
    expect(full.status).toBe(200)
    expect(fullBody).toMatchObject({ projection: 'full', roles: ['viewer'] })
    expect(JSON.stringify(fullBody)).not.toContain('PRIVADO-NUNCA-VAZA')
    expect(JSON.stringify(fullBody)).not.toContain('creation')
    expect(
      (await as(ctx, player, 'GET', `/characters/${id}/rolls`)).status
    ).toBe(404)
  })
})

describe('rolagens de bastidores', () => {
  it('rolagem oculta com custo não aparece ao dono nem pelo histórico', async () => {
    const characterId = await createCharacter(ctx, player, chronicleId, {
      name: 'Helena Varga',
      dexterity: 3,
      athletics: 2,
      willpower: { current: 5, permanent: 7 },
      health: { aggravated: 0, lethal: 0, bashing: 0 },
    })
    faces.push(10, 6, 5, 4, 3)
    const rolled = await as(
      ctx,
      storyteller,
      'POST',
      `/characters/${characterId}/rolls`,
      {
        clientRollId: crypto.randomUUID(),
        slots: { attribute: 'dexterity', ability: 'athletics' },
        difficulty: 6,
        boosts: ['willpower'],
        hidden: true,
      }
    )
    expect(rolled.status).toBe(201)
    const ownerRolls = await as(
      ctx,
      player,
      'GET',
      `/characters/${characterId}/rolls`
    )
    expect(await ownerRolls.json()).toEqual({ items: [] })
    const ownerHistory = await as(
      ctx,
      player,
      'GET',
      `/characters/${characterId}/history`
    )
    expect(await ownerHistory.json()).toMatchObject({ items: [] })
    const stored = await ctx.db
      .selectFrom('character_rolls')
      .select(['hidden', 'batch_id'])
      .where('character_id', '=', characterId)
      .executeTakeFirstOrThrow()
    expect(stored).toMatchObject({ hidden: true, batch_id: expect.any(String) })
  })

  it('parada livre é oculta, idempotente por crônica e só entra no feed', async () => {
    faces.push(10, 6, 1)
    const key = crypto.randomUUID()
    const body = {
      clientRollId: key,
      dice: 3,
      difficulty: 6,
      specialty: false,
      label: 'Presságio secreto',
    }
    const first = await as(
      ctx,
      storyteller,
      'POST',
      `/chronicles/${chronicleId}/rolls`,
      body
    )
    expect(first.status).toBe(201)
    const firstBody = (await first.json()) as Record<string, unknown>
    const replay = await as(
      ctx,
      storyteller,
      'POST',
      `/chronicles/${chronicleId}/rolls`,
      body
    )
    expect(await replay.json()).toEqual({ ...firstBody, duplicate: true })
    expect(
      (await as(ctx, player, 'GET', `/chronicles/${chronicleId}/rolls`)).status
    ).toBe(404)
    const feed = await as(
      ctx,
      storyteller,
      'GET',
      `/chronicles/${chronicleId}/rolls`
    )
    expect(await feed.json()).toMatchObject({
      items: [
        {
          hidden: true,
          label: 'Presságio secreto',
          origin: { kind: 'free' },
        },
      ],
    })
  })

  it('a mesma chave em origens diferentes conflita sem devolver o resultado anterior', async () => {
    const firstCharacter = await createCharacter(ctx, player, chronicleId, {
      name: 'Primeira origem',
      dexterity: 2,
    })
    const secondCharacter = await createCharacter(ctx, other, chronicleId, {
      name: 'Segunda origem',
      dexterity: 2,
    })
    const key = crypto.randomUUID()
    const first = await as(
      ctx,
      storyteller,
      'POST',
      `/characters/${firstCharacter}/rolls`,
      {
        clientRollId: key,
        slots: { attribute: 'dexterity' },
        difficulty: 6,
        hidden: true,
      }
    )
    expect(first.status).toBe(201)
    const second = await as(
      ctx,
      storyteller,
      'POST',
      `/characters/${secondCharacter}/rolls`,
      {
        clientRollId: key,
        slots: { attribute: 'dexterity' },
        difficulty: 6,
        hidden: true,
      }
    )
    expect(second.status).toBe(409)
    const conflict = JSON.stringify(await second.json())
    expect(conflict).toContain('IDEMPOTENCY_CONFLICT')
    expect(conflict).not.toContain('Primeira origem')
    expect(conflict).not.toContain('faces')

    const free = await as(
      ctx,
      storyteller,
      'POST',
      `/chronicles/${chronicleId}/rolls`,
      {
        clientRollId: key,
        dice: 1,
        difficulty: 6,
        label: 'Outra intenção',
      }
    )
    expect(free.status).toBe(409)
  })
})

describe('sessões e transferência', () => {
  it('a data da sessão é civil em toda resposta, sem hora nem fuso', async () => {
    const path = `/chronicles/${chronicleId}/sessions`
    const command = {
      clientCommandId: crypto.randomUUID(),
      date: '2026-10-20',
      title: 'A véspera',
      summary: '',
      privateNotes: '',
    }
    const created = await as(ctx, storyteller, 'POST', path, command)
    expect(created.status).toBe(201)
    const session = (await created.json()) as { id: string; date: string }
    expect(session.date).toBe('2026-10-20')
    const replay = await as(ctx, storyteller, 'POST', path, command)
    expect(((await replay.json()) as { date: string }).date).toBe('2026-10-20')
    const edited = await as(
      ctx,
      storyteller,
      'PATCH',
      `${path}/${session.id}`,
      {
        clientCommandId: crypto.randomUUID(),
        revision: 0,
        date: '2026-10-21',
        title: 'A véspera',
        summary: '',
        privateNotes: '',
      }
    )
    expect(edited.status).toBe(200)
    expect(((await edited.json()) as { date: string }).date).toBe('2026-10-21')
    for (const user of [storyteller, player]) {
      const list = (await (await as(ctx, user, 'GET', path)).json()) as {
        items: { date: string }[]
      }
      expect(list.items.map(item => item.date)).toEqual(['2026-10-21'])
      const one = (await (
        await as(ctx, user, 'GET', `${path}/${session.id}`)
      ).json()) as { date: string }
      expect(one.date).toBe('2026-10-21')
      const chronicle = (await (
        await as(ctx, user, 'GET', `/chronicles/${chronicleId}`)
      ).json()) as { lastSession: { date: string } }
      expect(chronicle.lastSession.date).toBe('2026-10-21')
    }
  })

  it('nota privada não chega ao membro e a transferência preserva NPC', async () => {
    const session = await as(
      ctx,
      storyteller,
      'POST',
      `/chronicles/${chronicleId}/sessions`,
      {
        clientCommandId: crypto.randomUUID(),
        date: '2026-10-23',
        title: 'A porta fechada',
        summary: 'Resumo público',
        privateNotes: 'SEGREDO-DA-SESSAO',
      }
    )
    expect(session.status).toBe(201)
    const publicDiary = await as(
      ctx,
      player,
      'GET',
      `/chronicles/${chronicleId}/sessions`
    )
    const publicText = JSON.stringify(await publicDiary.json())
    expect(publicText).toContain('Resumo público')
    expect(publicText).not.toContain('SEGREDO-DA-SESSAO')

    const npc = await createCharacter(ctx, storyteller, chronicleId, {
      name: 'NPC transferido',
    })
    await ctx.db
      .updateTable('characters')
      .set({ kind: 'npc', visibility: 'hidden' })
      .where('id', '=', npc)
      .execute()
    const proposed = await as(
      ctx,
      storyteller,
      'POST',
      `/chronicles/${chronicleId}/transfer`,
      { clientCommandId: crypto.randomUUID(), recipientId: player.id }
    )
    const transfer = (await proposed.json()) as { id: string }
    const accepted = await as(
      ctx,
      player,
      'POST',
      `/chronicles/${chronicleId}/transfer/${transfer.id}/accept`,
      { clientCommandId: crypto.randomUUID() }
    )
    expect(accepted.status).toBe(200)
    const row = await ctx.db
      .selectFrom('characters')
      .select(['user_id', 'kind'])
      .where('id', '=', npc)
      .executeTakeFirstOrThrow()
    expect(row).toEqual({ user_id: player.id, kind: 'npc' })
    expect(
      (await as(ctx, storyteller, 'GET', `/chronicles/${chronicleId}/history`))
        .status
    ).toBe(404)
    expect(
      (await as(ctx, player, 'GET', `/chronicles/${chronicleId}/history`))
        .status
    ).toBe(200)
  })
})

describe('transferência: validade, decisões e autoridade', () => {
  const propose = (key = crypto.randomUUID(), recipientId = player.id) =>
    as(ctx, storyteller, 'POST', `/chronicles/${chronicleId}/transfer`, {
      clientCommandId: key,
      recipientId,
    })
  const decide = (
    user: TestUser,
    id: string,
    action: 'accept' | 'reject' | 'cancel',
    key = crypto.randomUUID()
  ) =>
    as(
      ctx,
      user,
      'POST',
      `/chronicles/${chronicleId}/transfer/${id}/${action}`,
      {
        clientCommandId: key,
      }
    )
  const storytellerOf = async () =>
    (
      await ctx.db
        .selectFrom('chronicles')
        .select('storyteller_id')
        .where('id', '=', chronicleId)
        .executeTakeFirstOrThrow()
    ).storyteller_id

  it('pedido vencido não é aceito nem trava a próxima proposta', async () => {
    const first = (await (await propose()).json()) as { id: string }
    ctx.clock.advance(7 * 24 * 60 * 60 * 1000)
    const seen = (await (
      await as(ctx, player, 'GET', `/chronicles/${chronicleId}/transfer`)
    ).json()) as { available: boolean; status: string }
    // Ler não muda o estado: continua pendente, só indisponível
    expect(seen).toMatchObject({ status: 'pending', available: false })
    const late = await decide(player, first.id, 'accept')
    expect(late.status).toBe(409)
    expect(((await late.json()) as { code: string }).code).toBe(
      'TRANSFER_UNAVAILABLE'
    )
    expect((await decide(storyteller, first.id, 'cancel')).status).toBe(409)
    expect(await storytellerOf()).toBe(storyteller.id)

    const again = await propose(crypto.randomUUID(), other.id)
    expect(again.status).toBe(201)
    const rows = await ctx.db
      .selectFrom('chronicle_transfers')
      .select(['id', 'status'])
      .where('chronicle_id', '=', chronicleId)
      .orderBy('requested_at')
      .execute()
    expect(rows.map(row => row.status)).toEqual(['expired', 'pending'])
  })

  it('recusa e cancelamento são do ator certo e idempotentes', async () => {
    const one = (await (await propose()).json()) as { id: string }
    expect(await propose(crypto.randomUUID(), other.id)).toHaveProperty(
      'status',
      409
    )
    // O narrador não recusa e o destinatário não cancela: 404
    expect((await decide(storyteller, one.id, 'reject')).status).toBe(404)
    expect((await decide(player, one.id, 'cancel')).status).toBe(404)
    expect((await decide(other, one.id, 'accept')).status).toBe(404)
    const key = crypto.randomUUID()
    expect(await (await decide(player, one.id, 'reject', key)).json()).toEqual({
      status: 'rejected',
      duplicate: false,
    })
    expect(await (await decide(player, one.id, 'reject', key)).json()).toEqual({
      status: 'rejected',
      duplicate: true,
    })
    expect((await decide(player, one.id, 'accept')).status).toBe(409)

    const two = (await (await propose()).json()) as { id: string }
    const cancelKey = crypto.randomUUID()
    expect(
      (await decide(storyteller, two.id, 'cancel', cancelKey)).status
    ).toBe(200)
    expect(
      await (await decide(storyteller, two.id, 'cancel', cancelKey)).json()
    ).toEqual({ status: 'cancelled', duplicate: true })
    expect(await storytellerOf()).toBe(storyteller.id)
  })

  it('só propõe a membro atual, e o destinatário que saiu não aceita', async () => {
    const stranger = await createUser(ctx, 'estranha-v5')
    expect((await propose(crypto.randomUUID(), stranger.id)).status).toBe(409)
    expect((await propose(crypto.randomUUID(), storyteller.id)).status).toBe(
      409
    )
    const key = crypto.randomUUID()
    const created = await propose(key)
    expect(created.status).toBe(201)
    const { id } = (await created.json()) as { id: string }
    // Reenvio com a mesma chave recupera; outra intenção conflita
    expect((await propose(key)).status).toBe(200)
    expect((await propose(key, other.id)).status).toBe(409)

    expect(
      (await as(ctx, player, 'DELETE', `/chronicles/${chronicleId}/members/me`))
        .status
    ).toBe(204)
    expect((await decide(player, id, 'accept')).status).toBe(409)
    expect(await storytellerOf()).toBe(storyteller.id)
  })

  it('após o aceite a autoridade antiga cai; excluir a conta não leva os NPCs', async () => {
    const npc = await createCharacter(ctx, storyteller, chronicleId, {
      name: 'NPC que fica',
    })
    await ctx.db
      .updateTable('characters')
      .set({ kind: 'npc', visibility: 'hidden' })
      .where('id', '=', npc)
      .execute()
    const own = await createCharacter(ctx, player, chronicleId, {
      name: 'Ficha da jogadora',
    })
    const { id } = (await (await propose()).json()) as { id: string }
    const key = crypto.randomUUID()
    expect((await decide(player, id, 'accept', key)).status).toBe(200)
    expect(await (await decide(player, id, 'accept', key)).json()).toEqual({
      accepted: true,
      duplicate: true,
    })
    expect(await storytellerOf()).toBe(player.id)

    // O antigo narrador é membro: sem configuração, auditoria, NPC oculto
    const settings = await as(
      ctx,
      storyteller,
      'PATCH',
      `/chronicles/${chronicleId}`,
      {
        clientCommandId: crypto.randomUUID(),
        revision: 0,
        name: 'Tomada',
      }
    )
    expect(settings.status).toBe(403)
    expect(
      (await as(ctx, storyteller, 'GET', `/chronicles/${chronicleId}/history`))
        .status
    ).toBe(404)
    expect(
      (await as(ctx, storyteller, 'GET', `/characters/${npc}`)).status
    ).toBe(404)
    const members = await ctx.db
      .selectFrom('chronicle_members')
      .select('user_id')
      .where('chronicle_id', '=', chronicleId)
      .execute()
    expect(members.map(m => m.user_id).sort()).toEqual(
      [storyteller.id, other.id].sort()
    )

    const gone = await as(ctx, storyteller, 'DELETE', '/me', {
      password: 'senha de teste longa o bastante',
    })
    expect(gone.status).toBe(204)
    const left = await ctx.db
      .selectFrom('characters')
      .select(['id', 'user_id'])
      .where('chronicle_id', '=', chronicleId)
      .where('id', 'in', [npc, own])
      .orderBy('id')
      .execute()
    expect(left).toEqual(
      [
        { id: npc, user_id: player.id },
        { id: own, user_id: player.id },
      ].sort((a, b) => (a.id < b.id ? -1 : 1))
    )
  })
})

describe('sessões e configurações: revisão, idempotência e validação', () => {
  const sessionsPath = () => `/chronicles/${chronicleId}/sessions`
  const newSession = async () =>
    (await (
      await as(ctx, storyteller, 'POST', sessionsPath(), {
        clientCommandId: crypto.randomUUID(),
        date: '2026-10-23',
        title: 'Sessão',
      })
    ).json()) as { id: string; revision: number }

  it('edição de sessão com revisão velha conflita sem gravar', async () => {
    const session = await newSession()
    const edit = (revision: number, title: string, key = crypto.randomUUID()) =>
      as(ctx, storyteller, 'PATCH', `${sessionsPath()}/${session.id}`, {
        clientCommandId: key,
        revision,
        date: '2026-10-23',
        title,
      })
    const key = crypto.randomUUID()
    expect((await edit(0, 'Primeira', key)).status).toBe(200)
    // O mesmo reenvio recupera mesmo com a revisão já avançada
    expect(
      (
        (await (await edit(0, 'Primeira', key)).json()) as {
          duplicate: boolean
        }
      ).duplicate
    ).toBe(true)
    expect((await edit(0, 'Outra', key)).status).toBe(409)
    const stale = await edit(0, 'Atrasada')
    expect(stale.status).toBe(409)
    expect(((await stale.json()) as { code: string }).code).toBe(
      'REVISION_CONFLICT'
    )
    const row = await ctx.db
      .selectFrom('chronicle_sessions')
      .select(['title', 'revision'])
      .where('id', '=', session.id)
      .executeTakeFirstOrThrow()
    expect(row).toEqual({ title: 'Primeira', revision: 1 })
    // Membro não edita; data impossível é recusada
    expect(
      (
        await as(ctx, player, 'PATCH', `${sessionsPath()}/${session.id}`, {
          clientCommandId: crypto.randomUUID(),
          revision: 1,
          date: '2026-10-23',
          title: 'Do jogador',
        })
      ).status
    ).toBe(403)
    expect((await edit(1, 'Fevereiro', crypto.randomUUID())).status).toBe(200)
    const invalid = await as(ctx, storyteller, 'POST', sessionsPath(), {
      clientCommandId: crypto.randomUUID(),
      date: '2026-02-30',
      title: 'Nunca',
    })
    expect(invalid.status).toBe(422)
  })

  it('sessão de outra crônica é 404, mesmo para quem narra as duas', async () => {
    const session = await newSession()
    const second = await createChronicle(ctx, storyteller, 'vtm-v20', 'Outra')
    expect(
      (
        await as(
          ctx,
          storyteller,
          'GET',
          `/chronicles/${second}/sessions/${session.id}`
        )
      ).status
    ).toBe(404)
  })

  it('configuração: opção fora do catálogo, URL sem HTTPS e revisão velha', async () => {
    const systemIdSent = crypto.randomUUID()
    const patch = (body: Record<string, unknown>) =>
      as(ctx, storyteller, 'PATCH', `/chronicles/${chronicleId}`, {
        clientCommandId: crypto.randomUUID(),
        revision: 0,
        ...body,
      })
    const option = await patch({ options: { inventada: true } })
    expect(option.status).toBe(422)
    expect(((await option.json()) as { code: string }).code).toBe(
      'CHRONICLE_OPTION_INVALID'
    )
    expect((await patch({ imageUrl: 'http://example.com/a.png' })).status).toBe(
      422
    )
    const renamed = await patch({
      name: 'Crônica Renomeada',
      imageUrl: 'https://example.com/a.png',
      // Fora do contrato: não troca sistema nem narrador
      systemId: systemIdSent,
      storytellerId: player.id,
    })
    expect(renamed.status).toBe(200)
    const row = await ctx.db
      .selectFrom('chronicles')
      .select(['name', 'storyteller_id', 'system_id', 'settings_revision'])
      .where('id', '=', chronicleId)
      .executeTakeFirstOrThrow()
    expect(row).toMatchObject({
      name: 'Crônica Renomeada',
      storyteller_id: storyteller.id,
      settings_revision: 1,
    })
    expect(row.system_id).not.toBe(systemIdSent)
    const stale = await patch({ name: 'Atrasada' })
    expect(stale.status).toBe(409)
    expect(((await stale.json()) as { code: string }).code).toBe(
      'REVISION_CONFLICT'
    )
  })
})

describe('auditoria consolidada', () => {
  it('pagina sem lacuna nem repetição com instantes iguais', async () => {
    const { notesField } = systemCase('vtm-v20')
    const character = await createCharacter(ctx, player, chronicleId)
    // O relógio falso não anda: todos os lotes e auditorias no mesmo instante
    let from: string | null = null
    for (let i = 0; i < 7; i++) {
      const to = `nota ${i}`
      const res = await as(
        ctx,
        storyteller,
        'POST',
        `/characters/${character}/events`,
        {
          clientBatchId: crypto.randomUUID(),
          events: [{ path: `values.${notesField}`, from, to }],
        }
      )
      expect(res.status).toBe(200)
      from = to
    }
    for (let i = 0; i < 3; i++)
      await as(
        ctx,
        storyteller,
        'POST',
        `/chronicles/${chronicleId}/sessions`,
        {
          clientCommandId: crypto.randomUUID(),
          date: '2026-10-23',
          title: `Sessão ${i}`,
        }
      )
    const path = `/chronicles/${chronicleId}/history`
    const all = (await (
      await as(ctx, storyteller, 'GET', `${path}?limit=100`)
    ).json()) as {
      items: { source: string; id: string }[]
      nextCursor: string | null
    }
    expect(all.nextCursor).toBeNull()
    expect(all.items.length).toBeGreaterThanOrEqual(10)
    const seen: string[] = []
    let cursor: string | null = null
    do {
      const query: string = cursor ? `&cursor=${cursor}` : ''
      const page = (await (
        await as(ctx, storyteller, 'GET', `${path}?limit=3${query}`)
      ).json()) as {
        items: { source: string; id: string }[]
        nextCursor: string | null
      }
      expect(page.items.length).toBeLessThanOrEqual(3)
      seen.push(...page.items.map(item => `${item.source}:${item.id}`))
      cursor = page.nextCursor
    } while (cursor)
    expect(seen).toEqual(all.items.map(item => `${item.source}:${item.id}`))
    expect(new Set(seen).size).toBe(seen.length)

    // Filtro de ficha de outra crônica e cursor forjado
    const elsewhere = await createChronicle(
      ctx,
      storyteller,
      'vtm-v20',
      'Outra'
    )
    const foreign = await createCharacter(ctx, storyteller, elsewhere)
    expect(
      (await as(ctx, storyteller, 'GET', `${path}?characterId=${foreign}`))
        .status
    ).toBe(404)
    expect(
      (await as(ctx, storyteller, 'GET', `${path}?cursor=xyz`)).status
    ).toBe(422)
    expect(
      (await as(ctx, storyteller, 'GET', `${path}?limit=101`)).status
    ).toBe(400)
  })
})
