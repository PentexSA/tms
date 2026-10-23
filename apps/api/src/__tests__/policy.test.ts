/// <reference types="bun-types" />
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import {
  type ChangeClass,
  compileTemplate,
  type ResourceValue,
  resolve,
  type SheetData,
  type SheetEvent,
  stored,
} from '@tms/sheet-core'
import {
  addMember,
  as,
  createCharacter,
  createChronicle,
  createUser,
  publish,
  setStatus,
  type TestUser,
  template,
} from '../test/factories'
import {
  createTestContext,
  destroyTestDb,
  type TestContext,
} from '../test/helpers'
import { MATRIX_SYSTEMS, systemCase } from '../test/matrix-systems'

// A política de escrita (doc/painel-narrador.md §5.1; doc/plano-v3.md, Etapa 5):
// cada estado × cada classe de mudança × dono, narrador e ex-membro, nos três
// sistemas, mais os critérios de aceite do 5.1. A matriz de rotas diz quem
// chega à rota; esta tabela diz o que passa dentro dela.

type State = 'creating' | 'active' | 'locked' | 'archived' | 'dead'
type Who = 'owner' | 'storyteller' | 'former'

// O que o dono recebe; o narrador grava sempre, o ex-membro nunca.
const OWNER: Record<State, Record<ChangeClass, string>> = {
  creating: { play: 'ok', edit: 'ok', advance: 'ok' },
  active: { play: 'ok', edit: 'ok', advance: 'NEEDS_XP_APPROVAL' },
  locked: {
    play: 'SHEET_LOCKED',
    edit: 'SHEET_LOCKED',
    advance: 'SHEET_LOCKED',
  },
  archived: {
    play: 'SHEET_NOT_EDITABLE',
    edit: 'SHEET_NOT_EDITABLE',
    advance: 'SHEET_NOT_EDITABLE',
  },
  dead: {
    play: 'SHEET_NOT_EDITABLE',
    edit: 'SHEET_NOT_EDITABLE',
    advance: 'SHEET_NOT_EDITABLE',
  },
}
const expected = (who: Who, state: State, cls: ChangeClass) =>
  who === 'storyteller'
    ? 'ok'
    : who === 'former'
      ? 'NOT_MEMBER'
      : OWNER[state][cls]

// O que cada ficha nova tem além do nome: a FdV padrão de cada sistema vem de
// um campo diferente (Coragem, tribo, fixa)
const BASE: Record<string, Record<string, unknown>> = {
  'vtm-v20': { courage: 3 },
  'mta-m20': {},
  'wta-w20': { tribe: 'fianna' },
}

let ctx: TestContext
let storyteller: TestUser
let owner: TestUser
// Dono de ficha sem vínculo na crônica: o removido, até a Etapa 7
let former: TestUser
const chronicles: Record<string, string> = {}
const users = (): Record<Who, TestUser> => ({ owner, storyteller, former })

beforeAll(async () => {
  await destroyTestDb()
  ctx = await createTestContext()
  storyteller = await createUser(ctx, 'narradora')
  owner = await createUser(ctx, 'dona')
  former = await createUser(ctx, 'antiga')
  for (const system of MATRIX_SYSTEMS) {
    await publish(ctx, system)
    chronicles[system] = await createChronicle(ctx, storyteller, system)
    await addMember(ctx, chronicles[system] as string, owner)
  }
})
afterAll(async () => {
  await destroyTestDb()
})
// Os limites por minuto (lotes e rolagens) não entram na conta
beforeEach(() => {
  ctx.clock.advance(60_000)
})

async function sheet(
  system: string,
  opts: { who?: TestUser; state?: State; values?: Record<string, unknown> } = {}
) {
  const id = await createCharacter(
    ctx,
    opts.who ?? owner,
    chronicles[system] as string,
    { name: 'Ficha', ...BASE[system], ...opts.values }
  )
  const state = opts.state ?? 'creating'
  if (state !== 'creating')
    await setStatus(
      ctx,
      id,
      state === 'locked' ? 'active' : state,
      state === 'locked'
    )
  return id
}

// A FdV efetiva de uma ficha nova, sem valor gravado
function willpower(system: string): ResourceValue {
  const model = compileTemplate(template(system))
  const r = resolve(model, {
    values: { name: 'Ficha', ...BASE[system] },
  } as SheetData)
  return stored(r.get('willpower')!, r) as ResourceValue
}

const spend = (system: string): SheetEvent => {
  const w = willpower(system)
  return {
    path: 'values.willpower',
    from: null,
    to: { ...w, current: w.current - 1 },
  }
}

