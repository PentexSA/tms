/// <reference types="bun-types" />
import { afterAll, beforeEach, describe, expect, it } from 'bun:test'
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

// Criação por pontos e aprovação na API (doc/plano-v4.md, Etapa 4), com o
// template sintético `acct-teste` (números de teste, nunca publicado fora do
// banco de teste). Os templates do produto ainda não têm `creation` (2b).

const SYSTEM = 'testes/acct-teste'
const PRIORITIES = {
  priorities: {
    attributes: ['phys', 'soc', 'men'],
    abilities: ['talents', 'knowledges'],
  },
}
// Fecha a conta exata sem bônus (os mesmos números do teste do core)
const COMPLETE = {
  name: 'Teste',
  lineage: 'a',
  str: 3,
  dex: 3,
  sta: 2,
  cha: 2,
  man: 2,
  app: 2,
  per: 2,
  int: 2,
  wit: 1,
  alert: 3,
  brawl: 2,
  lore: 2,
  occult: 1,
  powers: [
    { id: 'p1', name: 'Velocidade', value: 2 },
    { id: 'p2', name: 'Visão', value: 1 },
  ],
  gifts: [
    { id: 'g1', name: 'Um' },
    { id: 'g2', name: 'Dois' },
  ],
  con: 3,
  ctl: 3,
}

let ctx: TestContext
let storyteller: TestUser
let owner: TestUser
let player: TestUser
let chronicleId: string

beforeEach(async () => {
  await destroyTestDb()
  ctx = await createTestContext()
  await publish(ctx, SYSTEM)
  storyteller = await createUser(ctx, 'narradora')
  owner = await createUser(ctx, 'dona')
  player = await createUser(ctx, 'jogador')
  chronicleId = await createChronicle(ctx, storyteller, 'acct-teste')
  await addMember(ctx, chronicleId, owner)
  await addMember(ctx, chronicleId, player)
})

afterAll(async () => {
  await destroyTestDb()
})

const json = async (res: Response) =>
  (await res.json()) as Record<string, unknown>
const character = (values: Record<string, unknown> = COMPLETE) =>
  createCharacter(ctx, owner, chronicleId, values)
const choose = (id: string, by = owner, revision = 0) =>
  as(ctx, by, 'PATCH', `/characters/${id}/creation`, {
    revision,
    choices: PRIORITIES,
  })
const complete = (id: string, by = owner, body?: unknown) =>
  as(ctx, by, 'POST', `/characters/${id}/creation/complete`, body)
const send = (
  id: string,
  by: TestUser,
  path: string,
  from: unknown,
  to: unknown
) =>
  as(ctx, by, 'POST', `/characters/${id}/events`, {
    clientBatchId: crypto.randomUUID(),
    events: [{ path: `values.${path}`, from, to }],
  })
const row = (id: string) =>
  ctx.db
    .selectFrom('characters')
    .select([
      'status',
      'sheet_version',
      'sheet_data',
      'creation',
      'creation_revision',
      'creation_completed_by',
      'approved_by',
      'activated_at',
    ])
    .where('id', '=', id)
    .executeTakeFirstOrThrow()
const auditOf = (id: string) =>
  ctx.db
    .selectFrom('chronicle_audit')
    .select(['action', 'payload'])
    .where('target_character_id', '=', id)
    .orderBy('created_at')
    .execute()
const approval = (on: boolean, revision = 0) =>
  as(
    ctx,
    storyteller,
    'PATCH',
    `/chronicles/${chronicleId}/creation-settings`,
    {
      revision,
      approval: on,
    }
  )

