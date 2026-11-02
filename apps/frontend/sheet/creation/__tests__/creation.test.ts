import {
  type CreationChoices,
  type CreationGroup,
  checkCreation,
  compileTemplate,
  effectiveCreationConfig,
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
  groupFor,
  reorder,
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
