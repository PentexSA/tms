import {
  type CreationChoices,
  type CreationGroup,
  checkCreation,
  compileTemplate,
  effectiveCreationConfig,
  resolve,
  type SheetData,
  type SheetModel,
} from '@tms/sheet-core'
import { modelOf } from '../../../test/fixtures'
import {
  type CreationPhase,
  completeLabel,
  counterSpoken,
  counterText,
  creationActive,
  creationInfoOf,
  creationRefusalOf,
  draftRefusal,
  freebieLedger,
  freebiesBalance,
  freebiesLeftText,
  groupFor,
  priorityNote,
  reorder,
  stepAdvice,
} from '../creation'

const template = require('../../../../../design/templates/testes/acct-teste.json')
const model = compileTemplate(template)

const info = {
  revision: 2,
  mode: 'points' as const,
  accounting: true,
  choices: {},
  config: {},
  effective: effectiveCreationConfig(model),
  returned: null,
  approval: true,
}

describe('metadados e ciclo da criação', () => {
  it('aceita a forma da API e rejeita entrada hostil/incompleta', () => {
    expect(creationInfoOf(info)).toMatchObject(info)
    expect(creationInfoOf(null)).toBeNull()
    expect(creationInfoOf({ revision: '2', effective: {} })).toBeNull()
  })

  it('a conta só vale por pontos em creating/pending', () => {
    expect(creationActive(info, 'creating')).toBe(true)
    expect(creationActive(info, 'pending')).toBe(true)
    expect(creationActive(info, 'active')).toBe(false)
    expect(creationActive({ ...info, mode: 'free' }, 'creating')).toBe(false)
  })

  it('o rótulo separa concluir, submeter e concluir/aprovar', () => {
    expect(completeLabel(info, new Set(['owner']))).toBe(
      'Enviar para aprovação'
    )
    expect(completeLabel(info, new Set(['storyteller']))).toBe(
      'Concluir e aprovar'
    )
    expect(
      completeLabel({ ...info, approval: false }, new Set(['owner']))
    ).toBe('Concluir criação')
  })

  it('só reconhece códigos contábeis conhecidos', () => {
    expect(creationRefusalOf({ code: 'CREATION_INCOMPLETE' })).toBe(
      'CREATION_INCOMPLETE'
    )
    expect(creationRefusalOf({ code: 'SHEET_LOCKED' })).toBeNull()
  })
})

describe('prioridades e contadores', () => {
  it('troca o grupo de posição sem duplicar prioridade', () => {
    expect(
      reorder(['phys', 'soc', 'men'], ['phys', 'soc', 'men'], 'men', 0)
    ).toEqual(['men', 'soc', 'phys'])
    expect(reorder(undefined, ['phys', 'soc', 'men'], 'soc', 2)).toEqual([
      'phys',
      'men',
      'soc',
    ])
  })

  it('localiza o grupo genérico do template', () => {
    expect(groupFor(model, ['str', 'dex', 'sta'])).toEqual({
      budget: 'attributes',
      group: 'phys',
    })
    expect(groupFor(model, ['str', 'cha'])).toBeNull()
  })

  it('forma o contador visual e falado sem refazer a conta', () => {
    const group = {
      id: 'phys',
      label: 'Físicos',
      measure: 'points',
      budget: 5,
      basic: 5,
      extra: 1,
    } as CreationGroup
    expect(counterText(group)).toBe('5/5 · +1 bônus')
    expect(counterSpoken(group)).toBe(
      'Físicos: 5 de 5 pontos básicos, mais 1 com bônus'
    )
    expect(counterText({ ...group, budget: null, basic: 0, extra: 0 })).toBe(
      'Escolha a prioridade'
    )
  })

  it('na fase de bônus, com o grupo cheio, o contador diz o preço do próximo (R-17)', () => {
    const full = {
      id: 'phys',
      label: 'Físicos',
      measure: 'points',
      budget: 7,
      basic: 7,
      missing: 0,
      extra: 1,
      price: 5,
    } as CreationGroup
    expect(counterText(full, 'freebies')).toBe('7/7 · +1 bônus · +1 = 5 bônus')
    expect(counterSpoken(full, 'freebies')).toBe(
      'Físicos: 7 de 7 pontos básicos, mais 1 com bônus, cada ponto a mais custa 5 de bônus'
    )
    // Em Básicos, ou com básico sobrando, ou sem preço: o de hoje
    expect(counterText(full, 'basics')).toBe('7/7 · +1 bônus')
    expect(counterText({ ...full, missing: 1, basic: 6 }, 'freebies')).toBe(
      '6/7 · +1 bônus'
    )
    expect(counterText({ ...full, price: null }, 'freebies')).toBe(
      '7/7 · +1 bônus'
    )
    expect(
      counterSpoken(
        { ...full, measure: 'items', extra: 0, price: 6 },
        'freebies'
      )
    ).toBe('Físicos: 7 de 7 itens básicos, cada item a mais custa 6 de bônus')
  })
})