describe('escolhas e configuração', () => {
  it('o dono salva prioridades; a revisão protege contra escolha velha', async () => {
    const id = await character({ name: 'Nova' })
    const saved = await choose(id)
    expect(saved.status).toBe(200)
    const body = (await saved.json()) as {
      creation: { revision: number; choices: unknown; mode: string }
      check: { complete: boolean }
    }
    expect(body.creation).toMatchObject({
      revision: 1,
      mode: 'points',
      choices: PRIORITIES,
    })
    expect(body.check.complete).toBe(false)
    const stale = await choose(id, owner, 0)
    expect(stale.status).toBe(409)
    expect(await json(stale)).toMatchObject({
      code: 'CREATION_REVISION_CONFLICT',
      revision: 1,
    })
  })

  it('prioridade inválida é 422; o dono não ajusta orçamento', async () => {
    const id = await character({ name: 'Nova' })
    const bad = await as(ctx, owner, 'PATCH', `/characters/${id}/creation`, {
      revision: 0,
      choices: { priorities: { attributes: ['phys', 'phys', 'men'] } },
    })
    expect(bad.status).toBe(422)
    const budget = await as(ctx, owner, 'PATCH', `/characters/${id}/creation`, {
      revision: 0,
      config: { freebies: 50 },
    })
    expect(budget.status).toBe(403)
    expect((await row(id)).creation_revision).toBe(0)
  })

  it('o narrador ajusta o orçamento, com registro; cortar abaixo do gasto é recusado', async () => {
    const id = await character({ ...COMPLETE, str: 4 })
    expect((await choose(id)).status).toBe(200)
    const cut = await as(
      ctx,
      storyteller,
      'PATCH',
      `/characters/${id}/creation`,
      {
        revision: 1,
        config: { freebies: 0 },
      }
    )
    expect(cut.status).toBe(422)
    expect(await json(cut)).toMatchObject({ code: 'CREATION_BUDGET_EXCEEDED' })
    const more = await as(
      ctx,
      storyteller,
      'PATCH',
      `/characters/${id}/creation`,
      {
        revision: 1,
        config: { freebies: 20 },
      }
    )
    expect(more.status).toBe(200)
    expect(await json(more)).toMatchObject({
      creation: { effective: { mode: 'points', freebies: 20 } },
    })
    expect((await auditOf(id)).map(r => r.action)).toEqual([
      'character.creation.update',
    ])
  })

  it('o padrão da crônica vale para fichas novas, não para as que já existem', async () => {
    const before = await character({ name: 'Antes' })
    const set = await as(
      ctx,
      storyteller,
      'PATCH',
      `/chronicles/${chronicleId}/creation-settings`,
      { revision: 0, defaults: { freebies: 15 } }
    )
    expect(set.status).toBe(200)
    expect(await json(set)).toEqual({
      approval: false,
      defaults: { freebies: 15 },
      revision: 1,
    })
    const created = await as(
      ctx,
      owner,
      'POST',
      `/chronicles/${chronicleId}/characters`,
      {
        values: { name: 'Depois' },
      }
    )
    const { id } = (await created.json()) as { id: string }
    const read = async (cid: string) =>
      (
        (await json(await as(ctx, owner, 'GET', `/characters/${cid}`)))
          .creation as {
          effective: { freebies: number }
        }
      ).effective.freebies
    expect(await read(id)).toBe(15)
    expect(await read(before)).toBe(10)
    const invalid = await as(
      ctx,
      storyteller,
      'PATCH',
      `/chronicles/${chronicleId}/creation-settings`,
      { revision: 1, defaults: { budgets: { nope: 1 } } }
    )
    expect(invalid.status).toBe(422)
    const stale = await approval(true, 0)
    expect(stale.status).toBe(409)
  })
})

describe('/events: avaliação parcial', () => {
  it('aceita básico faltando, recusa bônus acima do saldo sem aplicar', async () => {
    const id = await character({ ...COMPLETE, str: 2 })
    await choose(id)
    // Faltando básico: passa
    expect((await send(id, owner, 'str', 2, 3)).status).toBe(200)
    // Acima dos básicos, pago com bônus: 2 pontos a 5, 10 de 10
    expect((await send(id, owner, 'dex', 3, 5)).status).toBe(200)
    const tooMuch = await send(id, owner, 'sta', 2, 3)
    expect(tooMuch.status).toBe(422)
    expect(await json(tooMuch)).toMatchObject({
      code: 'CREATION_BUDGET_EXCEEDED',
      problems: [{ code: 'CREATION_FREEBIES_EXCEEDED', severity: 'blocking' }],
    })
    expect(
      ((await row(id)).sheet_data as { values: { sta: number } }).values.sta
    ).toBe(2)
  })

  it('sem prioridade, o avanço do grupo é recusado e o nome continua editável', async () => {
    const id = await character({ name: 'Nova' })
    const advance = await send(id, owner, 'str', null, 2)
    expect(advance.status).toBe(422)
    expect(await json(advance)).toMatchObject({
      code: 'CREATION_PRIORITIES_REQUIRED',
    })
    expect((await send(id, owner, 'name', 'Nova', 'Outra')).status).toBe(200)
  })

  it('o narrador também passa pela conta (sem bypass por papel)', async () => {
    const id = await character()
    await choose(id)
    const over = await send(id, storyteller, 'str', 3, 5)
    expect(over.status).toBe(200)
    expect((await send(id, storyteller, 'dex', 3, 5)).status).toBe(422)
  })
})

