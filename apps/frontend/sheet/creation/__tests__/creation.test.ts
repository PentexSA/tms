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
import { modelOf, templateJson } from '../../../test/fixtures'
import {
  addAdvice,
  addPreview,
  adviceNotices,
  basicsClosed,
  basicsDone,
  basicsSpentText,
  basicUnits,
  type CreationPhase,
  completeLabel,
  completionFreebies,
  counterSpoken,
  counterText,
  creationActive,
  creationInfoOf,
  creationRefusalOf,
  draftRefusal,
  freebieLedger,
  freebiesBalance,
  freebiesLeftNote,
  freebiesNotes,
  groupFor,
  pricedInCatalog,
  priceMeta,
  priorityNote,
  problemText,
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
  adjust: null,
  ready: null,
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

  it('Básicos, com tudo fechado (fase trocada à mão): o grupo cheio diz o orçamento e o preço', () => {
    expect(refusalOf(COMPLETE, { ...COMPLETE, str: 4 })).toEqual({
      cause: 'budget',
      text: 'Físicos: os 5 pontos básicos já foram usados. Para passar disso, use os pontos de bônus (5 por ponto).',
      action: 'budget',
    })
  })

  // P17 (N-04): os bônus só começam quando todos os grupos fecham
  it('Básicos, com outro grupo aberto: o texto diz quando os bônus começam', () => {
    const open = { ...COMPLETE, brawl: 1 }
    expect(refusalOf(open, { ...open, str: 4 })).toEqual({
      cause: 'budget',
      text: 'Físicos: os 5 pontos básicos já foram usados. Os pontos de bônus vêm depois que todos os grupos da ficha fecharem os pontos básicos (5 por ponto).',
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

  // T-08 (QAA-05): a Qualidade sem Custo não é "não se compra"
  it('Qualidade sem Custo: a recusa diz que falta o Custo, com a mesma causa', () => {
    const merits = [{ id: 'm1', name: 'Q' }]
    expect(
      refusalOf(COMPLETE, { ...COMPLETE, merits }, { phase: 'freebies' })
    ).toEqual({
      cause: 'not-purchasable',
      text: 'Qualidades: 1 item sem Custo. Abra o item e informe o Custo.',
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
    // P17 (N-04): com outro grupo aberto, o texto diz quando os bônus
    // começam
    expect(adviceOf({ ...COMPLETE, brawl: 1 }, 'values.str')).toMatchObject({
      blocked: 'budget',
      text: 'Físicos: os 5 pontos básicos já foram usados. Os pontos de bônus vêm depois que todos os grupos da ficha fecharem os pontos básicos (5 por ponto).',
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
    }) as unknown as Parameters<typeof freebiesBalance>[0]

  it('a sobra na confirmação: nada com 0, singular com 1, plural com N', () => {
    expect(freebiesLeftNote(0)).toBeNull()
    expect(freebiesLeftNote(-2)).toBeNull()
    expect(freebiesLeftNote(null)).toBeNull()
    expect(freebiesLeftNote(1)).toBe('Sobra 1 ponto de bônus. Ele não vira XP.')
    expect(freebiesLeftNote(4)).toBe(
      'Sobram 4 pontos de bônus. Eles não viram XP.'
    )
  })

  it('a sobra só vale com a conta fechada (achado do /code-review)', () => {
    type Check = Parameters<typeof completionFreebies>[0]
    const done = { ...left(4), complete: true } as Check
    expect(completionFreebies(done)).toBe(4)
    // Com básicos faltando, o servidor recusa concluir: nada de "Sobram 15"
    expect(
      completionFreebies({ ...left(15), complete: false } as Check)
    ).toBeNull()
    expect(completionFreebies(null)).toBeNull()
  })

  it('as linhas da confirmação: uma com sobra, nenhuma sem conta ou sem sobra', () => {
    expect(freebiesNotes(4)).toEqual([
      'Sobram 4 pontos de bônus. Eles não viram XP.',
    ])
    expect(freebiesNotes(null)).toEqual([])
    expect(freebiesNotes(0)).toEqual([])
    // A mesma referência vazia: a confirmação não re-renderiza à toa
    expect(freebiesNotes(null)).toBe(freebiesNotes(0))
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

// P07-D (T-08): a Qualidade gravada sem Custo não é "não se compra"; o
// Renome, que de fato não se compra, segue com a frase de antes
const WOD_PRIORITIES: CreationChoices = {
  priorities: {
    attributes: ['physical', 'social', 'mental'],
    abilities: ['talents', 'skills', 'knowledges'],
  },
}

describe('problemText: a Qualidade sem Custo', () => {
  const vtm = modelOf('vtm-v20')
  const wta = modelOf('wta-w20')
  const input = (m: SheetModel) => ({
    config: effectiveCreationConfig(m),
    choices: WOD_PRIORITIES,
  })

  const merits = (items: unknown[]) =>
    ({ values: { merits: items } }) as SheetData
  const textOf = (sheet: SheetData, withSheet = true) => {
    const check = checkCreation(vtm, sheet, input(vtm))
    const p = check.problems.find(x => x.code === 'CREATION_NOT_PURCHASABLE')
    if (!p) throw new Error('sem o problema')
    return problemText(
      vtm,
      check,
      p,
      withSheet ? resolve(vtm, sheet) : undefined
    )
  }

  it('conta os itens e separa "sem Custo" de "Custo inválido" (code review)', () => {
    expect(textOf(merits([{ id: 'm1', name: 'A' }]))).toBe(
      'Qualidades: 1 item sem Custo. Abra o item e informe o Custo.'
    )
    expect(
      textOf(
        merits([
          { id: 'm1', name: 'A' },
          { id: 'm2', name: 'B' },
        ])
      )
    ).toBe('Qualidades: 2 itens sem Custo. Abra cada item e informe o Custo.')
    expect(textOf(merits([{ id: 'm1', name: 'A', meta: { cost: 0 } }]))).toBe(
      'Qualidades: 1 item com Custo inválido. Abra o item e corrija o Custo.'
    )
    // Os dois casos juntos, ou sem a ficha: "sem Custo válido"
    const both = merits([
      { id: 'm1', name: 'A' },
      { id: 'm2', name: 'B', meta: { cost: 0 } },
    ])
    expect(textOf(both)).toBe(
      'Qualidades: 2 itens sem Custo válido. Abra cada item e informe o Custo.'
    )
    expect(textOf(merits([{ id: 'm1', name: 'A' }]), false)).toBe(
      'Qualidades: 1 item sem Custo válido. Abra o item e informe o Custo.'
    )
  })

  it('Renome acima do inicial: "não se compra na criação", como antes', () => {
    const sheet = {
      values: { glory: { permanent: 2, current: 2 } },
    } as SheetData
    const check = checkCreation(wta, sheet, input(wta))
    const p = check.problems.find(x => x.code === 'CREATION_NOT_PURCHASABLE')
    expect(p).toBeDefined()
    if (p) expect(problemText(wta, check, p)).toMatch(/não se compra/)
  })
})

describe('addAdvice: a prévia do item novo', () => {
  const vtm = modelOf('vtm-v20')
  const input = {
    config: effectiveCreationConfig(vtm),
    choices: WOD_PRIORITIES,
  }
  const at = (values: Record<string, unknown>) =>
    checkCreation(vtm, { values } as SheetData, input)
  const one = (n: string) => [{ id: n, name: n, value: 1 }]

  it('Disciplinas com básicos: entra com os pontos básicos', () => {
    expect(addAdvice(vtm, at({}), 'basics', 'disciplines')).toBe(
      'Entra com os pontos básicos (faltam 3 de 3).'
    )
  })

  it('grupo cheio: em Pontos básicos, o motivo; em bônus, o preço e o saldo', () => {
    const full = at({
      disciplines: [...one('a'), ...one('b'), ...one('c')],
    })
    expect(addAdvice(vtm, full, 'basics', 'disciplines')).toMatch(
      /Disciplinas: os 3 pontos básicos já foram usados/
    )
    expect(addAdvice(vtm, full, 'freebies', 'disciplines')).toBe(
      '+1 = 7 bônus; restam 15.'
    )
  })

  it('Qualidade: o Custo do item em bônus; Defeito: o crédito até 7', () => {
    expect(addAdvice(vtm, at({}), 'basics', 'merits')).toBe(
      'Custa o Custo do item em bônus (começa em 1); restam 15.'
    )
    expect(addAdvice(vtm, at({}), 'basics', 'flaws')).toBe(
      'Devolve o Bônus do item, até 7 no total.'
    )
  })

  it('lista fora de qualquer conta: nada', () => {
    expect(addAdvice(vtm, at({}), 'basics', 'naoExiste')).toBeNull()
  })

  it('com o Custo no catálogo, a prévia não promete o mínimo (code review)', () => {
    const t = templateJson('vtm-v20')
    const fields = t.fields as Record<string, Record<string, unknown>>
    if (fields.merits) {
      fields.merits.catalog = ['Qualidade A']
      fields.merits.catalogDefaults = [
        { meta: 'cost', value: 3, items: ['Qualidade A'] },
      ]
    }
    const m = compileTemplate(t)
    const check = checkCreation(m, { values: {} } as SheetData, {
      config: effectiveCreationConfig(m),
      choices: WOD_PRIORITIES,
    })
    expect(addAdvice(m, check, 'basics', 'merits')).toBe(
      'Custa o Custo do item em bônus (o de cada opção); restam 15.'
    )
  })
})

describe('adviceNotices: duas regras na mesma lista (code review)', () => {
  it('a chave e o texto vêm da regra de cada aviso', () => {
    const t = templateJson('wta-w20')
    const gifts = (t.fields as Record<string, Record<string, unknown>>)
      .gifts as { item: { meta: unknown[] } }
    gifts.item.meta.push({
      id: 'cost',
      type: 'number',
      label: 'Custo',
      min: 0,
      max: 5,
    })
    ;(t.creation as Record<string, unknown>).advice = [
      { rule: 'item-meta-max', targets: ['gifts'], meta: 'rank', max: 1 },
      { rule: 'item-meta-max', targets: ['gifts'], meta: 'cost', max: 2 },
    ]
    const m = compileTemplate(t)
    const notices = adviceNotices(m, [
      {
        code: 'ADVICE_ABOVE_LEVEL',
        field: 'gifts',
        paths: ['x'],
        amount: 1,
        rule: 0,
      },
      {
        code: 'ADVICE_ABOVE_LEVEL',
        field: 'gifts',
        paths: ['x'],
        amount: 1,
        rule: 1,
      },
    ])
    expect(notices.map(n => n.key)).toEqual([
      'ADVICE_ABOVE_LEVEL:gifts:0',
      'ADVICE_ABOVE_LEVEL:gifts:1',
    ])
    expect(notices.map(n => n.text)).toEqual([
      'Dons: 1 com Posto acima de 1.',
      'Dons: 1 com Custo acima de 2.',
    ])
  })
})

// T-85: o "−" no valor inicial. A previsão diz de onde vem o inicial, o toque
// que desce é recusado só no app, e o texto do problema diz o número.
describe('o "−" no valor inicial (T-85)', () => {
  const WOD: CreationChoices = {
    priorities: {
      attributes: ['physical', 'social', 'mental'],
      abilities: ['talents', 'skills', 'knowledges'],
    },
  }
  const w20 = modelOf('wta-w20')
  const v20 = modelOf('vtm-v20')
  const m20 = modelOf('mta-m20')
  const AHROUN = {
    name: 'Lupa',
    breed: 'lupino',
    auspice: 'ahroun',
    tribe: 'fianna',
  }
  const checkOf = (m: SheetModel, values: Record<string, unknown>) =>
    checkCreation(
      m,
      { values },
      { config: effectiveCreationConfig(m), choices: WOD }
    )
  const down = (m: SheetModel, values: Record<string, unknown>, path: string) =>
    stepAdvice(
      m,
      checkOf(m, values),
      'freebies',
      path,
      resolve(m, { values }),
      'down'
    )

  it('Ahroun em 5: o "−" da Fúria trava e diz o Augúrio; em 6, livre', () => {
    expect(down(w20, AHROUN, 'values.rage')).toEqual({
      blocked: 'initial',
      text: 'Na criação, não fica abaixo de 5 (vem de Augúrio: Ahroun).',
      cost: null,
      inline: false,
    })
    expect(
      down(
        w20,
        { ...AHROUN, rage: { permanent: 6, current: 6 } },
        'values.rage'
      )
      // em 6, livre; segurar para no 5 (o floor)
    ).toEqual({
      blocked: null,
      text: null,
      cost: null,
      inline: false,
      floor: 5,
    })
    // o "+" continua com a previsão de sempre
    expect(
      stepAdvice(w20, checkOf(w20, AHROUN), 'freebies', 'values.rage')
    ).not.toMatchObject({ blocked: 'initial' })
  })

  it('V20: a FdV na Coragem diz a Coragem; M20: a FdV fixa, sem origem', () => {
    expect(
      down(v20, { name: 'A', clan: 'brujah', courage: 3 }, 'values.willpower')
    ).toMatchObject({
      blocked: 'initial',
      text: 'Na criação, não fica abaixo de 3 (vem de Coragem).',
    })
    expect(down(m20, { name: 'C' }, 'values.willpower')).toMatchObject({
      blocked: 'initial',
      text: 'Na criação, não fica abaixo de 5.',
    })
  })

  it('no mínimo do campo ou com baseline travado, nada a prever', () => {
    // Coragem 1: a FdV 1 já é o mínimo do template
    expect(
      down(v20, { name: 'A', clan: 'brujah', courage: 1 }, 'values.willpower')
    ).toBeNull()
    // Nosferatu: a Aparência 0 é baseline travado
    expect(
      down(v20, { name: 'A', clan: 'nosferatu' }, 'values.appearance')
    ).toBeNull()
    // fora da conta
    expect(down(v20, { name: 'A' }, 'values.name')).toBeNull()
  })

  const refuse = (
    m: SheetModel,
    before: Record<string, unknown>,
    after: Record<string, unknown>,
    paths: string[],
    phase: CreationPhase = 'freebies'
  ) => {
    const input = { config: effectiveCreationConfig(m), choices: WOD }
    const sheets = {
      before: { values: before } as SheetData,
      after: { values: after } as SheetData,
    }
    return draftRefusal(
      m,
      sheets,
      {
        before: checkCreation(m, sheets.before, input),
        after: checkCreation(m, sheets.after, input),
      },
      input,
      phase,
      { paths }
    )
  }

  it('o toque que desce abaixo do inicial é recusado, com o número e a origem', () => {
    const lower = { ...AHROUN, rage: { permanent: 4, current: 4 } }
    expect(refuse(w20, AHROUN, lower, ['values.rage'])).toEqual({
      cause: 'initial',
      text: 'Fúria: na criação, não fica abaixo de 5 (vem de Augúrio: Ahroun).',
    })
    // nas duas fases: em Básicos também
    expect(refuse(w20, AHROUN, lower, ['values.rage'], 'basics')?.cause).toBe(
      'initial'
    )
  })

  it('o problema que nasce noutro caminho não é recusado', () => {
    const v = { name: 'A', clan: 'brujah', courage: 2 }
    const bought = { ...v, willpower: { permanent: 3, current: 3 } }
    // a Coragem sobe e a FdV comprada fica abaixo do inicial novo
    expect(
      refuse(v20, bought, { ...bought, courage: 4 }, ['values.courage'])
    ).toBeNull()
    // trocar o Augúrio também não
    const four = { permanent: 4, current: 4 }
    expect(
      refuse(
        w20,
        { ...AHROUN, auspice: 'galliard', rage: four },
        { ...AHROUN, rage: four },
        ['values.auspice']
      )
    ).toBeNull()
    // sem os caminhos do toque (quem chama sem eles), o de antes
    expect(refuse(w20, AHROUN, { ...AHROUN, rage: four }, [])).toBeNull()
  })

  it('o texto do problema diz o número e, com a ficha, a opção', () => {
    const values = { ...AHROUN, rage: { permanent: 4, current: 4 } }
    const check = checkOf(w20, values)
    const p = check.problems.find(x => x.code === 'CREATION_BELOW_INITIAL')
    if (!p) throw new Error('sem o problema')
    expect(problemText(w20, check, p, resolve(w20, { values }))).toBe(
      'Fúria: abaixo de 5, o valor inicial (vem de Augúrio: Ahroun).'
    )
    expect(problemText(w20, check, p)).toBe(
      'Fúria: abaixo de 5, o valor inicial (vem de Augúrio).'
    )
    expect(problemText(w20, null, p)).toBe('Fúria: abaixo do valor inicial.')
  })
})

// Achados 2 e 4 do /code-review: a previsão do "−" e a recusa concordam no
// baseline travado, e o "(vem de …)" cita a origem certa do inicial (o
// baseline que vale, não a fórmula do campo). Template de teste: o V20 com
// dois baselines na FdV, que tem fórmula (Coragem).
describe('o "−" no inicial: baseline e origem (achados 2 e 4)', () => {
  const WOD: CreationChoices = {
    priorities: {
      attributes: ['physical', 'social', 'mental'],
      abilities: ['talents', 'skills', 'knowledges'],
    },
  }
  const t = JSON.parse(JSON.stringify(templateJson('vtm-v20')))
  t.creation.baselines = [
    ...t.creation.baselines,
    {
      targets: ['willpower'],
      value: 4,
      locked: true,
      when: { field: 'clan', in: ['ventrue'] },
    },
    {
      targets: ['willpower'],
      value: 3,
      when: { field: 'clan', in: ['brujah'] },
    },
  ]
  const m = compileTemplate(t)
  const input = { config: effectiveCreationConfig(m), choices: WOD }
  const checkOf = (values: Record<string, unknown>) =>
    checkCreation(m, { values }, input)
  const down = (values: Record<string, unknown>) =>
    stepAdvice(
      m,
      checkOf(values),
      'freebies',
      'values.willpower',
      resolve(m, { values }),
      'down'
    )
  const refuse = (
    before: Record<string, unknown>,
    after: Record<string, unknown>
  ) => {
    const sheets = {
      before: { values: before } as SheetData,
      after: { values: after } as SheetData,
    }
    return draftRefusal(
      m,
      sheets,
      {
        before: checkCreation(m, sheets.before, input),
        after: checkCreation(m, sheets.after, input),
      },
      input,
      'freebies',
      { paths: ['values.willpower'] }
    )
  }

  it('baseline travado acima do mínimo: a previsão e a recusa dizem o mesmo', () => {
    const v = {
      name: 'V',
      clan: 'ventrue',
      courage: 1,
      willpower: { permanent: 4, current: 4 },
    }
    expect(down(v)).toMatchObject({
      blocked: 'locked',
      text: 'Fica em 4 na criação (Clã: Ventrue).',
    })
    expect(
      refuse(v, { ...v, willpower: { permanent: 3, current: 3 } })
    ).toEqual({
      cause: 'locked',
      text: 'Força de Vontade: fica em 4 na criação (Clã: Ventrue).',
    })
  })

  it('o inicial do baseline cita a escolha dele, não a fórmula', () => {
    // Coragem 1, mas o inicial é o 3 do baseline do Brujah
    const v = { name: 'B', clan: 'brujah', courage: 1 }
    expect(down(v)).toMatchObject({
      blocked: 'initial',
      text: 'Na criação, não fica abaixo de 3 (vem de Clã: Brujah).',
    })
    const lower = { ...v, willpower: { permanent: 2, current: 2 } }
    const check = checkOf(lower)
    const p = check.problems.find(x => x.code === 'CREATION_BELOW_INITIAL')
    if (!p) throw new Error('sem o problema')
    expect(problemText(m, check, p, resolve(m, { values: lower }))).toBe(
      'Força de Vontade: abaixo de 3, o valor inicial (vem de Clã: Brujah).'
    )
    // Sem a ficha, não dá para saber qual baseline vale: sem "vem de"
    expect(problemText(m, check, p)).toBe(
      'Força de Vontade: abaixo de 3, o valor inicial.'
    )
  })

  it('baseline sem condição ou base de point-buy: sem "vem de"', () => {
    const plain = JSON.parse(JSON.stringify(templateJson('vtm-v20')))
    plain.creation.baselines = [{ targets: ['willpower'], value: 2 }]
    const pm = compileTemplate(plain)
    const values = { name: 'P', clan: 'brujah', courage: 1 }
    expect(
      stepAdvice(
        pm,
        checkCreation(
          pm,
          { values },
          {
            config: effectiveCreationConfig(pm),
            choices: WOD,
          }
        ),
        'freebies',
        'values.willpower',
        resolve(pm, { values }),
        'down'
      )
    ).toMatchObject({ text: 'Na criação, não fica abaixo de 2.' })
    const dnd = modelOf('dnd5e-2014')
    const at = dnd.template.creation?.budgets.find(b => b.rule === 'point-buy')
    if (!at || at.rule !== 'point-buy') throw new Error('sem point-buy')
    const id = at.targets[0] as string
    const check = checkCreation(
      dnd,
      { values: { name: 'D', [id]: at.base - 1 } },
      { config: effectiveCreationConfig(dnd), choices: {} }
    )
    const p = check.problems.find(x => x.code === 'CREATION_BELOW_INITIAL')
    if (p)
      expect(
        problemText(dnd, check, p, resolve(dnd, { values: {} }))
      ).not.toContain('vem de')
  })
})

// P05-D (/code-review 8): a fase em texto e a folha de bônus usam a mesma
// regra dos básicos; o `basicsDone` só soma o saldo de bônus
describe('basicsClosed × basicsDone', () => {
  const vtm = modelOf('vtm-v20')
  const input = {
    config: effectiveCreationConfig(vtm),
    choices: {
      priorities: {
        attributes: ['physical', 'social', 'mental'],
        abilities: ['talents', 'skills', 'knowledges'],
      },
    },
  }
  it('sem prioridade ou com básico sobrando, nenhum dos dois', () => {
    const open = checkCreation(vtm, { values: {}, specialties: {} }, input)
    expect(basicsClosed(open)).toBe(false)
    expect(basicsDone(open)).toBe(false)
    expect(basicsClosed(null)).toBe(false)
  })
  it('básicos fechados: os dois; sem saldo de bônus, só o basicsClosed', () => {
    const closed = {
      ...checkCreation(vtm, { values: {}, specialties: {} }, input),
      budgets: [
        {
          id: 'b',
          label: 'B',
          rule: 'fixed-budget' as const,
          priorities: null,
          groups: [
            {
              id: 'g',
              label: 'G',
              budget: 3,
              measure: 'points' as const,
              invested: 3,
              eligible: 3,
              basic: 3,
              missing: 0,
              extra: 0,
              price: 1,
              freebieCost: 0,
              components: [],
            },
          ],
        },
      ],
      freebies: { available: 15, credit: 0, spent: 0, remaining: 15 },
    }
    expect(basicsClosed(closed)).toBe(true)
    expect(basicsDone(closed)).toBe(true)
    const spent = {
      ...closed,
      freebies: { available: 15, credit: 0, spent: 15, remaining: 0 },
    }
    expect(basicsClosed(spent)).toBe(true)
    expect(basicsDone(spent)).toBe(false)
  })
})

// B2 (roteiro do Android): o adjetivo concorda com o número
describe('"falta 1 ponto básico" (B2)', () => {
  const vtm = modelOf('vtm-v20')
  const wta = modelOf('wta-w20')
  const checkOf = (model: SheetModel) =>
    checkCreation(
      model,
      { values: {}, specialties: {} },
      {
        config: effectiveCreationConfig(model),
        choices: {
          priorities: {
            attributes: ['physical', 'social', 'mental'],
            abilities: ['talents', 'skills', 'knowledges'],
          },
        },
      }
    )
  it('basicUnits: singular e plural, em pontos ou itens', () => {
    expect(basicUnits(1)).toBe('1 ponto básico')
    expect(basicUnits(3)).toBe('3 pontos básicos')
    expect(basicUnits(1, true)).toBe('1 item básico')
    expect(basicUnits(3, true)).toBe('3 itens básicos')
  })
  it('o "O que falta" com 1 e com N, e os Dons em itens', () => {
    const check = checkOf(vtm)
    const unspent = (amount: number) => ({
      code: 'CREATION_BASICS_UNSPENT' as const,
      severity: 'incomplete' as const,
      budget: 'virtues',
      group: 'virtues',
      paths: [],
      amount,
    })
    expect(problemText(vtm, check, unspent(1))).toBe(
      'Virtudes: falta 1 ponto básico.'
    )
    expect(problemText(vtm, check, unspent(7))).toBe(
      'Virtudes: faltam 7 pontos básicos.'
    )
    expect(
      problemText(wta, checkOf(wta), {
        ...unspent(3),
        budget: 'gifts',
        group: 'gifts',
      })
    ).toBe('Dons: faltam 3 itens básicos.')
  })
  it('o contador falado e a recusa com orçamento 1 ficam no singular', () => {
    const g = {
      id: 'g',
      label: 'Fé',
      budget: 1,
      measure: 'points' as const,
      invested: 1,
      eligible: 1,
      basic: 1,
      missing: 0,
      extra: 0,
      price: null,
      freebieCost: 0,
      components: [],
    }
    expect(counterSpoken(g)).toBe('Fé: 1 de 1 ponto básico')
    expect(basicsSpentText(g, false)).toBe('Fé: o 1 ponto básico já foi usado.')
    expect(basicsSpentText({ ...g, budget: 3 }, false)).toBe(
      'Fé: os 3 pontos básicos já foram usados.'
    )
  })

  // P17 (N-04): na fase dos básicos, o bônus só vem quando todos os grupos
  // fecham; com todos fechados (a fase trocada à mão), o texto antigo
  it('com bônus, o texto diz quando eles começam; com tudo fechado, como usar', () => {
    const g = {
      id: 'knowledges',
      label: 'Conhecimentos',
      budget: 5,
      measure: 'points' as const,
      invested: 5,
      eligible: 5,
      basic: 5,
      missing: 0,
      extra: 0,
      price: 2,
      freebieCost: 0,
      components: [],
    }
    expect(basicsSpentText(g, true)).toBe(
      'Conhecimentos: os 5 pontos básicos já foram usados. Os pontos de bônus vêm depois que todos os grupos da ficha fecharem os pontos básicos (2 por ponto).'
    )
    expect(basicsSpentText(g, true, true)).toBe(
      'Conhecimentos: os 5 pontos básicos já foram usados. Para passar disso, use os pontos de bônus (2 por ponto).'
    )
    expect(basicsSpentText({ ...g, price: null }, true)).toBe(
      'Conhecimentos: os 5 pontos básicos já foram usados.'
    )
  })
})

// P17 (N-08): a prévia da inclusão de uma Qualidade ou de um Defeito com o
// custo escolhido, pela conta inteira (antes e depois)
describe('addPreview', () => {
  const vtm = modelOf('vtm-v20')
  const input = (mode: 'points' | 'free' = 'points') => ({
    config: { ...effectiveCreationConfig(vtm), mode },
    choices: {},
  })
  const sheet = (values: Record<string, unknown>): SheetData => ({
    values: { name: 'Nova', clan: 'tremere', ...values },
    specialties: {},
  })
  const merit = (cost: number) => ({ id: 'n', name: 'Nova', meta: { cost } })
  const flaw = (bonus: number) => ({ id: 'n', name: 'Nova', meta: { bonus } })
  const merits = (...costs: number[]) =>
    costs.map((cost, i) => ({ id: `m${i}`, name: `Q${i}`, meta: { cost } }))
  const flaws = (...bonus: number[]) =>
    bonus.map((b, i) => ({ id: `f${i}`, name: `D${i}`, meta: { bonus: b } }))

  it('o meta de preço: o Custo na Qualidade, o Bônus no Defeito; Disciplinas não têm', () => {
    expect(priceMeta(vtm, 'merits')).toMatchObject({
      id: 'cost',
      label: 'Custo',
      min: 1,
    })
    expect(priceMeta(vtm, 'flaws')).toMatchObject({ id: 'bonus', min: 1 })
    expect(priceMeta(vtm, 'disciplines')).toBeNull()
    expect(pricedInCatalog(vtm, 'merits', 'cost', 'Nome inventado')).toBe(false)
  })

  it('Qualidade de 5 com saldo 8: custa 5, restam 3', () => {
    expect(
      addPreview(vtm, sheet({ merits: merits(7) }), input(), 'merits', merit(5))
    ).toEqual({ text: 'Custa 5 de bônus; restam 3.', short: false })
  })

  it('Qualidade de 5 com saldo 3: faltariam 2', () => {
    expect(
      addPreview(
        vtm,
        sheet({ merits: merits(7, 5) }),
        input(),
        'merits',
        merit(5)
      )
    ).toEqual({
      text: 'Faltariam 2 de bônus: custa 5, restam 3.',
      short: true,
    })
  })

  it('Defeito de 3: devolve 3; com o crédito em 6, só 1; em 7, nada', () => {
    expect(addPreview(vtm, sheet({}), input(), 'flaws', flaw(3))).toEqual({
      text: 'Devolve 3 de bônus.',
      short: false,
    })
    expect(
      addPreview(vtm, sheet({ flaws: flaws(6) }), input(), 'flaws', flaw(3))
    ).toEqual({
      text: 'Devolve só 1 de bônus: o crédito chega a 7.',
      short: false,
    })
    expect(
      addPreview(vtm, sheet({ flaws: flaws(4, 3) }), input(), 'flaws', flaw(3))
    ).toEqual({
      text: 'Não devolve bônus: o crédito já está em 7.',
      short: false,
    })
  })

  it('sem conta de bônus (criação livre) ou lista sem preço: null', () => {
    expect(
      addPreview(vtm, sheet({}), input('free'), 'merits', merit(3))
    ).toBeNull()
    expect(
      addPreview(vtm, sheet({}), input(), 'disciplines', {
        id: 'd',
        name: 'Taumaturgia',
        value: 1,
      })
    ).toBeNull()
  })
})
