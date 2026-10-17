/// <reference types="bun-types" />
import { describe, expect, it } from 'bun:test'
import { DERIVE } from '../derive'
import { isOneOf, REGISTRY, type Registry } from '../registry'
import { isSafeText } from '../validate'
import { FORBIDDEN_IDS } from '../validate/util'
import { clone, reference, schema } from './fixtures'

// REGISTRY → nome do `$defs` correspondente em design/templates/schema.json.
const SCHEMA_DEFS = {
  fieldTypes: 'fieldType',
  numberDisplays: 'numberDisplay',
  percentDisplays: 'percentDisplay',
  derive: 'deriveName',
  trackRules: 'trackRule',
  resourceRules: 'resourceRule',
  clockRules: 'clockRule',
  atZero: 'atZero',
  effects: 'effect',
  rollModels: 'rollModel',
  dice: 'die',
  diceNotation: 'diceNotation',
  boostEffects: 'boostEffect',
  specialtyRules: 'specialtyRule',
  colorRoles: 'colorRole',
  zones: 'zone',
  layouts: 'layout',
  filterRules: 'filterRule',
  modes: 'mode',
  roles: 'role',
  defaultActions: 'defaultAction',
  modifierOps: 'modifierOp',
  conditionRoll: 'conditionRoll',
  glyphs: 'glyphName',
  skins: 'skin',
  slotResets: 'slotReset',
} satisfies Record<keyof Registry, string>

describe('REGISTRY', () => {
  for (const [list, def] of Object.entries(SCHEMA_DEFS)) {
    it(`${list} é igual ao enum $defs.${def} de schema.json`, () => {
      expect<unknown[]>([...REGISTRY[list as keyof Registry]]).toEqual(
        schema.$defs[def]?.enum ?? []
      )
    })
  }

  it('é igual ao REGISTRY de design/scripts/validate.mjs', () => {
    expect<unknown>(clone(REGISTRY)).toEqual(reference.REGISTRY)
  })

  it('os ids proibidos são os mesmos de $defs.id em schema.json', () => {
    expect<unknown[]>([...FORBIDDEN_IDS]).toEqual(
      schema.$defs.id?.not?.enum ?? []
    )
  })

  it('isOneOf aceita valor desconhecido e rejeita o que está fora da lista', () => {
    expect(isOneOf(REGISTRY.layouts, 'grid')).toBe(true)
    expect(isOneOf(REGISTRY.layouts, 'constructor')).toBe(false)
    expect(isOneOf(REGISTRY.layouts, null)).toBe(false)
  })
})

describe('DERIVE', () => {
  it('implementa todos os nomes da lista fechada, e só eles', () => {
    expect(Object.keys(DERIVE)).toEqual([...REGISTRY.derive])
  })

  it.each([
    ['vtmBloodPool', [8], 15],
    ['vtmBloodPool', [13], 10],
    ['vtmBloodPool', [3], 10], // fora da tabela: mínimo da V20
    ['vtmBloodPerTurn', [4], 10],
    ['vtmBloodPerTurn', [12], 1],
    ['abilityModifier', [15], 2],
    ['abilityModifier', [8], -1],
    ['proficiencyBonus', [1], 2],
    ['proficiencyBonus', [5], 3],
    ['proficiencyBonus', [17], 6],
    ['dnd5eCheckBonus', [14, 2, 1], 4],
    ['cocHitPoints', [50, 60], 11],
    ['cocMagicPoints', [55], 11],
    ['cocSanityMax', [5], 94],
    ['half', [45], 22],
    ['fifth', [45], 9],
  ] as const)('%s(%p) = %p', (name, args, expected) => {
    expect(DERIVE[name](...args)).toBe(expected)
  })
})

describe('isSafeText', () => {
  it.each([
    ['Força de Vontade', true],
    ['linha 1\nlinha 2\tcom tab', true],
    ['🩸 Sangue', true],
    ['<b>negrito</b>', false],
    ['a > b', false],
    ['nul\u0000', false],
    ['del\u007f', false],
    ['c1\u0085', false],
    ['bidi\u202eTXT', false],
    ['isolado\u2066x\u2069', false],
    ['separador\u2028', false],
  ])('%p → %p', (text, expected) => {
    expect(isSafeText(text)).toBe(expected)
  })
})