describe('concluir, aprovar e devolver', () => {
  it('conta incompleta: 422 por grupo; aprovação desligada vai direto a active', async () => {
    const id = await character({ ...COMPLETE, wit: 0, str: 2 })
    await choose(id)
    const incomplete = await complete(id)
    expect(incomplete.status).toBe(422)
    const body = (await json(incomplete)) as {
      code: string
      problems: { code: string; group?: string }[]
    }
    expect(body.code).toBe('CREATION_INCOMPLETE')
    expect(body.problems.map(p => [p.code, p.group])).toContainEqual([
      'CREATION_BASICS_UNSPENT',
      'phys',
    ])

    const ok = await character()
    await choose(ok)
    const done = await complete(ok)
    expect(done.status).toBe(200)
    expect(await json(done)).toMatchObject({
      status: 'active',
      approvedAt: null,
      duplicate: false,
    })
    const r = await row(ok)
    expect(r.activated_at).not.toBeNull()
    expect(r.creation_completed_by).toBe(owner.id)
    // Iniciais com fórmula gravados: a Moral não sobe de graça depois
    expect(
      (r.sheet_data as { values: Record<string, unknown> }).values
    ).toMatchObject({
      morality: 6,
      will: { current: 3, permanent: 3 },
    })
    expect((await auditOf(ok)).map(a => [a.action, a.payload])).toEqual([
      ['character.creation.complete', { mode: 'points', approved: false }],
    ])
  })

  it('aprovação ligada: pending trava o dono; o narrador aprova', async () => {
    expect((await approval(true)).status).toBe(200)
    const id = await character()
    await choose(id)
    const sent = await complete(id)
    expect(await json(sent)).toMatchObject({ status: 'pending' })
    // A lista da crônica avisa o narrador da ficha que aguarda a revisão
    const list = (await json(
      await as(ctx, storyteller, 'GET', `/chronicles/${chronicleId}/characters`)
    )) as unknown as { id: string; status: string }[]
    expect(list.find(c => c.id === id)?.status).toBe('pending')
    const pendingReview = async (user: TestUser) =>
      (
        (await json(await as(ctx, user, 'GET', '/chronicles'))) as unknown as {
          pendingReview: number
        }[]
      )[0]?.pendingReview
    expect(await pendingReview(storyteller)).toBe(1)
    // O jogador não recebe a conta da revisão
    expect(await pendingReview(owner)).toBe(0)
    const write = await send(id, owner, 'name', 'Teste', 'X')
    expect(write.status).toBe(403)
    expect(await json(write)).toMatchObject({
      code: 'SHEET_NOT_EDITABLE',
      reason: 'pending',
      error: 'a ficha aguarda aprovação do narrador',
    })
    const roll = await as(ctx, owner, 'POST', `/characters/${id}/rolls`, {
      clientRollId: crypto.randomUUID(),
      slots: { attr: 'str' },
      difficulty: 6,
    })
    expect(roll.status).toBe(403)
    expect(await json(roll)).toMatchObject({ reason: 'pending' })
    // Desligar a aprovação não ativa quem já está pendente (§2.3, 15)
    expect((await approval(false, 1)).status).toBe(200)
    expect((await row(id)).status).toBe('pending')
    // O dono não aprova a si mesmo
    expect(
      (await as(ctx, owner, 'POST', `/characters/${id}/creation/approve`))
        .status
    ).toBe(403)
    const key = crypto.randomUUID()
    const ok = await as(
      ctx,
      storyteller,
      'POST',
      `/characters/${id}/creation/approve`,
      {
        clientCommandId: key,
      }
    )
    expect(await json(ok)).toMatchObject({ status: 'active', duplicate: false })
    // Reenvio com a mesma chave recupera o resultado, sem nova linha
    const again = await as(
      ctx,
      storyteller,
      'POST',
      `/characters/${id}/creation/approve`,
      {
        clientCommandId: key,
      }
    )
    expect(again.status).toBe(200)
    expect(await json(again)).toMatchObject({
      status: 'active',
      duplicate: true,
    })
    const reused = await as(
      ctx,
      storyteller,
      'POST',
      `/characters/${id}/creation/approve`,
      {
        clientCommandId: key,
        revision: 9,
      }
    )
    expect(reused.status).toBe(409)
    expect(await json(reused)).toMatchObject({ code: 'COMMAND_KEY_REUSED' })
    expect((await auditOf(id)).map(a => a.action)).toEqual([
      'character.creation.submit',
      'character.creation.approve',
    ])
    expect((await row(id)).approved_by).toBe(storyteller.id)
    // Aprovar de novo, sem chave: 409
    expect(
      (await as(ctx, storyteller, 'POST', `/characters/${id}/creation/approve`))
        .status
    ).toBe(409)
  })

  it('aprovar revalida a conta atual', async () => {
    await approval(true)
    const id = await character()
    await choose(id)
    await complete(id)
    // O narrador baixa um ponto em pending: fica faltando básico
    expect((await send(id, storyteller, 'str', 3, 2)).status).toBe(200)
    const refused = await as(
      ctx,
      storyteller,
      'POST',
      `/characters/${id}/creation/approve`
    )
    expect(refused.status).toBe(422)
    expect(await json(refused)).toMatchObject({ code: 'CREATION_INCOMPLETE' })
    expect((await row(id)).status).toBe('pending')
  })

  it('devolver: motivo só para dono e narrador, fora do registro', async () => {
    await approval(true)
    const id = await character()
    await choose(id)
    await complete(id)
    const reason = 'Refaça os Poderes: motivo-secreto-91'
    const back = await as(
      ctx,
      storyteller,
      'POST',
      `/characters/${id}/creation/return`,
      {
        reason,
      }
    )
    expect(back.status).toBe(200)
    expect(await json(back)).toMatchObject({ status: 'creating' })
    const mine = await json(await as(ctx, owner, 'GET', `/characters/${id}`))
    expect(mine.creation).toMatchObject({ returned: { reason } })
    const st = await json(
      await as(ctx, storyteller, 'GET', `/characters/${id}`)
    )
    expect(st.creation).toMatchObject({ returned: { reason } })
    const other = await as(ctx, player, 'GET', `/characters/${id}`)
    expect(other.status).toBe(404)
    expect(await other.text()).not.toContain('motivo-secreto')
    const list = await as(
      ctx,
      player,
      'GET',
      `/chronicles/${chronicleId}/characters`
    )
    expect(await list.text()).not.toContain('motivo-secreto')
    const audit = await auditOf(id)
    expect(JSON.stringify(audit)).not.toContain('motivo-secreto')
    expect(audit.map(a => a.action)).toContain('character.creation.return')
    // O dono corrige e envia de novo; o motivo sai
    expect((await send(id, owner, 'name', 'Teste', 'Corrigida')).status).toBe(
      200
    )
    const again = await complete(id)
    expect(await json(again)).toMatchObject({ status: 'pending' })
    expect((await row(id)).creation).not.toHaveProperty('returned')
    // Só pending é devolvida
    await setStatus(ctx, id, 'active')
    expect(
      (
        await as(
          ctx,
          storyteller,
          'POST',
          `/characters/${id}/creation/return`,
          {
            reason: 'x',
          }
        )
      ).status
    ).toBe(409)
  })

  it('motivo vazio ou com HTML é 422', async () => {
    const id = await character()
    await setStatus(ctx, id, 'pending')
    for (const reason of ['   ', '<b>x</b>'])
      expect(
        (
          await as(
            ctx,
            storyteller,
            'POST',
            `/characters/${id}/creation/return`,
            {
              reason,
            }
          )
        ).status
      ).toBe(422)
  })

  it('o narrador conclui e aprova numa ação, mesmo com aprovação ligada', async () => {
    await approval(true)
    const id = await character()
    await choose(id)
    const done = await complete(id, storyteller)
    expect(await json(done)).toMatchObject({
      status: 'active',
      approvedAt: expect.any(String),
    })
    expect((await auditOf(id)).map(a => [a.action, a.payload])).toEqual([
      ['character.creation.complete', { mode: 'points', approved: true }],
    ])
  })

  it('criação livre: o dono não conclui; o narrador conclui sem conta', async () => {
    const id = await character({ ...COMPLETE, str: 5, dex: 5, sta: 5 })
    const free = await as(
      ctx,
      storyteller,
      'PATCH',
      `/characters/${id}/creation`,
      {
        revision: 0,
        config: { mode: 'free' },
      }
    )
    expect(free.status).toBe(200)
    const mine = await complete(id)
    expect(mine.status).toBe(403)
    expect(await json(mine)).toMatchObject({
      code: 'CREATION_STORYTELLER_ONLY',
    })
    expect(await json(await complete(id, storyteller))).toMatchObject({
      status: 'active',
    })
  })

  it('revisão ou versão velhas na conclusão: 409, sem concluir', async () => {
    const id = await character()
    await choose(id)
    const stale = await complete(id, owner, { revision: 0 })
    expect(stale.status).toBe(409)
    expect(await json(stale)).toMatchObject({
      code: 'CREATION_REVISION_CONFLICT',
    })
    const old = await complete(id, owner, { revision: 1, sheetVersion: 7 })
    expect(await json(old)).toMatchObject({ code: 'SHEET_VERSION_CONFLICT' })
    expect((await row(id)).status).toBe('creating')
    const key = crypto.randomUUID()
    const done = await complete(id, owner, {
      revision: 1,
      sheetVersion: 0,
      clientCommandId: key,
    })
    expect(done.status).toBe(200)
    const replay = await complete(id, owner, {
      revision: 1,
      sheetVersion: 0,
      clientCommandId: key,
    })
    expect(await json(replay)).toMatchObject({
      status: 'active',
      duplicate: true,
    })
    expect(await auditOf(id)).toHaveLength(1)
  })

  it('ex-membro não conclui', async () => {
    const id = await character()
    await ctx.db
      .deleteFrom('chronicle_members')
      .where('user_id', '=', owner.id)
      .execute()
    const res = await complete(id)
    expect(res.status).toBe(403)
    expect(await json(res)).toMatchObject({ code: 'NOT_MEMBER' })
  })
})

