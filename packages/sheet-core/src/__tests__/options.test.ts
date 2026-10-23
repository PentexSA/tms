/// <reference types="bun-types" />
import { describe, expect, it } from 'bun:test'
import { compileTemplate } from '../compile'
import { effectiveChronicleOptions, validateChronicleOptions } from '../options'
import { templates } from './fixtures'

const template = structuredClone(templates['vtm-v20']!)
template.options = [
  {
    id: 'dramaticFailure',
    label: 'Falha dramática',
    type: 'boolean',
    default: false,
    effect: 'flag',
  },
  {
    id: 'tone',
    label: 'Tom',
    type: 'enum',
    default: 'dark',
    effect: 'choice',
    values: [
      { id: 'dark', label: 'Sombrio' },
      { id: 'heroic', label: 'Heroico' },
    ],
  },
  {
    id: 'limit',
    label: 'Limite',
    type: 'integer',
    default: 3,
    min: 1,
    max: 5,
    effect: 'bounded-number',
  },
]
const model = compileTemplate(template)

describe('opções da crônica', () => {
  it('calcula defaults e preserva somente o catálogo', () => {
    expect(effectiveChronicleOptions(model, { tone: 'heroic' })).toEqual({
      dramaticFailure: false,
      tone: 'heroic',
      limit: 3,
    })
  })

  it('recusa ids, tipos e valores fora do catálogo sem coerção', () => {
    const issues = validateChronicleOptions(model, {
      dramaticFailure: 'sim',
      tone: 'unknown',
      limit: 6,
      script: 'eval()',
    })
    expect(issues.map(issue => issue.path)).toEqual([
      'options.dramaticFailure',
      'options.tone',
      'options.limit',
      'options.script',
    ])
  })

  it('template sem catálogo aceita o objeto vazio e rejeita opção inventada', () => {
    const plain = compileTemplate(templates['vtm-v20']!)
    expect(validateChronicleOptions(plain, {})).toEqual([])
    expect(validateChronicleOptions(plain, { flag: true })).toHaveLength(1)
    expect(effectiveChronicleOptions(plain, {})).toEqual({})
  })
})