const EVENTS: Record<ChangeClass, (system: string) => SheetEvent> = {
  play: spend,
  edit: system => ({
    path: `values.${systemCase(system).textField}`,
    from: null,
    to: 'Arquivista',
  }),
  advance: () => ({ path: 'values.strength', from: null, to: 3 }),
}

const send = (user: TestUser, id: string, events: SheetEvent[]) =>
  as(ctx, user, 'POST', `/characters/${id}/events`, {
    clientBatchId: crypto.randomUUID(),
    events,
  })

const rollAs = (user: TestUser, id: string, system: string, cost: boolean) =>
  as(ctx, user, 'POST', `/characters/${id}/rolls`, {
    clientRollId: crypto.randomUUID(),
    slots: systemCase(system).slots,
    difficulty: 6,
    ...(cost && { boosts: ['willpower'] }),
  })

const version = async (id: string) =>
  (
    await ctx.db
      .selectFrom('characters')
      .select('sheet_version')
      .where('id', '=', id)
      .executeTakeFirstOrThrow()
  ).sheet_version

const auditOf = (id: string) =>
  ctx.db
    .selectFrom('chronicle_audit')
    .select(['action', 'actor_id', 'target_user_id', 'payload'])
    .where('target_character_id', '=', id)
    .orderBy('created_at')
    .execute()

// Recusa da política: 403 com o código e os caminhos, e a ficha não muda
async function refused(res: Response, id: string, code: string) {
  expect(res.status).toBe(403)
  const body = (await res.json()) as Record<string, unknown>
  expect(Object.keys(body).sort()).toEqual(['code', 'error', 'paths'])
  expect(body.code).toBe(code)
  expect(await version(id)).toBe(0)
  return body as { code: string; paths: string[] }
}

for (const system of MATRIX_SYSTEMS) {
  describe(`política: a tabela, ${system}`, () => {
    for (const who of ['owner', 'storyteller', 'former'] as const)
      for (const state of Object.keys(OWNER) as State[])
        for (const cls of ['play', 'edit', 'advance'] as const) {
          const want = expected(who, state, cls)
          it(`${who} em ${state}, ${cls} → ${want}`, async () => {
            const id = await sheet(system, {
              who: who === 'former' ? former : owner,
              state,
            })
            const event = EVENTS[cls](system)
            const res = await send(users()[who], id, [event])
            if (want === 'ok') {
              expect(res.status).toBe(200)
              expect(await version(id)).toBe(1)
            } else {
              const body = await refused(res, id, want)
              expect(body.paths).toContain(event.path)
            }
          })
        }
  })

  describe(`política: critérios do 5.1, ${system}`, () => {
    it('em active, o dono gasta FdV temporária e não sobe a permanente; os dois juntos caem inteiros', async () => {
      const w = willpower(system)
      const id = await sheet(system, { state: 'active' })
      const raise = {
        path: 'values.willpower',
        from: null,
        to: { ...w, permanent: w.permanent! + 1 },
      }
      const body = await refused(
        await send(owner, id, [raise]),
        id,
        'NEEDS_XP_APPROVAL'
      )
      expect(body.paths).toContain('values.willpower#permanent')
      // Gasta e sobe no mesmo evento, mais um texto: nada entra
      const both = {
        path: 'values.willpower',
        from: null,
        to: { current: w.current - 1, permanent: w.permanent! + 1 },
      }
      await refused(
        await send(owner, id, [both, EVENTS.edit(system)]),
        id,
        'NEEDS_XP_APPROVAL'
      )
      expect((await send(owner, id, [spend(system)])).status).toBe(200)
    })

    it('o narrador conclui uma ficha sem FdV gravada, e o primeiro gasto do dono entra, pelo lote e pela rolagem', async () => {
      const id = await sheet(system)
      const done = await as(
        ctx,
        storyteller,
        'POST',
        `/characters/${id}/creation/complete`
      )
      expect(done.status).toBe(200)
      expect(await done.json()).toMatchObject({
        status: 'active',
        lockedAt: null,
        creationCompletedAt: expect.any(String),
      })
      expect((await send(owner, id, [spend(system)])).status).toBe(200)

      const other = await sheet(system, { state: 'active' })
      const rolled = await rollAs(owner, other, system, true)
      expect(rolled.status).toBe(201)
      expect(await version(other)).toBe(1)
    })

    it('o dono sobe um rating em creating e não em active', async () => {
      const creating = await sheet(system)
      expect(
        (await send(owner, creating, [EVENTS.advance(system)])).status
      ).toBe(200)
      const active = await sheet(system, { state: 'active' })
      await refused(
        await send(owner, active, [EVENTS.advance(system)]),
        active,
        'NEEDS_XP_APPROVAL'
      )
    })

    it('travada: o dono não rola com custo, e rola sem custo', async () => {
      const id = await sheet(system, { state: 'locked' })
      await refused(await rollAs(owner, id, system, true), id, 'SHEET_LOCKED')
      expect(
        await ctx.db
          .selectFrom('character_rolls')
          .select('id')
          .where('character_id', '=', id)
          .execute()
      ).toEqual([])
      expect((await rollAs(owner, id, system, false)).status).toBe(201)
      // O narrador rola com custo na ficha travada
      expect((await rollAs(storyteller, id, system, true)).status).toBe(201)
    })

    it('o ex-membro lê a ficha arquivada e recebe 403 em /events e em /rolls', async () => {
      const id = await sheet(system, { who: former, state: 'archived' })
      const read = await as(ctx, former, 'GET', `/characters/${id}`)
      expect(read.status).toBe(200)
      expect(await read.json()).toMatchObject({
        status: 'archived',
        lockedAt: null,
        roles: ['owner'],
      })
      await refused(
        await send(former, id, [EVENTS.edit(system)]),
        id,
        'NOT_MEMBER'
      )
      await refused(await rollAs(former, id, system, false), id, 'NOT_MEMBER')
      await refused(await rollAs(former, id, system, true), id, 'NOT_MEMBER')
    })

    it('um lote de Evoluir feito em creating e enviado depois da conclusão é recusado', async () => {
      const id = await sheet(system)
      // O lote nasce em creating (o aparelho só o manda depois)
      const draft = [EVENTS.advance(system), EVENTS.edit(system)]
      await as(ctx, storyteller, 'POST', `/characters/${id}/creation/complete`)
      await refused(await send(owner, id, draft), id, 'NEEDS_XP_APPROVAL')
    })

    it('um gasto de FdV enviado depois da trava é recusado', async () => {
      const id = await sheet(system, { state: 'active' })
      const spent = spend(system)
      const lock = await as(ctx, storyteller, 'POST', `/characters/${id}/lock`)
      expect(lock.status).toBe(200)
      expect(await lock.json()).toMatchObject({ lockedAt: expect.any(String) })
      await refused(await send(owner, id, [spent]), id, 'SHEET_LOCKED')
    })
  })
}

