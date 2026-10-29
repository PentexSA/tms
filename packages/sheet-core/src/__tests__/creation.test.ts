/// <reference types="bun-types" />
import { describe, expect, it } from 'bun:test'
import { compileTemplate } from '../compile'
import {
  type CreationChoices,
  type CreationConfig,
  type CreationProblem,
  checkCreation,
  checkCreationBatch,
  checkCreationUpdate,
  completionRefusal,
  creationFreeze,
  creationInputOf,
  effectiveCreationConfig,
  parseCharacterCreation,
  validateCreationChoices,
  validateCreationConfig,
} from '../creation'
import { acct } from './accounting-fixture'
import { clone, dnd, type Json, templates } from './fixtures'

// Contabilização da criação (doc/plano-v4.md §3.1 e §3.3) sobre o template
// sintético e o point-buy do fixture de D&D. Números de teste.

const model = compileTemplate(acct())
const points: CreationConfig = effectiveCreationConfig(model)
const PRIORITIES: CreationChoices = {
  priorities: {
    attributes: ['phys', 'soc', 'men'],
    abilities: ['talents', 'knowledges'],
  },
}

type Values = Record<string, unknown>

// Uma ficha que fecha a conta exata, sem gastar bônus.
const COMPLETE: Values = {
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

const sheet = (patch: Values = {}, base: Values = COMPLETE) => {
  const values: Values = { ...base, ...patch }
  for (const [k, v] of Object.entries(values))
    if (v === undefined) delete values[k]
  return { values }
}
const check = (
  patch: Values = {},
  choices: CreationChoices = PRIORITIES,
  config: CreationConfig = points
) => checkCreation(model, sheet(patch), { config, choices })
const codes = (problems: readonly CreationProblem[]) =>
  problems.map(p => `${p.code}:${p.severity}`).sort()
const group = (c: ReturnType<typeof check>, budget: string, id: string) => {
  const g = c.budgets.find(b => b.id === budget)?.groups.find(x => x.id === id)
  if (!g) throw new Error(`grupo ausente: ${budget}.${id}`)
  return g
}

describe('checkCreation: conta exata', () => {
  it('fecha sem problema e sem gastar bônus', () => {
    const c = check()
    expect(c.problems).toEqual([])
    expect(c.complete).toBe(true)
    expect(c.savable).toBe(true)
    expect(c.freebies).toEqual({
      available: 10,
      credit: 0,
      spent: 0,
      remaining: 10,
    })
    expect(group(c, 'attributes', 'phys')).toMatchObject({
      budget: 5,
      invested: 5,
      basic: 5,
      missing: 0,
      extra: 0,
      price: 5,
    })
    expect(group(c, 'gifts', 'gifts')).toMatchObject({
      measure: 'items',
      invested: 2,
      basic: 2,
    })
    expect(completionRefusal(c)).toBeNull()
  })

  it('o orçamento segue a prioridade escolhida', () => {
    const c = check(
      {},
      {
        priorities: {
          attributes: ['men', 'phys', 'soc'],
          abilities: ['talents', 'knowledges'],
        },
      }
    )
    expect(group(c, 'attributes', 'men').budget).toBe(5)
    expect(group(c, 'attributes', 'phys').budget).toBe(3)
    // Físicos com 5 investidos e orçamento 3: 2 pontos de bônus a 5 cada
    expect(group(c, 'attributes', 'phys')).toMatchObject({
      basic: 3,
      extra: 2,
      freebieCost: 10,
    })
    // Sociais: 3 investidos, orçamento 2, mais 1 de bônus
    expect(c.freebies?.spent).toBe(15)
    // Mentais ficam com 2 básicos sobrando, e o bônus estoura
    expect(codes(c.problems)).toEqual([
      'CREATION_BASICS_UNSPENT:incomplete',
      'CREATION_FREEBIES_EXCEEDED:blocking',
    ])
  })

  it('básicos sobrando impedem só a conclusão', () => {
    const c = check({ str: 2 })
    expect(c.savable).toBe(true)
    expect(c.complete).toBe(false)
    expect(c.problems).toEqual([
      {
        code: 'CREATION_BASICS_UNSPENT',
        severity: 'incomplete',
        budget: 'attributes',
        group: 'phys',
        paths: [],
        amount: 1,
      },
    ])
    expect(completionRefusal(c)?.code).toBe('CREATION_INCOMPLETE')
  })
})

describe('checkCreation: bônus', () => {
  it('Habilidade em 4 com 1 ponto de bônus passa; sem saldo, não', () => {
    const c = check({ alert: 4, brawl: 2 })
    const g = group(c, 'abilities', 'talents')
    // Teto dos básicos em 3: o quarto ponto só sai do bônus
    expect(g).toMatchObject({
      invested: 6,
      eligible: 5,
      basic: 5,
      extra: 1,
      freebieCost: 2,
    })
    expect(c.complete).toBe(true)
    expect(c.freebies?.remaining).toBe(8)

    const broke = check({ alert: 4 }, PRIORITIES, { ...points, freebies: 0 })
    expect(broke.savable).toBe(false)
    expect(codes(broke.problems)).toEqual([
      'CREATION_FREEBIES_EXCEEDED:blocking',
    ])
    expect(completionRefusal(broke)?.code).toBe('CREATION_BUDGET_EXCEEDED')
  })

  it('o teto dos básicos não deixa o básico pagar o quarto ponto', () => {
    // 5 de talentos: 4 em Prontidão (3 elegíveis) e 1 em Briga
    const c = check({ alert: 4, brawl: 1 })
    expect(group(c, 'abilities', 'talents')).toMatchObject({
      invested: 5,
      eligible: 4,
      basic: 4,
      missing: 1,
      extra: 1,
    })
    expect(codes(c.problems)).toEqual(['CREATION_BASICS_UNSPENT:incomplete'])
  })

  it('excesso pago com bônus passa, e sobra de bônus não recusa', () => {
    const c = check({ str: 4 })
    expect(c.complete).toBe(true)
    expect(c.freebies).toEqual({
      available: 10,
      credit: 0,
      spent: 5,
      remaining: 5,
    })
  })

  it('bônus acima do saldo bloqueia o rascunho', () => {
    const c = check({ str: 5, dex: 5 })
    expect(c.freebies?.remaining).toBe(-10)
    expect(c.problems).toContainEqual({
      code: 'CREATION_FREEBIES_EXCEEDED',
      severity: 'blocking',
      paths: [],
      amount: 10,
    })
  })

  it('campos só de bônus: Moral acima do padrão e Vontade', () => {
    // Moral padrão = con + ctl = 6; 7 custa 2. Vontade padrão = con = 3; 4 custa 1
    const c = check({ morality: 7, will: { current: 4, permanent: 4 } })
    expect(c.lines.find(l => l.id === 'morality')).toMatchObject({
      units: 1,
      cost: 2,
    })
    expect(c.lines.find(l => l.id === 'will')).toMatchObject({
      units: 1,
      cost: 1,
    })
    expect(c.freebies?.spent).toBe(3)
  })

  it('Qualidades custam o meta; Defeitos dão crédito até o teto', () => {
    const c = check({
      merits: [{ id: 'm1', name: 'Q', meta: { cost: 4 } }],
      flaws: [
        { id: 'f1', name: 'D1', meta: { bonus: 2 } },
        { id: 'f2', name: 'D2', meta: { bonus: 3 } },
      ],
    })
    expect(c.lines.find(l => l.id === 'flaws')).toMatchObject({
      units: 5,
      cost: 3,
    })
    expect(c.freebies).toEqual({
      available: 10,
      credit: 3,
      spent: 4,
      remaining: 9,
    })
  })

  it('tirar o Defeito depois de gastar o crédito estoura', () => {
    // 10 de bônus nos Físicos e 2 na Moral, com 3 de crédito: 12 de 13
    const spending = {
      str: 5,
      dex: 4,
      sta: 1,
      morality: 7,
      flaws: [{ id: 'f1', name: 'D', meta: { bonus: 3 } }],
    }
    expect(check(spending).savable).toBe(true)
    const removed = check({ ...spending, flaws: [] })
    expect(codes(removed.problems)).toEqual([
      'CREATION_FREEBIES_EXCEEDED:blocking',
    ])
  })

  it('Qualidade sem custo não é comprável', () => {
    const c = check({ merits: [{ id: 'm1', name: 'Q' }] })
    expect(c.problems).toContainEqual({
      code: 'CREATION_NOT_PURCHASABLE',
      severity: 'blocking',
      paths: ['values.merits#m1'],
    })
  })

  it('item além da contagem custa por item', () => {
    const c = check({
      gifts: [
        { id: 'g1', name: 'Um' },
        { id: 'g2', name: 'Dois' },
        { id: 'g3', name: 'Três' },
      ],
    })
    expect(group(c, 'gifts', 'gifts')).toMatchObject({
      basic: 2,
      extra: 1,
      freebieCost: 6,
    })
  })

  it('o crédito nunca vira XP nem saldo além do teto', () => {
    const many = Array.from({ length: 6 }, (_, i) => ({
      id: `f${i}`,
      name: `D${i}`,
      meta: { bonus: 7 },
    }))
    expect(check({ flaws: many }).freebies).toEqual({
      available: 10,
      credit: 3,
      spent: 0,
      remaining: 13,
    })
  })
})

describe('checkCreation: prioridades e grupos', () => {
  it('sem prioridade: grupo parado só falta; grupo com pontos bloqueia', () => {
    const idle = check(
      {
        str: 1,
        dex: 1,
        sta: 1,
        cha: 1,
        man: 1,
        app: 1,
        per: 1,
        int: 1,
        wit: 1,
      },
      { priorities: { abilities: ['talents', 'knowledges'] } }
    )
    expect(idle.savable).toBe(true)
    expect(
      idle.problems
        .filter(p => p.code === 'CREATION_PRIORITIES_REQUIRED')
        .map(p => p.severity)
    ).toEqual(['incomplete', 'incomplete', 'incomplete'])

    const busy = check(
      {},
      { priorities: { abilities: ['talents', 'knowledges'] } }
    )
    expect(busy.savable).toBe(false)
    const required = busy.problems.filter(
      p => p.code === 'CREATION_PRIORITIES_REQUIRED'
    )
    expect(required.map(p => p.group)).toEqual(['phys', 'soc', 'men'])
    expect(required[0]).toMatchObject({
      severity: 'blocking',
      amount: 5,
      paths: ['values.str', 'values.dex', 'values.sta'],
    })
    expect(completionRefusal(busy)?.code).toBe('CREATION_PRIORITIES_REQUIRED')
  })

  it('prioridade inválida vale como ausente', () => {
    const c = check({}, { priorities: { attributes: ['phys', 'phys', 'men'] } })
    expect(c.budgets[0]?.priorities).toBeNull()
  })

  it('Disciplinas somam os pontos dos itens', () => {
    const c = check({
      powers: [
        { id: 'p1', name: 'Velocidade', value: 3 },
        { id: 'p2', name: 'Visão', value: 1 },
      ],
    })
    expect(group(c, 'powers', 'powers')).toMatchObject({
      invested: 4,
      basic: 3,
      extra: 1,
      freebieCost: 7,
    })
    expect(group(c, 'powers', 'powers').components.map(x => x.path)).toEqual([
      'values.powers#p1',
      'values.powers#p2',
    ])
  })
})

describe('checkCreation: tetos e iniciais', () => {
  it('hard-cap fixo e pelo valor de outro campo', () => {
    const c = check({ arete: 4, sphereA: 5 })
    const hard = c.problems.filter(p => p.code === 'CREATION_HARD_CAP')
    expect(hard).toEqual([
      {
        code: 'CREATION_HARD_CAP',
        severity: 'blocking',
        paths: ['values.arete'],
        amount: 1,
      },
      {
        code: 'CREATION_HARD_CAP',
        severity: 'blocking',
        paths: ['values.sphereA'],
        amount: 1,
      },
    ])
  })

  it('a Esfera conta a base gravada, mesmo inativa acima do Arete', () => {
    const c = check({ arete: 2, sphereA: 2 })
    expect(c.lines.find(l => l.id === 'spheres')).toMatchObject({
      units: 2,
      cost: 6,
    })
    expect(c.lines.find(l => l.id === 'arete')).toMatchObject({
      units: 1,
      cost: 4,
    })
  })

  it('baseline travado: linhagem c começa em 0 e não compra Aparência', () => {
    const c = { lineage: 'c', app: undefined, cha: 3, man: 2 }
    // Ausente vale 0 pelo padrão da linhagem: nem cobra nem devolve
    expect(check(c).complete).toBe(true)
    expect(check({ ...c, app: 0 }).complete).toBe(true)
    const bought = check({ ...c, app: 1, cha: 2 })
    expect(bought.problems).toContainEqual({
      code: 'CREATION_LOCKED',
      severity: 'blocking',
      paths: ['values.app'],
      amount: 1,
    })
  })

  it('abaixo do inicial não gera crédito e impede concluir', () => {
    const c = check({ app: 0, cha: 3, man: 3 })
    expect(group(c, 'attributes', 'soc')).toMatchObject({
      invested: 4,
      extra: 1,
    })
    expect(c.problems).toContainEqual({
      code: 'CREATION_BELOW_INITIAL',
      severity: 'incomplete',
      paths: ['values.app'],
      amount: 1,
    })
    expect(c.savable).toBe(true)
  })

  it('o inicial derivado acompanha as fontes finais', () => {
    // Virtude comprada com bônus sobe a Moral padrão (estágio final; a regra
    // de cada livro é conferida na Etapa 2b)
    const c = check({ con: 4, morality: 7 })
    expect(c.lines.find(l => l.id === 'virtue')).toBeUndefined()
    expect(group(c, 'virtues', 'virtues')).toMatchObject({
      invested: 5,
      extra: 1,
      freebieCost: 2,
    })
    expect(c.lines.find(l => l.id === 'morality')).toMatchObject({
      units: 0,
      cost: 0,
    })
  })

  it('modificador de Forma não gera investimento', () => {
    expect(check({ form: 'strong' })).toEqual(check({ form: 'normal' }))
  })
})

describe('checkCreation: fora da conta', () => {
  it('evolução fora de qualquer conta não sobe (fail secure)', () => {
    const t = acct() as Json & { fields: Json; sections: Json[] }
    t.fields.extra = { type: 'rating', label: 'Extra', max: 5 }
    ;(t.sections[2] as { fields: string[] }).fields.push('extra')
    const m = compileTemplate(t)
    const c = checkCreation(m, sheet({ extra: 1 }), {
      config: effectiveCreationConfig(m),
      choices: PRIORITIES,
    })
    expect(c.problems).toEqual([
      {
        code: 'CREATION_NOT_PURCHASABLE',
        severity: 'blocking',
        paths: ['values.extra'],
      },
    ])
    // Declarado como fora da conta, passa
    ;(t.creation as Json).untracked = ['extra']
    t.templateVersion = '0.1.1'
    const m2 = compileTemplate(t)
    expect(
      checkCreation(m2, sheet({ extra: 1 }), {
        config: effectiveCreationConfig(m2),
        choices: PRIORITIES,
      }).problems
    ).toEqual([])
  })

  it('os campos do extrato de XP ficam fora da conta da criação', () => {
    expect(check({ xpTotal: 10, xpSpent: 3 }).problems).toEqual([])
  })

  it('jogo, texto e identidade não entram na conta', () => {
    expect(
      check({ notes: 'livre', will: { current: 1 }, affinity: 'sphereB' })
        .problems
    ).toEqual([])
  })

  it('grupo sem preço de bônus não compra acima do orçamento', () => {
    const t = acct() as Json & { costs: { freebie: Json[] } }
    t.costs.freebie = t.costs.freebie.filter(e => e.id !== 'gift')
    t.templateVersion = '0.1.2'
    const m = compileTemplate(t)
    const c = checkCreation(
      m,
      sheet({
        gifts: [
          { id: 'g1', name: 'A' },
          { id: 'g2', name: 'B' },
          { id: 'g3', name: 'C' },
        ],
      }),
      { config: effectiveCreationConfig(m), choices: PRIORITIES }
    )
    expect(c.problems).toContainEqual({
      code: 'CREATION_NOT_PURCHASABLE',
      severity: 'blocking',
      budget: 'gifts',
      group: 'gifts',
      paths: ['values.gifts#g1', 'values.gifts#g2', 'values.gifts#g3'],
      amount: 1,
    })
  })
})

describe('criação livre', () => {
  it('não tem conta', () => {
    const c = check({ str: 5, dex: 5, sta: 5 }, {}, { mode: 'free' })
    expect(c).toMatchObject({
      mode: 'free',
      complete: true,
      savable: true,
      problems: [],
    })
  })

  it('template sem `creation` é sempre livre', () => {
    const m = compileTemplate(templates['coc7e'])
    expect(effectiveCreationConfig(m, { mode: 'points' })).toEqual({
      mode: 'free',
    })
    expect(
      checkCreation(m, { values: {} }, { config: { mode: 'points' } }).mode
    ).toBe('free')
  })
})

describe('checkCreationBatch (avaliação parcial)', () => {
  const batch = (before: Values, after: Values, choices = PRIORITIES) =>
    checkCreationBatch(model, sheet(before), sheet(after), {
      config: points,
      choices,
    })

  it('aceita básicos faltando e excesso pago com bônus', () => {
    expect(batch({}, { str: 1 })).toBeNull()
    expect(batch({}, { str: 4 })).toBeNull()
  })

  it('recusa bônus acima do saldo, sem aplicação parcial', () => {
    const r = batch({}, { str: 5, dex: 5 })
    expect(r?.code).toBe('CREATION_BUDGET_EXCEEDED')
    expect(codes(r?.problems ?? [])).toEqual([
      'CREATION_FREEBIES_EXCEEDED:blocking',
    ])
  })

  it('redistribuir no mesmo lote passa', () => {
    const over = { str: 5, dex: 5, sta: 1 }
    expect(batch({ str: 5, dex: 4, sta: 1 }, over)).not.toBeNull()
    expect(
      batch({ str: 5, dex: 4, sta: 2 }, { str: 4, dex: 5, sta: 2 })
    ).toBeNull()
  })

  it('avanço sem prioridade é recusado; identidade continua editável', () => {
    const none = { priorities: {} }
    const blank = {
      str: 1,
      dex: 1,
      sta: 1,
      cha: 1,
      man: 1,
      app: 1,
      per: 1,
      int: 1,
      wit: 1,
      alert: 0,
      brawl: 0,
      lore: 0,
      occult: 0,
    }
    const r = batch(blank, { ...blank, str: 2 }, none)
    expect(r?.code).toBe('CREATION_PRIORITIES_REQUIRED')
    // Um problema que já existia e não piorou não trava o nome
    expect(
      batch({ ...blank, str: 2 }, { ...blank, str: 2, name: 'Outro' }, none)
    ).toBeNull()
    expect(batch({ ...blank, str: 2 }, { ...blank, str: 3 }, none)?.code).toBe(
      'CREATION_PRIORITIES_REQUIRED'
    )
  })

  it('baixar o que estourou é aceito', () => {
    expect(batch({ str: 5, dex: 5 }, { str: 5, dex: 4 })).toBeNull()
  })
})

describe('configuração e escolhas', () => {
  it('precedência: template → crônica → ficha', () => {
    expect(effectiveCreationConfig(model)).toEqual({
      mode: 'points',
      freebies: 10,
    })
    expect(
      effectiveCreationConfig(
        model,
        { freebies: 15, budgets: { powers: 4 } },
        { budgets: { attributes: [7, 5, 3] } },
        null
      )
    ).toEqual({
      mode: 'points',
      budgets: { powers: 4, attributes: [7, 5, 3] },
      freebies: 15,
    })
    expect(
      effectiveCreationConfig(model, { mode: 'free' }, { mode: 'points' }).mode
    ).toBe('points')
    // Fora do formato: ignorado
    expect(
      effectiveCreationConfig(model, {
        budgets: { attributes: [1, 2], nope: 3, powers: -1 } as never,
        freebies: 9999,
      })
    ).toEqual({ mode: 'points', freebies: 10 })
  })

  it('o ajuste do narrador muda a conta', () => {
    const c = check(
      { str: 5, dex: 5 },
      PRIORITIES,
      effectiveCreationConfig(model, { freebies: 20 })
    )
    expect(c.freebies?.remaining).toBe(0)
    const tighter = effectiveCreationConfig(model, {
      budgets: { attributes: [6, 3, 2] },
    })
    expect(
      group(check({}, PRIORITIES, tighter), 'attributes', 'phys').missing
    ).toBe(1)
    const pw = effectiveCreationConfig(model, { budgets: { powers: 1 } })
    expect(group(check({}, PRIORITIES, pw), 'powers', 'powers').extra).toBe(2)
  })

  it('validateCreationConfig', () => {
    expect(
      validateCreationConfig(model, {
        mode: 'free',
        freebies: 0,
        budgets: { attributes: [1, 1, 1], powers: 0 },
      })
    ).toEqual([])
    expect(validateCreationConfig(model, null)).toEqual([
      { path: '', message: 'precisa ser objeto' },
    ])
    expect(
      validateCreationConfig(model, {
        mode: 'x',
        freebies: 1.5,
        budgets: { attributes: [1], nope: 1 },
        hack: true,
      }).map(i => i.path)
    ).toEqual([
      'hack',
      'mode',
      'freebies',
      'budgets.attributes',
      'budgets.nope',
    ])
    expect(validateCreationConfig(model, { budgets: [] })).toEqual([
      { path: 'budgets', message: 'precisa ser objeto' },
    ])
    const coc = compileTemplate(templates['coc7e'])
    expect(validateCreationConfig(coc, { mode: 'points' })).toEqual([
      { path: 'mode', message: 'o template não tem criação por pontos' },
    ])
  })

  it('validateCreationChoices', () => {
    expect(validateCreationChoices(model, PRIORITIES)).toEqual([])
    expect(validateCreationChoices(model, {})).toEqual([])
    expect(validateCreationChoices(model, 1)).toEqual([
      { path: '', message: 'precisa ser objeto' },
    ])
    expect(validateCreationChoices(model, { priorities: [] })).toEqual([
      { path: 'priorities', message: 'precisa ser objeto' },
    ])
    expect(
      validateCreationChoices(model, {
        priorities: {
          attributes: ['phys', 'soc'],
          powers: ['x'],
          abilities: ['talents', 'talents'],
        },
        other: 1,
      }).map(i => i.path)
    ).toEqual([
      'other',
      'priorities.attributes',
      'priorities.powers',
      'priorities.abilities',
    ])
  })
})

describe('creationFreeze', () => {
  it('grava os iniciais com fórmula ainda ausentes', () => {
    expect(creationFreeze(model, sheet({ app: undefined }))).toEqual({
      app: 1,
      morality: 6,
      will: { current: 3, permanent: 3 },
    })
    // Já gravado: fica como está
    expect(
      creationFreeze(
        model,
        sheet({ morality: 7, app: 2, will: { current: 3, permanent: 3 } })
      )
    ).toEqual({})
  })
})

describe('point-buy do D&D (fixture, fora de PUBLISHED_SYSTEMS)', () => {
  const m = compileTemplate(dnd())
  const config = effectiveCreationConfig(m)
  const run = (scores: number[]) => {
    const [str, dex, con, int, wis, cha] = scores
    return checkCreation(
      m,
      { values: { name: 'Lia', str, dex, con, int, wis, cha } },
      { config }
    )
  }

  it('27 exatos com 15/14/13/12/10/8', () => {
    const c = run([15, 14, 13, 12, 10, 8])
    expect(c.problems).toEqual([])
    expect(c.budgets[0]?.groups[0]).toMatchObject({
      measure: 'cost',
      invested: 27,
      budget: 27,
    })
  })

  it('custo não linear nos últimos valores', () => {
    const cost = (v: number) =>
      run([v, 8, 8, 8, 8, 8]).budgets[0]?.groups[0]?.invested
    expect([8, 9, 10, 11, 12, 13, 14, 15].map(cost)).toEqual([
      0, 1, 2, 3, 4, 5, 7, 9,
    ])
  })

  it('sobra, excesso, 7/16 e reembolso por redução', () => {
    expect(codes(run([15, 14, 13, 12, 10, 9]).problems)).toEqual([
      'CREATION_POINTBUY_EXCEEDED:blocking',
    ])
    const under = run([15, 14, 13, 12, 8, 8])
    expect(under.problems).toEqual([
      {
        code: 'CREATION_POINTBUY_UNSPENT',
        severity: 'incomplete',
        budget: 'abilities',
        group: 'abilities',
        paths: [],
        amount: 2,
      },
    ])
    expect(codes(run([7, 15, 15, 8, 8, 8]).problems)).toContain(
      'CREATION_OUT_OF_RANGE:blocking'
    )
    expect(codes(run([16, 15, 8, 8, 8, 8]).problems)).toContain(
      'CREATION_OUT_OF_RANGE:blocking'
    )
    // Baixar de 15 para 14 devolve 2
    expect(run([14, 14, 13, 12, 10, 8]).budgets[0]?.groups[0]?.invested).toBe(
      25
    )
  })

  it('a ordem dos atributos não muda a conta', () => {
    const a = run([15, 14, 13, 12, 10, 8]).budgets[0]?.groups[0]?.invested
    const b = run([8, 10, 12, 13, 14, 15]).budgets[0]?.groups[0]?.invested
    expect(a).toBe(b)
  })

  it('ausente vale o padrão do campo (10, custo 2)', () => {
    const c = checkCreation(m, { values: { name: 'Lia' } }, { config })
    expect(c.budgets[0]?.groups[0]?.invested).toBe(12)
  })

  it('o resto da ficha de D&D fica fora da conta declaradamente', () => {
    const c = checkCreation(
      m,
      {
        values: {
          name: 'Lia',
          level: 5,
          saveStr: 'proficient',
          str: 15,
          dex: 14,
          con: 13,
          int: 12,
          wis: 10,
          cha: 8,
        },
      },
      { config }
    )
    expect(c.problems).toEqual([])
  })
})

describe('validação do contrato no template', () => {
  it('template sintético e D&D passam', () => {
    expect(() => compileTemplate(acct())).not.toThrow()
    expect(clone(templates['dnd5e-2014'])).toHaveProperty('creation')
  })
})

describe('checkCreationUpdate (escolhas e configuração)', () => {
  const at = (
    values: Values,
    config: CreationConfig,
    choices: CreationChoices = PRIORITIES
  ) => ({ sheet: sheet(values), input: { config, choices } })

  it('cortar o orçamento abaixo do que já foi gasto é recusado', () => {
    const tight = effectiveCreationConfig(model, { freebies: 0 })
    expect(
      checkCreationUpdate(model, at({ str: 4 }, points), at({ str: 4 }, tight))
        ?.code
    ).toBe('CREATION_BUDGET_EXCEEDED')
    expect(checkCreationUpdate(model, at({}, points), at({}, tight))).toBeNull()
  })

  it('criação livre passa; prioridade que estoura o bônus, não', () => {
    const over = { str: 5, dex: 5 }
    expect(
      checkCreationUpdate(model, at(over, points), at(over, { mode: 'free' }))
    ).toBeNull()
    const swap = {
      priorities: {
        attributes: ['men', 'soc', 'phys'],
        abilities: ['talents', 'knowledges'],
      },
    }
    expect(
      checkCreationUpdate(model, at({}, points), at({}, points, swap))?.code
    ).toBe('CREATION_BUDGET_EXCEEDED')
  })
})

describe('metadados de criação da ficha', () => {
  it('parseCharacterCreation guarda só o que tem forma', () => {
    expect(parseCharacterCreation(model, null)).toEqual({})
    const ok = {
      choices: PRIORITIES,
      config: { freebies: 3 },
      returned: { reason: 'Refaça', at: '2026-10-23T00:00:00Z' },
    }
    expect(parseCharacterCreation(model, ok)).toEqual(ok)
    expect(
      parseCharacterCreation(model, {
        choices: { priorities: { attributes: ['x'] } },
        config: { mode: 'nope' },
        returned: { reason: 1 },
      })
    ).toEqual({})
  })

  it('creationInputOf aplica a camada da ficha', () => {
    expect(
      creationInputOf(model, { config: { freebies: 3 }, choices: PRIORITIES })
    ).toEqual({ config: { mode: 'points', freebies: 3 }, choices: PRIORITIES })
    expect(creationInputOf(model, {})).toEqual({
      config: { mode: 'points', freebies: 10 },
    })
  })
})