// Uma ficha do `acct-teste` que fecha a conta exata, sem bônus (a mesma do
// core e da API). Números de teste.
const COMPLETE: Record<string, unknown> = {
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
const PRIORITIES: CreationChoices = {
  priorities: {
    attributes: ['phys', 'soc', 'men'],
    abilities: ['talents', 'knowledges'],
  },
}

/** O toque de `before` para `after` na fase dada, como o store avalia. */
function refusalOf(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  {
    phase = 'basics',
    choices = PRIORITIES,
    m = model,
  }: {
    phase?: CreationPhase
    choices?: CreationChoices
    m?: SheetModel
  } = {}
) {
  const input = { config: effectiveCreationConfig(m), choices }
  const sheets = {
    before: { values: before, specialties: {} } as SheetData,
    after: { values: after, specialties: {} } as SheetData,
  }
  return draftRefusal(
    m,
    sheets,
    {
      before: checkCreation(m, sheets.before, input),
      after: checkCreation(m, sheets.after, input),
    },
    input,
    phase
  )
}

describe('o motivo certo da recusa (T-07, T-57)', () => {
  it('Básicos: o 4º ponto num traço com teto diz o teto, não o grupo (T-07)', () => {
    const before = { ...COMPLETE, brawl: 1 }
    // Talentos em 4/5: o grupo ainda tem básico, mas Prontidão está no teto
    const why = refusalOf(before, { ...before, alert: 4 })
    expect(why).toEqual({
      cause: 'cap',
      text: 'Prontidão: com pontos básicos, vai até 3. Acima disso, cada ponto custa 2 de bônus.',
      action: 'budget',
    })
    expect(why?.text).not.toContain('já foram usados')
  })

  it('Básicos: o grupo cheio sem teto diz o orçamento e o preço', () => {
    expect(refusalOf(COMPLETE, { ...COMPLETE, str: 4 })).toEqual({
      cause: 'budget',
      text: 'Físicos: os 5 pontos básicos já foram usados. Para passar disso, use os pontos de bônus (5 por ponto).',
      action: 'budget',
    })
  })

  it('Básicos: itens além da contagem dizem "por item"', () => {
    const gifts = [...(COMPLETE.gifts as object[]), { id: 'g3', name: 'Três' }]
    expect(refusalOf(COMPLETE, { ...COMPLETE, gifts })?.text).toBe(
      'Dons: os 2 itens básicos já foram usados. Para passar disso, use os pontos de bônus (6 por item).'
    )
  })

  it('Bônus: o saldo não cobre e o texto diz quanto custa e quanto resta (T-57)', () => {
    // 5 (Força 4) + 4 (Arete 2): restam 1 de 10
    const before = { ...COMPLETE, str: 4, arete: 2 }
    expect(
      refusalOf(before, { ...before, brawl: 3 }, { phase: 'freebies' })
    ).toEqual({
      cause: 'freebies',
      text: 'Faltaria 1 de bônus: custa 2, resta 1.',
    })
  })

  it('Bônus: o custo citado é o líquido, com o desconto derivado (T-57)', () => {
    // A Vontade comprada (4, de partida 3 pela Consciência) e o saldo zerado:
    // subir a Consciência custa 2 na tabela, mas a Vontade passa a partir de
    // 4 e devolve 1. O toque custa 1.
    const before = {
      ...COMPLETE,
      will: { permanent: 4, current: 4 },
      str: 4,
      arete: 2,
    }
    expect(
      refusalOf(before, { ...before, con: 4 }, { phase: 'freebies' })
    ).toEqual({
      cause: 'freebies',
      text: 'Faltaria 1 de bônus: custa 1, restam 0.',
    })
  })

  it('Bônus: com o saldo já negativo, diz quanto passa e o custo', () => {
    const config = { ...effectiveCreationConfig(model), freebies: 0 }
    const input = { config, choices: PRIORITIES }
    const before = { values: { ...COMPLETE, str: 4 } } as SheetData
    const after = { values: { ...COMPLETE, str: 4, dex: 4 } } as SheetData
    expect(
      draftRefusal(
        model,
        { before, after },
        {
          before: checkCreation(model, before, input),
          after: checkCreation(model, after, input),
        },
        input,
        'freebies'
      )
    ).toEqual({
      cause: 'freebies',
      text: 'Bônus: o saldo já está 5 acima; este ponto custa 5.',
    })
  })

  it('sem prioridade, cita o grupo', () => {
    expect(
      refusalOf(COMPLETE, { ...COMPLETE, str: 4 }, { choices: {} })
    ).toEqual({
      cause: 'priorities',
      text: 'Físicos: escolha a prioridade antes de distribuir os pontos.',
    })
  })

  it('valor travado diz o valor e a escolha que trava', () => {
    const before = { ...COMPLETE, lineage: 'c', app: 0, cha: 3 }
    expect(refusalOf(before, { ...before, app: 1 })).toEqual({
      cause: 'locked',
      text: 'Aparência: fica em 0 na criação (Linhagem: C).',
    })
  })

  it('o hard-cap diz até onde vai, antes do saldo', () => {
    const before = { ...COMPLETE, arete: 3 }
    expect(
      refusalOf(before, { ...before, arete: 4 }, { phase: 'freebies' })
    ).toEqual({ cause: 'ceiling', text: 'Arete: na criação, vai até 3.' })
  })

  it('o que não se compra continua com a frase de hoje', () => {
    const merits = [{ id: 'm1', name: 'Q' }]
    expect(
      refusalOf(COMPLETE, { ...COMPLETE, merits }, { phase: 'freebies' })
    ).toEqual({
      cause: 'not-purchasable',
      text: 'Qualidades: não se compra na criação.',
    })
  })

  it('point-buy fora da tabela cai no problema da conta', () => {
    const dnd = modelOf('dnd5e-2014')
    const base = {
      name: 'Lia',
      str: 15,
      dex: 14,
      con: 13,
      int: 12,
      wis: 10,
      cha: 8,
    }
    expect(
      refusalOf(base, { ...base, str: 16 }, { m: dnd, choices: {} })
    ).toEqual({ cause: 'other', text: 'Força: fora da faixa da criação.' })
  })

  it('o que cabe não é recusado; em Bônus, o grupo cheio passa', () => {
    expect(refusalOf({ ...COMPLETE, str: 2 }, COMPLETE)).toBeNull()
    expect(
      refusalOf(COMPLETE, { ...COMPLETE, str: 4 }, { phase: 'freebies' })
    ).toBeNull()
  })
})

// T-20, R-17: a previsão do "+" antes do toque, pelo preço de tabela
describe('stepAdvice: o que o próximo ponto faria', () => {
  const adviceOf = (
    values: Record<string, unknown>,
    path: string,
    {
      phase = 'basics',
      choices = PRIORITIES,
      m = model,
      freebies,
    }: {
      phase?: CreationPhase
      choices?: CreationChoices
      m?: SheetModel
      freebies?: number
    } = {}
  ) => {
    const config = {
      ...effectiveCreationConfig(m),
      ...(freebies === undefined ? {} : { freebies }),
    }
    const sheet = { values } as SheetData
    const check = checkCreation(m, sheet, { config, choices })
    return stepAdvice(m, check, phase, path, resolve(m, sheet))
  }

  it('sem prioridade, pede a escolha', () => {
    expect(adviceOf(COMPLETE, 'values.str', { choices: {} })).toEqual({
      blocked: 'priorities',
      text: 'Físicos: escolha a prioridade antes de distribuir os pontos.',
      cost: null,
      inline: false,
    })
  })

  it('Básicos: o grupo cheio trava com o texto do grupo (não escrito na linha)', () => {
    expect(adviceOf(COMPLETE, 'values.str')).toMatchObject({
      blocked: 'budget',
      text: 'Físicos: os 5 pontos básicos já foram usados. Para passar disso, use os pontos de bônus (5 por ponto).',
      inline: false,
    })
    // Com básico sobrando, passa sem custo
    expect(adviceOf({ ...COMPLETE, str: 2 }, 'values.dex')).toEqual({
      blocked: null,
      text: null,
      cost: 0,
      inline: false,
    })
  })

  it('Básicos: o traço no teto trava, escrito na linha enquanto o grupo não fecha', () => {
    expect(adviceOf({ ...COMPLETE, brawl: 1 }, 'values.alert')).toEqual({
      blocked: 'cap',
      text: 'Com pontos básicos, vai até 3. Acima disso, +1 = 2 bônus.',
      cost: null,
      inline: true,
    })
    // Com o grupo cheio, o cabeçalho já diz 5/5
    expect(adviceOf(COMPLETE, 'values.alert')).toMatchObject({
      blocked: 'cap',
      inline: false,
    })
  })

  it('valor travado e hard-cap travam em qualquer fase', () => {
    const c = { ...COMPLETE, lineage: 'c', app: 0, cha: 3 }
    expect(adviceOf(c, 'values.app')).toMatchObject({
      blocked: 'locked',
      text: 'Fica em 0 na criação (Linhagem: C).',
    })
    expect(
      adviceOf({ ...COMPLETE, arete: 3 }, 'values.arete', {
        phase: 'freebies',
      })
    ).toMatchObject({ blocked: 'ceiling', text: 'Na criação, vai até 3.' })
    // A Esfera vai até o Arete (1): de 0 para 1 passa, pago com bônus
    expect(adviceOf(COMPLETE, 'values.sphereA')).toMatchObject({
      blocked: null,
      text: '+1 = 3 bônus',
    })
    expect(
      adviceOf({ ...COMPLETE, sphereA: 1 }, 'values.sphereA')
    ).toMatchObject({ blocked: 'ceiling', text: 'Na criação, vai até 1.' })
  })

  it('Bônus: o grupo cheio custa o preço; sem saldo, trava', () => {
    expect(adviceOf(COMPLETE, 'values.str', { phase: 'freebies' })).toEqual({
      blocked: null,
      text: '+1 = 5 bônus',
      cost: 5,
      inline: false,
    })
    expect(
      adviceOf(COMPLETE, 'values.str', { phase: 'freebies', freebies: 4 })
    ).toEqual({
      blocked: 'freebies',
      text: '+1 = 5 bônus; restam 4.',
      cost: 5,
      inline: false,
    })
    expect(
      adviceOf(COMPLETE, 'values.brawl', { phase: 'freebies', freebies: 1 })
    ).toMatchObject({ blocked: 'freebies', text: '+1 = 2 bônus; resta 1.' })
    // O traço no teto com o grupo incompleto: o custo escrito na linha
    expect(
      adviceOf({ ...COMPLETE, brawl: 1 }, 'values.alert', {
        phase: 'freebies',
      })
    ).toEqual({ blocked: null, text: '+1 = 2 bônus', cost: 2, inline: true })
    // Com básico sobrando e abaixo do teto, ainda é básico
    expect(
      adviceOf({ ...COMPLETE, brawl: 1 }, 'values.brawl', {
        phase: 'freebies',
      })
    ).toMatchObject({ blocked: null, cost: 0 })
  })

  it('linha de bônus fora dos orçamentos: o preço da linha, escrito na linha', () => {
    expect(adviceOf(COMPLETE, 'values.will')).toEqual({
      blocked: null,
      text: '+1 = 1 bônus',
      cost: 1,
      inline: true,
    })
    expect(adviceOf(COMPLETE, 'values.morality', { freebies: 1 })).toEqual({
      blocked: 'freebies',
      text: '+1 = 2 bônus; resta 1.',
      cost: 2,
      inline: true,
    })
    // Abaixo do valor de partida, o ponto não custa
    expect(adviceOf({ ...COMPLETE, morality: 4 }, 'values.morality')).toEqual({
      blocked: null,
      text: null,
      cost: 0,
      inline: false,
    })
  })

  it('grupo sem preço de bônus não se compra além dos básicos', () => {
    const noPrice = compileTemplate({
      ...template,
      costs: {
        ...template.costs,
        freebie: template.costs.freebie.filter(
          (e: { id: string }) => e.id !== 'attribute'
        ),
      },
    })
    expect(
      adviceOf(COMPLETE, 'values.str', { phase: 'freebies', m: noPrice })
    ).toMatchObject({ blocked: 'not-purchasable' })
  })

  it('point-buy (D&D): o degrau da tabela e o fim dela', () => {
    const dnd = modelOf('dnd5e-2014')
    const base = {
      name: 'Lia',
      str: 15,
      dex: 14,
      con: 13,
      int: 12,
      wis: 10,
      cha: 8,
    }
    const opts = { m: dnd, choices: {} }
    expect(adviceOf(base, 'values.str', opts)).toEqual({
      blocked: 'ceiling',
      text: 'Na criação, vai até 15.',
      cost: null,
      inline: true,
    })
    expect(adviceOf({ ...base, cha: 8, wis: 8 }, 'values.con', opts)).toEqual({
      blocked: null,
      text: '+1 = 2 pontos',
      cost: null,
      inline: true,
    })
    expect(adviceOf(base, 'values.cha', opts)).toEqual({
      blocked: 'budget',
      text: '+1 = 1 ponto; faltam 0 de 27.',
      cost: null,
      inline: true,
    })
  })

  it('fora de qualquer conta, sem previsão', () => {
    expect(adviceOf(COMPLETE, 'values.name')).toBeNull()
    expect(adviceOf(COMPLETE, 'values.xpTotal')).toBeNull()
  })
})

describe('bônus que sobram (T-18)', () => {
  const left = (remaining: number, credit = 0) =>
    ({
      freebies: { available: 15, credit, spent: 15 - remaining, remaining },
    }) as unknown as Parameters<typeof freebiesLeftText>[0]

  it('a sobra na confirmação: nada com 0, singular com 1, plural com N', () => {
    expect(freebiesLeftText(left(0))).toBeNull()
    expect(freebiesLeftText(left(-2))).toBeNull()
    expect(freebiesLeftText(null)).toBeNull()
    expect(freebiesLeftText(left(1))).toBe(
      'Sobra 1 ponto de bônus. Ele não vira XP.'
    )
    expect(freebiesLeftText(left(4))).toBe(
      'Sobram 4 pontos de bônus. Eles não viram XP.'
    )
  })

  it('o saldo diz o que resta, não o que foi usado', () => {
    expect(freebiesBalance(left(15))).toBe('Bônus: restam 15 de 15')
    expect(freebiesBalance(left(1, 3))).toBe('Bônus: resta 1 de 18')
    expect(freebiesBalance(left(-3))).toBe('Bônus: 3 acima do saldo')
    expect(freebiesBalance(null)).toBeNull()
  })
})

// R-17: o extrato do bônus, todo calculado da conta que o app já tem
describe('freebieLedger: onde foram os bônus', () => {
  const ledgerOf = (values: Record<string, unknown>, freebies?: number) => {
    const config = {
      ...effectiveCreationConfig(model),
      ...(freebies === undefined ? {} : { freebies }),
    }
    const check = checkCreation(model, { values } as SheetData, {
      config,
      choices: PRIORITIES,
    })
    return { ledger: freebieLedger(model, check), check }
  }

  it('cada fonte numa linha, e o total bate com o saldo da conta', () => {
    const { ledger, check } = ledgerOf(
      {
        ...COMPLETE,
        // Talentos 6/5, com Prontidão 4 acima do teto
        alert: 4,
        brawl: 2,
        will: { permanent: 4, current: 4 },
        merits: [
          { id: 'm1', name: 'Q1', meta: { cost: 1 } },
          { id: 'm2', name: 'Q2', meta: { cost: 2 } },
        ],
        flaws: [{ id: 'f1', name: 'D1', meta: { bonus: 5 } }],
      },
      30
    )
    expect(ledger?.entries).toEqual([
      {
        key: 'abilities.talents',
        text: 'Habilidades › Talentos: 1 × 2 = 2',
        detail: 'Prontidão acima de 3: 1',
      },
      {
        key: 'will',
        text: 'Vontade: 1 × 1 = 1',
        detail: 'parte de 3, que vem de Consciência',
      },
      { key: 'merits', text: 'Qualidades (2 itens): 3', detail: null },
      { key: 'flaws', text: 'Defeitos: devolvem 5, contam 3', detail: null },
    ])
    // 2 + 1 + 3 gastos, 3 de crédito: 30 + 3 − 6
    expect(check.freebies).toMatchObject({ spent: 6, credit: 3, remaining: 27 })
    expect(ledger?.total).toBe('Gastos 6 · crédito 3 · restam 27 de 33')
  })

  it('grupo de orçamento fixo leva só o rótulo; o crédito igual diz uma vez', () => {
    const { ledger } = ledgerOf({
      ...COMPLETE,
      con: 4,
      flaws: [{ id: 'f1', name: 'D1', meta: { bonus: 1 } }],
    })
    expect(ledger?.entries.map(e => e.text)).toEqual([
      'Virtudes: 1 × 2 = 2',
      'Defeitos: devolvem 1',
    ])
    expect(ledger?.total).toBe('Gastos 2 · crédito 1 · restam 9 de 11')
  })

  it('acima do saldo, o total diz quanto passa', () => {
    const { ledger } = ledgerOf({ ...COMPLETE, str: 5 }, 5)
    expect(ledger?.total).toBe('Gastos 10 · 5 acima do saldo de 5')
  })

  it('sem gasto, ou sem bônus no template, não há extrato', () => {
    expect(ledgerOf(COMPLETE).ledger).toBeNull()
    expect(freebieLedger(model, null)).toBeNull()
    const dnd = modelOf('dnd5e-2014')
    const check = checkCreation(
      dnd,
      { values: { name: 'Lia', str: 15 } } as SheetData,
      { config: effectiveCreationConfig(dnd) }
    )
    expect(freebieLedger(dnd, check)).toBeNull()
  })
})

// R-28: escolher a prioridade de um grupo mexe nos outros sem aviso
describe('priorityNote: quem mudou de lugar junto', () => {
  const budget = {
    groups: [
      { id: 'phys', label: 'Físicos', targets: [] },
      { id: 'soc', label: 'Sociais', targets: [] },
      { id: 'men', label: 'Mentais', targets: [] },
    ],
  }
  const groups = ['phys', 'soc', 'men']
  const values = [7, 5, 3]

  it('sem ordem salva, cita os outros grupos marcados sozinhos', () => {
    const after = reorder(undefined, groups, 'phys', 0)
    expect(priorityNote(budget, values, undefined, after, 'phys')).toBe(
      'Prioridades salvas. Sociais ficou Secundária (5) e Mentais, Terciária (3): toque no grupo para trocar.'
    )
    const third = reorder(undefined, groups, 'men', 0)
    expect(priorityNote(budget, values, undefined, third, 'men')).toBe(
      'Prioridades salvas. Sociais ficou Secundária (5) e Físicos, Terciária (3): toque no grupo para trocar.'
    )
  })

  it('com ordem salva, a troca cita só o outro grupo', () => {
    const before = ['phys', 'soc', 'men']
    const after = reorder(before, groups, 'men', 0)
    expect(priorityNote(budget, values, before, after, 'men')).toBe(
      'Prioridades salvas. Físicos ficou Terciária (3): toque no grupo para trocar.'
    )
  })

  it('sem outro grupo afetado, só "Prioridades salvas"', () => {
    const before = ['phys', 'soc', 'men']
    expect(priorityNote(budget, values, before, before, 'phys')).toBe(
      'Prioridades salvas'
    )
  })

  it('quatro grupos: a lista fecha com "e"', () => {
    const four = {
      groups: [...budget.groups, { id: 'x', label: 'Extra', targets: [] }],
    }
    const ids = ['phys', 'soc', 'men', 'x']
    const after = reorder(undefined, ids, 'phys', 0)
    expect(priorityNote(four, [7, 5, 3, 1], undefined, after, 'phys')).toBe(
      'Prioridades salvas. Sociais ficou Secundária (5), Mentais, Terciária (3) e Extra, Quarta (1): toque no grupo para trocar.'
    )
  })
})

// Achados do /code-review do P05-C
describe('previsão e motivo: casos de borda', () => {
  const withTemplate = (patch: (t: typeof template) => typeof template) =>
    compileTemplate(patch(JSON.parse(JSON.stringify(template))))

  it('point-buy abaixo da base: o ponto só devolve o que faltava', () => {
    const dnd = modelOf('dnd5e-2014')
    const sheet = {
      values: { name: 'Lia', str: 6, dex: 8, con: 8, int: 8, wis: 8, cha: 8 },
    } as SheetData
    const check = checkCreation(dnd, sheet, {
      config: effectiveCreationConfig(dnd),
    })
    expect(stepAdvice(dnd, check, 'basics', 'values.str')).toEqual({
      blocked: null,
      text: null,
      cost: 0,
      inline: false,
    })
  })

  it('Bônus: traço no teto num grupo sem preço diz o teto, não "os básicos acabaram"', () => {
    const noAbility = withTemplate(t => ({
      ...t,
      costs: {
        ...t.costs,
        freebie: t.costs.freebie.filter(
          (e: { id: string }) => e.id !== 'ability'
        ),
      },
    }))
    const sheet = { values: { ...COMPLETE, brawl: 1 } } as SheetData
    const check = checkCreation(noAbility, sheet, {
      config: effectiveCreationConfig(noAbility),
      choices: PRIORITIES,
    })
    expect(stepAdvice(noAbility, check, 'freebies', 'values.alert')).toEqual({
      blocked: 'not-purchasable',
      text: 'Com pontos básicos, vai até 3; acima disso, não se compra com bônus.',
      cost: null,
      inline: true,
    })
  })

  it('a escolha que trava segue o critério da conta, inclusive `equalsTarget`', () => {
    // A Esfera da afinidade começa travada em 0 (condição pelo próprio alvo)
    const affinity = withTemplate(t => ({
      ...t,
      creation: {
        ...t.creation,
        baselines: [
          ...t.creation.baselines,
          {
            targets: ['sphereA', 'sphereB'],
            value: 0,
            locked: true,
            when: { field: 'affinity', equalsTarget: true },
          },
        ],
      },
    }))
    const input = {
      config: effectiveCreationConfig(affinity),
      choices: PRIORITIES,
    }
    const before = {
      values: { ...COMPLETE, affinity: 'sphereA', arete: 2 },
    } as SheetData
    const touch = (field: string) => {
      const after = {
        values: { ...before.values, [field]: 1 },
      } as SheetData
      return draftRefusal(
        affinity,
        { before, after },
        {
          before: checkCreation(affinity, before, input),
          after: checkCreation(affinity, after, input),
        },
        input,
        'freebies'
      )
    }
    expect(touch('sphereA')).toEqual({
      cause: 'locked',
      text: 'Esfera A: fica em 0 na criação (Afinidade: Esfera A).',
    })
    // A outra Esfera não é a da afinidade: compra normal
    expect(touch('sphereB')).toBeNull()
  })
})
