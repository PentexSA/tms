import {
  type CreationGroup,
  compileTemplate,
  effectiveCreationConfig,
} from '@tms/sheet-core'
import {
  completeLabel,
  counterSpoken,
  counterText,
  creationActive,
  creationInfoOf,
  creationRefusalOf,
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