// T-80: a conclusão não deixa "Moral 0 → 6" no Histórico, assinada por quem
// concluiu, e o Histórico diz quem concluiu
describe('Histórico da conclusão (T-80)', () => {
  interface Item {
    id: string
    byRole: string
    by: { username: string } | null
    event?: string
    reversible: boolean
    changes: { label: string; change: string }[]
  }
  const history = async (id: string, by: TestUser, query = '') => {
    const res = await as(ctx, by, 'GET', `/characters/${id}/history${query}`)
    expect(res.status).toBe(200)
    return (await res.json()) as { items: Item[]; next: string | null }
  }
  const frozen = (id: string) =>
    ctx.db
      .selectFrom('character_events as e')
      .innerJoin('character_batches as b', 'b.id', 'e.batch_id')
      .select(['e.path', 'e.from_value', 'e.to_value', 'e.from_absent'])
      .where('b.character_id', '=', id)
      .where('e.path', 'in', ['values.morality', 'values.will'])
      .execute()

  it('aprovação ligada: sem linha sem mudança e com "Criação concluída" do narrador', async () => {
    await approval(true)
    const id = await character()
    await choose(id)
    await complete(id)
    expect(
      (await as(ctx, storyteller, 'POST', `/characters/${id}/creation/approve`))
        .status
    ).toBe(200)
    // O lote do freeze guarda o "de" efetivo; desfazer devolve o vazio
    const events = await frozen(id)
    expect(events.map(e => e.path).sort()).toEqual([
      'values.morality',
      'values.will',
    ])
    for (const e of events) {
      expect(e.from_value).toEqual(e.to_value)
      expect(e.from_absent).toBe(true)
    }
    for (const by of [owner, storyteller]) {
      const { items } = await history(id, by)
      const labels = items.flatMap(i => i.changes.map(c => c.label))
      expect(labels).not.toContain('Moral')
      expect(labels).not.toContain('Vontade')
      const done = items.filter(i => i.event === 'creation.completed')
      expect(done).toHaveLength(1)
      expect(done[0]).toMatchObject({
        byRole: 'storyteller',
        by: { username: 'narradora' },
        reversible: false,
        changes: [],
      })
      expect(done[0]).not.toHaveProperty('payload')
      expect(JSON.stringify(done[0])).not.toContain(owner.id)
    }
  })

  it('aprovação desligada: a dona conclui e assina o item', async () => {
    const id = await character()
    await choose(id)
    expect((await complete(id)).status).toBe(200)
    const { items } = await history(id, owner)
    expect(items.filter(i => i.event === 'creation.completed')).toEqual([
      expect.objectContaining({ byRole: 'owner', by: { username: 'dona' } }),
    ])
    expect(items.flatMap(i => i.changes.map(c => c.label))).not.toContain(
      'Moral'
    )
  })

  it('criação livre: o narrador conclui, sem lote de freeze', async () => {
    const id = await character()
    await as(ctx, storyteller, 'PATCH', `/characters/${id}/creation`, {
      revision: 0,
      config: { mode: 'free' },
    })
    expect((await complete(id, storyteller)).status).toBe(200)
    expect(await frozen(id)).toEqual([])
    const { items } = await history(id, storyteller)
    expect(items).toEqual([
      expect.objectContaining({
        event: 'creation.completed',
        byRole: 'storyteller',
        by: { username: 'narradora' },
      }),
    ])
  })

  it('o outro jogador e o estranho continuam sem Histórico', async () => {
    const id = await character()
    await choose(id)
    await complete(id)
    expect(
      (await as(ctx, player, 'GET', `/characters/${id}/history`)).status
    ).toBe(404)
    const stranger = await createUser(ctx, 'estranho')
    expect(
      (await as(ctx, stranger, 'GET', `/characters/${id}/history`)).status
    ).toBe(404)
  })

  it('paginação: a conclusão aparece uma vez, na página certa', async () => {
    const id = await character({ ...COMPLETE, str: 2 })
    await choose(id)
    // Dois lotes antes da conclusão, dois depois (o relógio do teste é fixo)
    const tick = () => ctx.clock.advance(1000)
    expect((await send(id, owner, 'str', 2, 3)).status).toBe(200)
    tick()
    expect((await send(id, owner, 'name', 'Teste', 'Antes')).status).toBe(200)
    tick()
    expect((await complete(id)).status).toBe(200)
    tick()
    expect(
      (await send(id, storyteller, 'name', 'Antes', 'Depois')).status
    ).toBe(200)
    tick()
    expect(
      (await send(id, storyteller, 'name', 'Depois', 'Mais tarde')).status
    ).toBe(200)
    const ids: string[] = []
    let next: string | null = null
    let pages = 0
    do {
      const query: string = next
        ? `?limit=2&before=${encodeURIComponent(next)}`
        : '?limit=2'
      const page = await history(id, owner, query)
      ids.push(...page.items.map(i => i.id))
      next = page.next
      pages++
    } while (next && pages < 10)
    expect(pages).toBeGreaterThan(2)
    expect(new Set(ids).size).toBe(ids.length)
    const all = (await history(id, owner, '?limit=50')).items
    expect(ids).toEqual(all.map(i => i.id))
    // Do mais novo ao mais antigo: os dois nomes depois, a conclusão no meio
    const at = all.findIndex(i => i.event === 'creation.completed')
    expect(all.filter(i => i.event === 'creation.completed')).toHaveLength(1)
    expect(all.slice(0, at).flatMap(i => i.changes.map(c => c.label))).toEqual([
      'Nome',
      'Nome',
    ])
  })
})

