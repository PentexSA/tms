/// <reference types="bun-types" />
import { describe, expect, it } from 'bun:test'
import { validateSheet } from '../validate'
import { character, type Json, paths, templates, vtm } from './fixtures'

// Vampiro é o template da v0; os casos de D&D garantem que o validador não
// aprendeu nada específico de WoD (doc/arquitetura-motor-de-ficha.md §10.1).

const helena = () => character('helena')
const vtmTemplate = () => templates['vtm-v20']

describe('validateSheet: fail secure', () => {
  it.each([
    [null],
    [42],
    ['ficha'],
    [[]],
    [{}],
    [{ values: [] }],
    [{ values: null }],
  ])('recusa sheet_data malformado (%p)', sheet => {
    expect(validateSheet(vtmTemplate(), sheet)).toEqual([
      {
        path: '',
        message: 'sheet_data malformado (esperado { values, specialties })',
      },
    ])
  })

  it('__proto__ em values é rejeitado e não polui Object.prototype', () => {
    const sheet = JSON.parse('{"values":{"__proto__":{"polluted":true}}}')
    expect(validateSheet(vtmTemplate(), sheet)).toEqual([
      {
        path: 'values.__proto__',
        message: 'campo não existe no template (rejeitado)',
      },
    ])
    expect(({} as Json).polluted).toBeUndefined()
  })

  it.each(['constructor', 'toString', 'hasOwnProperty'])(
    'campo %p herdado de Object.prototype não existe no template',
    id => {
      expect(
        paths(validateSheet(vtmTemplate(), { values: { [id]: 1 } }))
      ).toEqual([`values.${id}`])
    }
  )

  it('meta em lista sem item.meta é rejeitado com mensagem própria', () => {
    const c = helena()
    const [first] = c.sheet.values.disciplines as Json[]
    if (first) first.meta = {}
    expect(validateSheet(vtmTemplate(), c.sheet)).toEqual([
      { path: 'values.disciplines.0.meta', message: 'lista sem meta' },
    ])
  })

  it('recurso nulo para no primeiro erro', () => {
    // A referência também acusa "valor malformado": o onlyKeys dela devolve
    // um valor truthy quando falha e segue lendo `null.current`.
    const c = helena()
    c.sheet.values.willpower = null
    expect(validateSheet(vtmTemplate(), c.sheet)).toEqual([
      { path: 'values.willpower', message: 'precisa ser objeto' },
    ])
  })

  it('template malformado nunca faz o validador lançar exceção', () => {
    const c = helena()
    const t = vtm()
    t.fields = { name: null, strength: { type: 'rating', max: 'cinco' } }
    t.markStates = 'x'
    expect(() => validateSheet(t, c.sheet)).not.toThrow()
    expect(validateSheet(t, c.sheet).length).toBeGreaterThan(0)
  })

  it('a mensagem nunca repete o valor enviado', () => {
    const secret = 'token-super-secreto'
    const c = helena()
    c.sheet.values.clan = secret
    c.sheet.values.name = secret.repeat(10)
    for (const issue of validateSheet(vtmTemplate(), c.sheet))
      expect(issue.message).not.toContain(secret)
  })
})

describe('validateSheet: regras do Vampiro (v0)', () => {
  it('Sangue respeita o máximo derivado da Geração (vtmBloodPool)', () => {
    const c = helena()
    c.sheet.values.generation = 13
    c.sheet.values.blood = { current: 11 }
    expect(validateSheet(vtmTemplate(), c.sheet)).toContainEqual({
      path: 'values.blood.current',
      message: 'acima do máximo (10)',
    })
    c.sheet.values.blood = { current: 10 }
    expect(validateSheet(vtmTemplate(), c.sheet)).toEqual([])
  })

  it('Vitalidade aceita dano até o número de níveis', () => {
    const c = helena()
    c.sheet.values.health = { aggravated: 1, lethal: 3, bashing: 3 }
    expect(validateSheet(vtmTemplate(), c.sheet)).toEqual([])
    c.sheet.values.health = { aggravated: 1, lethal: 3, bashing: 4 }
    expect(paths(validateSheet(vtmTemplate(), c.sheet))).toContain(
      'values.health'
    )
  })

  it('Notas do narrador seguem o limite de texto do template', () => {
    const c = helena()
    c.sheet.values.storytellerNotes = 'x'.repeat(4001)
    expect(paths(validateSheet(vtmTemplate(), c.sheet))).toEqual([
      'values.storytellerNotes',
    ])
  })
})

describe('validateSheet: fixture de outra família (D&D 5e)', () => {
  it('campos derivados nunca são gravados pelo cliente', () => {
    const c = character('lia')
    c.sheet.values.initiative = 3
    expect(validateSheet(templates['dnd5e-2014'], c.sheet)).toContainEqual({
      path: 'values.initiative',
      message: 'campo derivado: o servidor calcula, o cliente não grava',
    })
  })
})
