/// <reference types="bun-types" />
import { afterAll, beforeEach, describe, expect, it } from 'bun:test'
import { creationFlags } from '../sheets/creation-state'
import { completionRole, lifecycleRole } from '../sheets/events'
import {
  addMember,
  as,
  createCharacter,
  createChronicle,
  createUser,
  freeCreation,
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

  // As listas (P07-C): o app grava o valor que o editor mostra e mostra a
  // recusa na folha, mas quem decide continua sendo o servidor.
  const listOf = async (id: string, field: string) =>
    ((await row(id)).sheet_data as { values: Record<string, unknown> }).values[
      field
    ]

  it('Qualidade sem custo é recusada e não entra', async () => {
    const id = await character()
    await choose(id)
    const res = await send(id, owner, 'merits', null, [
      { id: 'm1', name: 'Ambidestro' },
    ])
    expect(res.status).toBe(422)
    expect(await json(res)).toMatchObject({
      code: 'CREATION_BUDGET_EXCEEDED',
      problems: [{ code: 'CREATION_NOT_PURCHASABLE', severity: 'blocking' }],
    })
    expect(await listOf(id, 'merits')).toBeUndefined()
  })

  it('Qualidade com custo acima do saldo é recusada e não entra', async () => {
    const id = await character()
    await choose(id)
    // 10 de 10 bônus em Destreza 3 → 5
    expect((await send(id, owner, 'dex', 3, 5)).status).toBe(200)
    const res = await send(id, owner, 'merits', null, [
      { id: 'm1', name: 'Ambidestro', meta: { cost: 1 } },
    ])
    expect(res.status).toBe(422)
    expect(await json(res)).toMatchObject({
      code: 'CREATION_BUDGET_EXCEEDED',
      problems: [{ code: 'CREATION_FREEBIES_EXCEEDED', severity: 'blocking' }],
    })
    expect(await listOf(id, 'merits')).toBeUndefined()
  })

  it('tirar o Defeito depois de gastar o crédito é recusado', async () => {
    const id = await character()
    await choose(id)
    const flaw = [{ id: 'f1', name: 'Inimigo', meta: { bonus: 3 } }]
    expect((await send(id, owner, 'flaws', null, flaw)).status).toBe(200)
    // 10 do saldo e 3 do crédito: Destreza a 5 e uma Qualidade de 3
    expect((await send(id, owner, 'dex', 3, 5)).status).toBe(200)
    const merit = [{ id: 'm1', name: 'Ambidestro', meta: { cost: 3 } }]
    expect((await send(id, owner, 'merits', null, merit)).status).toBe(200)
    const res = await send(id, owner, 'flaws', flaw, [])
    expect(res.status).toBe(422)
    expect(await json(res)).toMatchObject({
      code: 'CREATION_BUDGET_EXCEEDED',
      problems: [{ code: 'CREATION_FREEBIES_EXCEEDED', severity: 'blocking' }],
    })
    expect(await listOf(id, 'flaws')).toEqual(flaw)
  })

  // P05-C: o app passa a sinalizar antes do toque ("+" com cara de
  // indisponível, aviso ao lado). Isso é só UX: lotes que chegam direto à
  // API, sem passar pelo app, continuam recusados pela mesma conta.
  describe('o servidor recusa o que o app só sinaliza', () => {
    const values = async (id: string) =>
      ((await row(id)).sheet_data as { values: Record<string, unknown> }).values

    it('teto da criação (hard-cap): Arete acima de 3', async () => {
      const id = await character({ ...COMPLETE, arete: 3 })
      await choose(id)
      const res = await send(id, owner, 'arete', 3, 4)
      expect(res.status).toBe(422)
      const body = await json(res)
      expect(body.code).toBe('CREATION_BUDGET_EXCEEDED')
      expect(body.problems).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'CREATION_HARD_CAP' }),
        ])
      )
      expect((await values(id)).arete).toBe(3)
    })

    it('baseline travado: Aparência da linhagem C fica em 0', async () => {
      const id = await character({ ...COMPLETE, lineage: 'c', app: 0 })
      await choose(id)
      const res = await send(id, owner, 'app', 0, 1)
      expect(res.status).toBe(422)
      expect(await json(res)).toMatchObject({
        code: 'CREATION_BUDGET_EXCEEDED',
        problems: [{ code: 'CREATION_LOCKED', paths: ['values.app'] }],
      })
      expect((await values(id)).app).toBe(0)
    })

    it('saldo de bônus: o lote inteiro é recusado, nada aplicado', async () => {
      const id = await character()
      await choose(id)
      // 2 + 2 pontos de atributo acima dos básicos, a 5 cada: 20 de 10
      const res = await as(
        ctx,
        storyteller,
        'POST',
        `/characters/${id}/events`,
        {
          clientBatchId: crypto.randomUUID(),
          events: [
            { path: 'values.str', from: 3, to: 5 },
            { path: 'values.dex', from: 3, to: 5 },
          ],
        }
      )
      expect(res.status).toBe(422)
      expect(await json(res)).toMatchObject({
        code: 'CREATION_BUDGET_EXCEEDED',
        problems: [{ code: 'CREATION_FREEBIES_EXCEEDED', amount: 10 }],
      })
      expect(await values(id)).toMatchObject({ str: 3, dex: 3 })
    })

    it('o 4º ponto acima do creation-cap passa, pago com bônus (a trava de Básicos é só do app)', async () => {
      const id = await character()
      await choose(id)
      const res = await send(id, owner, 'alert', 3, 4)
      expect(res.status).toBe(200)
      expect((await values(id)).alert).toBe(4)
    })
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

  it('a lista marca a ficha devolvida, sem o motivo (T-06)', async () => {
    await approval(true)
    const id = await character()
    const other = await createCharacter(ctx, owner, chronicleId, {
      ...COMPLETE,
      name: 'Ativa',
    })
    await setStatus(ctx, other, 'active')
    await choose(id)
    await complete(id)
    const reason = 'Troque um ponto: motivo-da-lista-42'
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
    ).toBe(200)
    const listOf = async (user: TestUser) => {
      const res = await as(
        ctx,
        user,
        'GET',
        `/chronicles/${chronicleId}/characters`
      )
      const text = await res.text()
      expect(text).not.toContain('motivo-da-lista')
      return JSON.parse(text) as { id: string; returned?: boolean }[]
    }
    for (const user of [owner, storyteller]) {
      const list = await listOf(user)
      expect(list.find(c => c.id === id)?.returned).toBe(true)
      // A ficha ativa nunca é devolvida
      expect(list.find(c => c.id === other)?.returned).toBe(false)
    }
    // O outro jogador não tem a linha
    expect((await listOf(player)).some(c => c.id === id)).toBe(false)
    // Enviada de novo, deixa de ser devolvida
    expect((await complete(id)).status).toBe(200)
    expect((await listOf(storyteller)).find(c => c.id === id)?.returned).toBe(
      false
    )
  })

  it('creationFlags: a forma que a ficha guarda, nada além', () => {
    expect(
      creationFlags({
        returned: { reason: 'x', at: '2026-11-02' },
        adjust: { reason: 'y', at: '2026-11-02' },
        ready: { at: '2026-11-02' },
      })
    ).toEqual({ returned: true, adjust: true, ready: true })
    for (const creation of [
      null,
      undefined,
      'x',
      [],
      {},
      { returned: null, adjust: null, ready: null },
      { returned: 'x', adjust: 'x', ready: 'x' },
      { returned: { reason: 'x' }, adjust: { at: 'x' }, ready: {} },
      {
        returned: { reason: 1, at: '2026-11-02' },
        adjust: { reason: 'x', at: 2 },
        ready: { at: 3 },
      },
      { returned: [], adjust: [], ready: [] },
    ])
      expect(creationFlags(creation)).toEqual({
        returned: false,
        adjust: false,
        ready: false,
      })
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

  it('o narrador que conclui a própria ficha assina como narrador, como o freeze', async () => {
    const id = await createCharacter(ctx, storyteller, chronicleId, COMPLETE)
    await choose(id, storyteller)
    expect((await complete(id, storyteller)).status).toBe(200)
    const { items } = await history(id, storyteller)
    expect(items.filter(i => i.event === 'creation.completed')).toEqual([
      expect.objectContaining({ byRole: 'storyteller' }),
    ])
  })

  it('completionRole: o que o servidor gravou, também com a conta excluída', () => {
    const row = (
      action: string,
      payload: unknown,
      actor: string | null = 'a',
      target: string | null = 'b'
    ) => ({ action, payload, actor_id: actor, target_user_id: target })
    expect(completionRole(row('character.creation.approve', {}, null))).toBe(
      'storyteller'
    )
    expect(
      completionRole(
        row('character.creation.complete', { approved: false }, null)
      )
    ).toBe('owner')
    expect(
      completionRole(
        row('character.creation.complete', { approved: true }, 'b')
      )
    ).toBe('storyteller')
    // Registro anterior à v4, sem `approved`: o autor contra o dono
    expect(completionRole(row('character.creation.complete', {}, 'b'))).toBe(
      'owner'
    )
    expect(completionRole(row('character.creation.complete', null, 'a'))).toBe(
      'storyteller'
    )
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

// P04-D (D-04 e D-03): o narrador pede ajuste numa ficha em criação, com a
// aprovação ligada ou não; o dono da criação livre avisa que terminou
describe('pedir ajuste e avisar que terminei', () => {
  const adjust = (id: string, body: unknown, by = storyteller) =>
    as(ctx, by, 'POST', `/characters/${id}/creation/adjust`, body)
  const ready = (id: string, body?: unknown, by = owner) =>
    as(ctx, by, 'POST', `/characters/${id}/creation/ready`, body)
  const creationOf = async (id: string, by: TestUser = owner) =>
    (await json(await as(ctx, by, 'GET', `/characters/${id}`)))
      .creation as Record<string, unknown>
  const updatedAt = async (id: string) =>
    (
      await ctx.db
        .selectFrom('characters')
        .select('updated_at')
        .where('id', '=', id)
        .executeTakeFirstOrThrow()
    ).updated_at
  const freeCharacter = async () => {
    const id = await character({ name: 'Livre' })
    await freeCreation(ctx, id)
    return id
  }
  const npcOf = async (visibility: 'hidden' | 'identity' | 'full') => {
    const id = await createCharacter(ctx, storyteller, chronicleId, {
      name: 'Sentinela',
    })
    await ctx.db
      .updateTable('characters')
      .set({ kind: 'npc', visibility })
      .where('id', '=', id)
      .execute()
    return id
  }

  it('o narrador pede ajuste na criação livre e na por pontos, com e sem aprovação (R-14)', async () => {
    const reason = 'Refaça os Antecedentes: motivo-do-ajuste-17'
    const free = await freeCharacter()
    const points = await character()
    for (const id of [free, points]) {
      const before = await row(id)
      const at = await updatedAt(id)
      ctx.clock.advance(60_000)
      const res = await adjust(id, { reason: `  ${reason}  ` })
      expect(res.status).toBe(200)
      expect(await json(res)).toEqual({
        revision: before.creation_revision + 1,
        duplicate: false,
      })
      for (const by of [owner, storyteller])
        expect(await creationOf(id, by)).toMatchObject({
          adjust: { reason, at: expect.any(String) },
          ready: null,
          returned: null,
        })
      const after = await row(id)
      expect(after.status).toBe('creating')
      expect(after.creation_revision).toBe(before.creation_revision + 1)
      // Não mexe nos dados da ficha: "alterada às" da Mesa fica
      expect(await updatedAt(id)).toEqual(at)
    }
    // Com a aprovação ligada, também
    await approval(true)
    const third = await character({ ...COMPLETE, name: 'Terceira' })
    expect((await adjust(third, { reason })).status).toBe(200)
    // O registro tem a ação, sem o motivo
    const audit = await auditOf(points)
    expect(audit.map(a => [a.action, a.payload])).toEqual([
      ['character.creation.adjust', {}],
    ])
    expect(JSON.stringify(await auditOf(free))).not.toContain(
      'motivo-do-ajuste'
    )
  })

  it('o pedido substitui a devolução e o aviso anteriores', async () => {
    const id = await freeCharacter()
    expect((await ready(id)).status).toBe(200)
    expect(await creationOf(id)).toMatchObject({
      ready: { at: expect.any(String) },
    })
    expect((await adjust(id, { reason: 'Primeiro' })).status).toBe(200)
    expect(await creationOf(id)).toMatchObject({
      adjust: { reason: 'Primeiro' },
      ready: null,
    })
    expect((await adjust(id, { reason: 'Segundo' })).status).toBe(200)
    expect(await creationOf(id)).toMatchObject({
      adjust: { reason: 'Segundo' },
    })
    // Uma devolução guardada (de um envio anterior) também sai
    await ctx.db
      .updateTable('characters')
      .set({
        creation: JSON.stringify({
          config: { mode: 'free' },
          returned: { reason: 'Antiga', at: '2026-10-20T00:00:00Z' },
        }),
      })
      .where('id', '=', id)
      .execute()
    expect((await adjust(id, { reason: 'Terceiro' })).status).toBe(200)
    expect(await creationOf(id)).toMatchObject({
      adjust: { reason: 'Terceiro' },
      returned: null,
    })
  })

  it('só o narrador da crônica pede ajuste: 403 para a dona, 404 para os outros', async () => {
    const id = await character()
    const reason = 'Ajuste: motivo-negado-33'
    const mine = await adjust(id, { reason }, owner)
    expect(mine.status).toBe(403)
    expect(await json(mine)).toMatchObject({ code: 'FORBIDDEN' })
    expect((await adjust(id, { reason }, player)).status).toBe(404)
    // Narrador de outra crônica
    const other = await createUser(ctx, 'outra-narradora')
    await createChronicle(ctx, other, 'acct-teste')
    const foreign = await adjust(id, { reason }, other)
    expect(foreign.status).toBe(404)
    expect(await foreign.text()).not.toContain('motivo-negado')
    // Ex-membro sem ficha nesta linha
    await ctx.db
      .deleteFrom('chronicle_members')
      .where('user_id', '=', player.id)
      .execute()
    expect((await adjust(id, { reason }, player)).status).toBe(404)
    // O jogador que vê o NPC revelado (viewer) também não alcança a rota
    await addMember(ctx, chronicleId, player)
    const npc = await npcOf('identity')
    expect((await adjust(npc, { reason }, player)).status).toBe(404)
    expect((await row(id)).creation_revision).toBe(0)
    expect(await auditOf(id)).toEqual([])
  })

  it('fora da criação, no NPC e na ficha do próprio narrador: 409', async () => {
    const reason = 'Refaça'
    const id = await character()
    await setStatus(ctx, id, 'pending')
    const pending = await adjust(id, { reason })
    expect(pending.status).toBe(409)
    expect(await json(pending)).toMatchObject({
      code: 'CREATION_NOT_CREATING',
    })
    await setStatus(ctx, id, 'active')
    expect(await json(await adjust(id, { reason }))).toMatchObject({
      code: 'CREATION_NOT_CREATING',
    })
    const npc = await npcOf('hidden')
    const onNpc = await adjust(npc, { reason })
    expect(onNpc.status).toBe(409)
    expect(await json(onNpc)).toMatchObject({
      code: 'CREATION_ADJUST_UNAVAILABLE',
    })
    const own = await createCharacter(ctx, storyteller, chronicleId, {
      name: 'Da narradora',
    })
    expect(await json(await adjust(own, { reason }))).toMatchObject({
      code: 'CREATION_ADJUST_UNAVAILABLE',
    })
    // A revisão velha (a dona já mudou as escolhas) também é 409
    const fresh = await character({ ...COMPLETE, name: 'Fresca' })
    await choose(fresh)
    expect(
      await json(await adjust(fresh, { reason, revision: 0 }))
    ).toMatchObject({ code: 'CREATION_REVISION_CONFLICT' })
  })

  it('motivo vazio, longo, com marcação ou controle é 422, sem ecoar o texto', async () => {
    const id = await character()
    for (const reason of [
      '   ',
      `motivo-longo-${'x'.repeat(500)}`,
      '<b>motivo-html</b>',
      'motivo-controle\u0007',
      'motivo-bidi‮',
    ]) {
      const res = await adjust(id, { reason })
      expect(res.status).toBe(422)
      const text = await res.text()
      expect(text).not.toContain('motivo-')
      expect(JSON.parse(text)).toMatchObject({
        issues: [{ path: 'reason' }],
      })
    }
    // 500 caracteres depois do trim passam
    expect((await adjust(id, { reason: ` ${'a'.repeat(500)} ` })).status).toBe(
      200
    )
  })

  it('a mesma chave devolve o resultado gravado; com outro motivo, 409', async () => {
    const id = await character()
    const key = crypto.randomUUID()
    const first = await adjust(id, { reason: 'Refaça', clientCommandId: key })
    expect(await json(first)).toEqual({ revision: 1, duplicate: false })
    // O motivo entra no hash já aparado
    const replay = await adjust(id, {
      reason: '  Refaça ',
      clientCommandId: key,
    })
    expect(await json(replay)).toEqual({ revision: 1, duplicate: true })
    const reused = await adjust(id, { reason: 'Outro', clientCommandId: key })
    expect(reused.status).toBe(409)
    expect(await json(reused)).toMatchObject({ code: 'COMMAND_KEY_REUSED' })
    expect(await auditOf(id)).toHaveLength(1)
  })

  it('salvar escolhas e orçamento mantém os marcadores; concluir apaga; devolver não os traz (R-14)', async () => {
    // Por pontos: o narrador ajusta o orçamento depois do pedido
    const id = await character()
    expect((await adjust(id, { reason: 'Refaça' })).status).toBe(200)
    expect((await choose(id, owner, 1)).status).toBe(200)
    const budget = await as(
      ctx,
      storyteller,
      'PATCH',
      `/characters/${id}/creation`,
      { revision: 2, config: { freebies: 12 } }
    )
    expect(budget.status).toBe(200)
    expect(await json(budget)).toMatchObject({
      creation: { adjust: { reason: 'Refaça' } },
    })
    // A dona conclui sem ajustar (aprovação desligada): o pedido sai
    expect(await json(await complete(id))).toMatchObject({ status: 'active' })
    expect((await row(id)).creation).not.toHaveProperty('adjust')
    // Livre: as escolhas da dona depois do aviso não o apagam
    const free = await freeCharacter()
    expect((await ready(free)).status).toBe(200)
    expect((await choose(free, owner, 1)).status).toBe(200)
    expect(await creationOf(free)).toMatchObject({
      ready: { at: expect.any(String) },
    })
    expect(await json(await complete(free, storyteller))).toMatchObject({
      status: 'active',
    })
    expect((await row(free)).creation).not.toHaveProperty('ready')
    // O narrador passa a ficha livre para pontos: o aviso (da criação livre)
    // sai, e concluir volta a ser da dona
    const switched = await freeCharacter()
    expect((await ready(switched)).status).toBe(200)
    const points = await as(
      ctx,
      storyteller,
      'PATCH',
      `/characters/${switched}/creation`,
      { revision: 1, config: null }
    )
    expect(points.status).toBe(200)
    expect(await creationOf(switched)).toMatchObject({
      mode: 'points',
      ready: null,
    })
    // Aprovação ligada: enviar apaga o pedido; devolver não o traz de volta
    await approval(true)
    const sent = await character({ ...COMPLETE, name: 'Enviada' })
    await choose(sent)
    expect((await adjust(sent, { reason: 'Refaça' })).status).toBe(200)
    expect(await json(await complete(sent))).toMatchObject({
      status: 'pending',
    })
    expect((await row(sent)).creation).not.toHaveProperty('adjust')
    // Um pedido gravado à mão em pending (dado antigo) também não volta
    await ctx.db
      .updateTable('characters')
      .set({
        creation: JSON.stringify({
          ...((await row(sent)).creation as object),
          adjust: { reason: 'Velho', at: '2026-10-20T00:00:00Z' },
          ready: { at: '2026-10-20T00:00:00Z' },
        }),
      })
      .where('id', '=', sent)
      .execute()
    const back = await as(
      ctx,
      storyteller,
      'POST',
      `/characters/${sent}/creation/return`,
      { reason: 'Devolvida' }
    )
    expect(back.status).toBe(200)
    expect(await creationOf(sent)).toMatchObject({
      returned: { reason: 'Devolvida' },
      adjust: null,
      ready: null,
    })
  })

  it('a dona avisa que terminou na criação livre; de novo é 409 (R-13)', async () => {
    const id = await freeCharacter()
    const at = await updatedAt(id)
    ctx.clock.advance(60_000)
    const done = await ready(id, { revision: 0 })
    expect(done.status).toBe(200)
    expect(await json(done)).toEqual({ revision: 1, duplicate: false })
    expect(await creationOf(id, storyteller)).toMatchObject({
      ready: { at: expect.any(String) },
      adjust: null,
    })
    expect((await row(id)).status).toBe('creating')
    expect(await updatedAt(id)).toEqual(at)
    const again = await ready(id)
    expect(again.status).toBe(409)
    expect(await json(again)).toMatchObject({ code: 'CREATION_ALREADY_READY' })
    expect((await auditOf(id)).map(a => [a.action, a.payload])).toEqual([
      ['character.creation.ready', {}],
    ])
    // A edição continua liberada
    expect((await send(id, owner, 'name', 'Livre', 'Pronta')).status).toBe(200)
  })

  it('o aviso apaga o pedido de ajuste e a devolução', async () => {
    const id = await freeCharacter()
    expect((await adjust(id, { reason: 'Refaça' })).status).toBe(200)
    expect((await ready(id, { revision: 1 })).status).toBe(200)
    expect(await creationOf(id)).toMatchObject({
      adjust: null,
      returned: null,
      ready: { at: expect.any(String) },
    })
  })

  it('avisar: por pontos, fora da criação, pelo narrador ou por outro é recusado', async () => {
    const points = await character()
    const p = await ready(points)
    expect(p.status).toBe(409)
    expect(await json(p)).toMatchObject({ code: 'CREATION_NOT_FREE' })
    const id = await freeCharacter()
    // O narrador conclui; na ficha dele, também
    const st = await ready(id, undefined, storyteller)
    expect(st.status).toBe(403)
    expect(await json(st)).toMatchObject({
      code: 'CREATION_STORYTELLER_CONCLUDES',
    })
    const own = await createCharacter(ctx, storyteller, chronicleId, {
      name: 'Da narradora',
    })
    await freeCreation(ctx, own)
    expect((await ready(own, undefined, storyteller)).status).toBe(403)
    expect((await ready(id, undefined, player)).status).toBe(404)
    const npc = await npcOf('full')
    expect((await ready(npc, undefined, player)).status).toBe(404)
    // Revisão velha (o narrador pediu ajuste antes): 409
    expect((await adjust(id, { reason: 'Refaça' })).status).toBe(200)
    expect(await json(await ready(id, { revision: 0 }))).toMatchObject({
      code: 'CREATION_REVISION_CONFLICT',
    })
    await setStatus(ctx, id, 'pending')
    expect(await json(await ready(id))).toMatchObject({
      code: 'CREATION_NOT_CREATING',
    })
    await setStatus(ctx, id, 'creating')
    // Ex-dona: saiu da crônica, a ficha fica, o aviso não
    await ctx.db
      .deleteFrom('chronicle_members')
      .where('user_id', '=', owner.id)
      .execute()
    const former = await ready(id)
    expect(former.status).toBe(403)
    expect(await json(former)).toMatchObject({ code: 'NOT_MEMBER' })
    expect(
      (await auditOf(id)).filter(a => a.action === 'character.creation.ready')
    ).toEqual([])
  })
})

// P04-D (R-12, R-13): a lista, a Mesa, o Histórico e a contagem dizem o
// estado da ficha, sem o motivo
describe('estado da ficha na lista, na Mesa, no Histórico e na contagem', () => {
  interface Row {
    id: string
    status?: string
    creationMode?: string | null
    returned?: boolean
    adjust?: boolean
    ready?: boolean
    activatedAt?: string | null
    projection?: string
  }
  const listOf = async (user: TestUser, secret: string) => {
    const res = await as(
      ctx,
      user,
      'GET',
      `/chronicles/${chronicleId}/characters`
    )
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).not.toContain(secret)
    return JSON.parse(text) as Row[]
  }
  const tableOf = async (secret: string) => {
    const res = await as(
      ctx,
      storyteller,
      'GET',
      `/chronicles/${chronicleId}/table`
    )
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).not.toContain(secret)
    return JSON.parse(text) as Row[]
  }
  const adjust = (id: string, reason: string) =>
    as(ctx, storyteller, 'POST', `/characters/${id}/creation/adjust`, {
      reason,
    })
  const ready = (id: string) =>
    as(ctx, owner, 'POST', `/characters/${id}/creation/ready`)
  const pendingReview = async (user: TestUser) =>
    (
      (await (await as(ctx, user, 'GET', '/chronicles')).json()) as {
        pendingReview: number
      }[]
    )[0]?.pendingReview

  it('a lista e a Mesa mandam o modo, os marcadores e a data de ativação, sem o motivo', async () => {
    const secret = 'motivo-do-estado-58'
    const points = await character({ ...COMPLETE, name: 'Por pontos' })
    const free = await character({ name: 'Livre' })
    await freeCreation(ctx, free)
    const asked = await character({ ...COMPLETE, name: 'Com ajuste' })
    const active = await character({ ...COMPLETE, name: 'Ativa' })
    const pending = await character({ ...COMPLETE, name: 'Enviada' })
    expect((await ready(free)).status).toBe(200)
    expect((await adjust(asked, `Refaça: ${secret}`)).status).toBe(200)
    await choose(active)
    expect(await json(await complete(active))).toMatchObject({
      status: 'active',
    })
    await approval(true)
    await choose(pending)
    expect(await json(await complete(pending))).toMatchObject({
      status: 'pending',
    })
    const expected = {
      [points]: {
        status: 'creating',
        creationMode: 'points',
        returned: false,
        adjust: false,
        ready: false,
        activatedAt: null,
      },
      [free]: {
        status: 'creating',
        creationMode: 'free',
        ready: true,
        adjust: false,
      },
      [asked]: { creationMode: 'points', adjust: true, ready: false },
      [pending]: {
        status: 'pending',
        creationMode: 'points',
        activatedAt: null,
      },
      [active]: {
        status: 'active',
        creationMode: null,
        returned: false,
        adjust: false,
        ready: false,
        activatedAt: expect.any(String),
      },
    }
    for (const user of [owner, storyteller]) {
      const list = await listOf(user, secret)
      for (const [id, fields] of Object.entries(expected))
        expect(list.find(r => r.id === id)).toMatchObject(fields)
    }
    const table = await tableOf(secret)
    for (const [id, fields] of Object.entries(expected))
      expect(table.find(r => r.id === id)).toMatchObject(fields)
    // O outro jogador não tem as linhas
    const other = await listOf(player, secret)
    expect(other.filter(r => r.id in expected)).toEqual([])
    // A projeção do NPC revelado não ganha campo
    const npc = await createCharacter(ctx, storyteller, chronicleId, {
      name: 'Sentinela',
    })
    await ctx.db
      .updateTable('characters')
      .set({ kind: 'npc', visibility: 'identity' })
      .where('id', '=', npc)
      .execute()
    const seen = (await listOf(player, secret)).find(r => r.id === npc)
    expect(Object.keys(seen ?? {}).sort()).toEqual([
      'id',
      'identity',
      'kind',
      'projection',
      'visibility',
    ])
  })

  it('a contagem do narrador soma as enviadas e as que avisaram (R-13)', async () => {
    const free = await character({ name: 'Livre' })
    await freeCreation(ctx, free)
    expect(await pendingReview(storyteller)).toBe(0)
    expect((await ready(free)).status).toBe(200)
    expect(await pendingReview(storyteller)).toBe(1)
    expect(await pendingReview(owner)).toBe(0)
    await approval(true)
    const sent = await character({ ...COMPLETE, name: 'Enviada' })
    await choose(sent)
    expect((await complete(sent)).status).toBe(200)
    expect(await pendingReview(storyteller)).toBe(2)
    // Concluída, sai da conta; o aviso em ficha arquivada não conta
    expect((await complete(free, storyteller)).status).toBe(200)
    expect(await pendingReview(storyteller)).toBe(1)
    const archived = await character({ name: 'Arquivada' })
    await freeCreation(ctx, archived)
    expect((await ready(archived)).status).toBe(200)
    await setStatus(ctx, archived, 'archived')
    expect(await pendingReview(storyteller)).toBe(1)
  })

  it('o Histórico mostra enviar, devolver, pedir ajuste e avisar, sem o motivo (R-12)', async () => {
    const secret = 'motivo-do-historico-71'
    const tick = () => ctx.clock.advance(1000)
    await approval(true)
    const id = await character()
    await choose(id)
    tick()
    expect((await adjust(id, `Antes: ${secret}`)).status).toBe(200)
    tick()
    expect((await complete(id, owner)).status).toBe(200)
    tick()
    expect(
      (
        await as(
          ctx,
          storyteller,
          'POST',
          `/characters/${id}/creation/return`,
          {
            reason: `Devolvida: ${secret}`,
          }
        )
      ).status
    ).toBe(200)
    tick()
    expect((await complete(id, storyteller)).status).toBe(200)
    // Livre: avisar
    const free = await character({ name: 'Livre' })
    await freeCreation(ctx, free)
    expect((await ready(free)).status).toBe(200)
    for (const by of [owner, storyteller]) {
      const res = await as(ctx, by, 'GET', `/characters/${id}/history`)
      const text = await res.text()
      expect(text).not.toContain(secret)
      const { items } = JSON.parse(text) as {
        items: {
          event?: string
          byRole: string
          by: { username: string } | null
          reversible: boolean
          changes: unknown[]
        }[]
      }
      const steps = items.filter(i => i.event)
      expect(steps.map(i => [i.event, i.byRole])).toEqual([
        ['creation.completed', 'storyteller'],
        ['creation.returned', 'storyteller'],
        ['creation.submitted', 'owner'],
        ['creation.adjust', 'storyteller'],
      ])
      for (const s of steps) {
        expect(s.reversible).toBe(false)
        expect(s.changes).toEqual([])
        expect(s).not.toHaveProperty('payload')
      }
      const { items: told } = (await (
        await as(ctx, by, 'GET', `/characters/${free}/history`)
      ).json()) as { items: { event?: string; byRole: string }[] }
      expect(told.map(i => [i.event, i.byRole])).toEqual([
        ['creation.ready', 'owner'],
      ])
    }
    // O outro jogador continua sem Histórico
    expect(
      (await as(ctx, player, 'GET', `/characters/${id}/history`)).status
    ).toBe(404)
  })

  it('paginação com os passos do ciclo: nada repete nem some', async () => {
    const id = await character({ ...COMPLETE, str: 2 })
    await freeCreation(ctx, id)
    const tick = () => ctx.clock.advance(1000)
    expect((await send(id, owner, 'str', 2, 3)).status).toBe(200)
    tick()
    expect((await adjust(id, 'Refaça')).status).toBe(200)
    tick()
    expect((await send(id, owner, 'name', 'Teste', 'Antes')).status).toBe(200)
    tick()
    expect(
      (
        await as(ctx, owner, 'POST', `/characters/${id}/creation/ready`, {
          revision: 1,
        })
      ).status
    ).toBe(200)
    tick()
    expect((await send(id, owner, 'name', 'Antes', 'Depois')).status).toBe(200)
    const ids: string[] = []
    let next: string | null = null
    let pages = 0
    do {
      const query: string = next
        ? `?limit=2&before=${encodeURIComponent(next)}`
        : '?limit=2'
      const res = await as(
        ctx,
        owner,
        'GET',
        `/characters/${id}/history${query}`
      )
      const page = (await res.json()) as {
        items: { id: string }[]
        next: string | null
      }
      ids.push(...page.items.map(i => i.id))
      next = page.next
      pages++
    } while (next && pages < 10)
    expect(new Set(ids).size).toBe(ids.length)
    const all = (await (
      await as(ctx, owner, 'GET', `/characters/${id}/history?limit=50`)
    ).json()) as { items: { id: string; event?: string }[] }
    expect(ids).toEqual(all.items.map(i => i.id))
    expect(all.items.map(i => i.event ?? 'lote')).toEqual([
      'lote',
      'creation.ready',
      'lote',
      'creation.adjust',
      'lote',
    ])
  })

  it('lifecycleRole: o papel sai da ação, nunca do corpo', () => {
    const row = (
      action: Parameters<typeof lifecycleRole>[0]['action'],
      payload: unknown = {}
    ) => ({ action, payload, actor_id: 'a', target_user_id: 'b' })
    expect(lifecycleRole(row('character.creation.submit'))).toBe('owner')
    expect(lifecycleRole(row('character.creation.ready'))).toBe('owner')
    expect(lifecycleRole(row('character.creation.return'))).toBe('storyteller')
    expect(lifecycleRole(row('character.creation.adjust'))).toBe('storyteller')
    expect(
      lifecycleRole(row('character.creation.complete', { approved: false }))
    ).toBe('owner')
    expect(lifecycleRole(row('character.creation.approve'))).toBe('storyteller')
  })
})