describe('atalhos pela rota de estado', () => {
  const status = (id: string, to: string) =>
    as(ctx, storyteller, 'POST', `/characters/${id}/status`, { status: to })

  it('creating → archived → active não ativa; volta para creating', async () => {
    const id = await character()
    expect((await status(id, 'active')).status).toBe(409)
    expect((await status(id, 'archived')).status).toBe(200)
    expect((await status(id, 'active')).status).toBe(409)
    expect((await status(id, 'creating')).status).toBe(200)
    expect((await row(id)).status).toBe('creating')
  })

  it('pending não é ativada pela rota de estado nem devolvida por ela', async () => {
    const id = await character()
    await setStatus(ctx, id, 'pending')
    expect((await status(id, 'active')).status).toBe(409)
    expect((await status(id, 'creating')).status).toBe(409)
    expect((await status(id, 'pending')).status).toBe(422)
    expect((await status(id, 'archived')).status).toBe(200)
    expect((await status(id, 'active')).status).toBe(409)
  })

  it('a ficha ativada sai e volta a active, mas não à criação', async () => {
    const id = await character()
    await choose(id)
    await complete(id, storyteller)
    expect((await status(id, 'dead')).status).toBe(200)
    expect((await status(id, 'creating')).status).toBe(409)
    expect((await status(id, 'active')).status).toBe(200)
  })
})

describe('Mesa', () => {
  it('pending aparece sem filtro', async () => {
    const id = await character()
    await setStatus(ctx, id, 'pending')
    const table = (await (
      await as(ctx, storyteller, 'GET', `/chronicles/${chronicleId}/table`)
    ).json()) as unknown as { id: string; status: string }[]
    expect(table.map(r => [r.id, r.status])).toEqual([[id, 'pending']])
  })
})