describe('política: o efeito, não o evento', () => {
  it('Lobisomem sem FdV gravada, em active: trocar a tribo muda a FdV padrão e pede o narrador', async () => {
    const id = await sheet('wta-w20', { state: 'active' })
    const body = await refused(
      await send(owner, id, [
        {
          path: 'values.tribe',
          from: 'fianna',
          to: 'observadores-das-estrelas',
        },
      ]),
      id,
      'NEEDS_XP_APPROVAL'
    )
    // O caminho do lote e o da parte que pesou, o campo que o lote não citou
    expect(body.paths.sort()).toEqual([
      'values.tribe',
      'values.willpower#permanent',
    ])
  })

  it('com a FdV gravada, trocar a tribo em active é só edit', async () => {
    const w = willpower('wta-w20')
    const id = await sheet('wta-w20', {
      state: 'active',
      values: { willpower: w },
    })
    const res = await send(owner, id, [
      { path: 'values.tribe', from: 'fianna', to: 'observadores-das-estrelas' },
    ])
    expect(res.status).toBe(200)
  })

  it('o conflito vem antes da política: 409 com o valor atual, mesmo em ficha travada', async () => {
    const id = await sheet('vtm-v20', { state: 'locked' })
    const res = await send(owner, id, [
      { path: 'values.strength', from: 4, to: 5 },
    ])
    expect(res.status).toBe(409)
  })

  it('o 403 nunca traz o valor', async () => {
    const id = await sheet('vtm-v20', { state: 'active' })
    const res = await send(owner, id, [
      { path: 'values.strength', from: null, to: 4 },
    ])
    const text = await res.text()
    expect(res.status).toBe(403)
    expect(text).not.toContain('"to"')
    expect(text).not.toMatch(/:\s*4\b/)
  })
})

describe('ações do narrador', () => {
  const post = (id: string, path: string, body?: unknown) =>
    as(ctx, storyteller, 'POST', `/characters/${id}${path}`, body)

  it('concluir duas vezes dá 409, e só há uma linha no registro', async () => {
    const id = await sheet('vtm-v20')
    expect((await post(id, '/creation/complete')).status).toBe(200)
    const again = await post(id, '/creation/complete')
    expect(again.status).toBe(409)
    expect(await again.json()).toMatchObject({ error: 'criação já concluída' })
    const rows = await auditOf(id)
    expect(rows).toEqual([
      {
        action: 'character.creation.complete',
        actor_id: storyteller.id,
        target_user_id: owner.id,
        payload: {},
      },
    ])
    const row = await ctx.db
      .selectFrom('characters')
      .select(['status', 'creation_completed_by'])
      .where('id', '=', id)
      .executeTakeFirstOrThrow()
    expect(row).toEqual({
      status: 'active',
      creation_completed_by: storyteller.id,
    })
  })

  it('cada ação gera exatamente uma linha, e sair de active limpa a trava', async () => {
    const id = await sheet('mta-m20')
    expect((await post(id, '/creation/complete')).status).toBe(200)
    expect((await post(id, '/lock')).status).toBe(200)
    const unlock = await as(
      ctx,
      storyteller,
      'DELETE',
      `/characters/${id}/lock`
    )
    expect(unlock.status).toBe(200)
    expect((await post(id, '/lock')).status).toBe(200)
    const archived = await post(id, '/status', { status: 'archived' })
    expect(archived.status).toBe(200)
    expect(await archived.json()).toMatchObject({
      status: 'archived',
      lockedAt: null,
    })
    const back = await post(id, '/status', { status: 'active' })
    expect(await back.json()).toMatchObject({
      status: 'active',
      lockedAt: null,
    })
    expect((await post(id, '/status', { status: 'dead' })).status).toBe(200)
    expect((await auditOf(id)).map(r => [r.action, r.payload])).toEqual([
      ['character.creation.complete', {}],
      ['character.lock', {}],
      ['character.unlock', {}],
      ['character.lock', {}],
      ['character.status', { from: 'active', to: 'archived', unlocked: true }],
      ['character.status', { from: 'archived', to: 'active' }],
      ['character.status', { from: 'active', to: 'dead' }],
    ])
  })

  it('o que não muda nada é 409, sem linha', async () => {
    const id = await sheet('wta-w20')
    // De creating para active, só concluindo
    expect((await post(id, '/status', { status: 'active' })).status).toBe(409)
    // A trava só vale em active
    expect((await post(id, '/lock')).status).toBe(409)
    const unlock = await as(
      ctx,
      storyteller,
      'DELETE',
      `/characters/${id}/lock`
    )
    expect(unlock.status).toBe(409)
    expect((await post(id, '/status', { status: 'dead' })).status).toBe(200)
    expect((await post(id, '/status', { status: 'dead' })).status).toBe(409)
    expect((await post(id, '/creation/complete')).status).toBe(409)
    expect(await auditOf(id)).toHaveLength(1)
  })

  it('voltar para creating, ou um estado que não existe, é 422', async () => {
    const id = await sheet('vtm-v20', { state: 'active' })
    for (const status of ['creating', 'pending', 'ativo'])
      expect((await post(id, '/status', { status })).status).toBe(422)
    expect(await auditOf(id)).toEqual([])
  })

  it('o narrador escreve em todos os estados', async () => {
    for (const state of Object.keys(OWNER) as State[]) {
      const id = await sheet('vtm-v20', { state })
      const res = await send(storyteller, id, [EVENTS.advance('vtm-v20')])
      expect(res.status).toBe(200)
    }
  })
})

describe('excluir a ficha passa pela política (§7, decisão 5)', () => {
  const remove = (user: TestUser, id: string) =>
    as(ctx, user, 'DELETE', `/characters/${id}`)

  it('o dono exclui em creating e em active sem trava, e a exclusão entra no registro', async () => {
    for (const state of ['creating', 'active'] as const) {
      const id = await sheet('vtm-v20', { state })
      expect((await remove(owner, id)).status).toBe(204)
      expect(await auditOf(id)).toEqual([
        {
          action: 'character.delete',
          actor_id: owner.id,
          target_user_id: owner.id,
          payload: { status: state },
        },
      ])
    }
  })

  it('travada, arquivada ou fora de jogo, o dono não exclui', async () => {
    for (const [state, code] of [
      ['locked', 'SHEET_LOCKED'],
      ['archived', 'SHEET_NOT_EDITABLE'],
      ['dead', 'SHEET_NOT_EDITABLE'],
    ] as const) {
      const id = await sheet('vtm-v20', { state })
      const res = await remove(owner, id)
      expect(res.status).toBe(403)
      expect(await res.json()).toMatchObject({ code, paths: [] })
      expect(await auditOf(id)).toEqual([])
    }
  })

  it('o ex-membro nunca exclui; o narrador, sempre', async () => {
    const id = await sheet('vtm-v20', { who: former })
    const res = await remove(former, id)
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ code: 'NOT_MEMBER' })
    const locked = await sheet('vtm-v20', { state: 'locked' })
    expect((await remove(storyteller, locked)).status).toBe(204)
  })
})
