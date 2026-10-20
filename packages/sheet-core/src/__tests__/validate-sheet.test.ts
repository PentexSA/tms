/// <reference types="bun-types" />
import { describe, expect, it } from 'bun:test'
import { formatIssue, validateSheet } from '../validate'
import { character, type Json, mta, paths, templates, vtm } from './fixtures'

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
    // Sem o antecedente Geração, a 13ª
    c.sheet.values.backgrounds = []
    c.sheet.values.blood = { current: 11 }
    expect(validateSheet(vtmTemplate(), c.sheet)).toContainEqual({
      path: 'values.blood.current',
      message: 'acima do máximo (10)',
    })
    c.sheet.values.blood = { current: 10 }
    expect(validateSheet(vtmTemplate(), c.sheet)).toEqual([])
  })

  it('Geração é derivada: gravar o valor é recusado', () => {
    const c = helena()
    c.sheet.values.generation = 8
    expect(validateSheet(vtmTemplate(), c.sheet)).toContainEqual({
      path: 'values.generation',
      message: 'campo derivado: o servidor calcula, o cliente não grava',
    })
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

describe('validateSheet: regras do Mago (v1)', () => {
  it.each(['tomas', 'nadia', 'otto'])('a ficha de exemplo %s é válida', id => {
    expect(validateSheet(mta(), character(id).sheet)).toEqual([])
  })

  it('Esfera acima do Arete é aceita: o teto não é destrutivo', () => {
    const c = character('otto')
    expect(c.sheet.values.forces).toBeGreaterThan(
      c.sheet.values.arete as number
    )
    c.sheet.values.arete = 1
    expect(validateSheet(mta(), c.sheet)).toEqual([])
  })

  it('a roda não passa das 20 casas', () => {
    const c = character('otto')
    c.sheet.values.wheel = { quintessence: 6, paradox: 15 }
    expect(paths(validateSheet(mta(), c.sheet))).toEqual(['values.wheel'])
  })

  it('rotina só aceita nome e notas', () => {
    const c = character('otto')
    c.sheet.values.rotes = [{ id: 'r1', name: 'Escudo', value: 2 }]
    expect(paths(validateSheet(mta(), c.sheet))).toContain(
      'values.rotes.0.value'
    )
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

describe('validateSheet: ramos de forma e de teto', () => {
  const lia = () => character('lia')
  const dndTemplate = () => templates['dnd5e-2014']

  it('slots: não objeto, nível inexistente e nível malformado', () => {
    const c = lia()
    c.sheet.values.spellSlots = 'cheio'
    expect(validateSheet(dndTemplate(), c.sheet)).toEqual([
      { path: 'values.spellSlots', message: 'precisa ser objeto' },
    ])
    c.sheet.values.spellSlots = { '10': { max: 1, used: 0 }, '1': 4 }
    expect(validateSheet(dndTemplate(), c.sheet)).toEqual([
      { path: 'values.spellSlots.1', message: 'precisa ser objeto' },
      { path: 'values.spellSlots.10', message: 'nível inexistente' },
    ])
  })

  it('lista que não é lista', () => {
    const c = helena()
    c.sheet.values.disciplines = { d1: { name: 'Taumaturgia' } }
    expect(validateSheet(vtmTemplate(), c.sheet)).toEqual([
      { path: 'values.disciplines', message: 'precisa ser lista' },
    ])
  })

  it('tipo sem validador é rejeitado (template não validado)', () => {
    const t = { fields: { x: { type: 'formula', label: 'X' } } }
    expect(validateSheet(t, { values: { x: 1 } })).toEqual([
      { path: 'values.x', message: "tipo 'formula' sem validador (rejeitado)" },
    ])
  })

  it('exceção ao ler um valor vira erro do campo', () => {
    const c = helena()
    c.sheet.values.willpower = {
      get current(): number {
        throw new Error('getter hostil')
      },
    }
    expect(validateSheet(vtmTemplate(), c.sheet)).toContainEqual({
      path: 'values.willpower',
      message: 'valor malformado',
    })
  })

  it('exceção fora dos campos vira erro da ficha', () => {
    const sheet = {
      values: {},
      get specialties(): unknown {
        throw new Error('getter hostil')
      },
    }
    expect(validateSheet(vtmTemplate(), sheet)).toEqual([
      { path: '', message: 'sheet_data malformado' },
    ])
  })

  // Template mínimo: o teto de um resource vem de outro campo, que pode ser
  // derivado, gravado (permanente ou atual) ou só ter padrão.
  const capTemplate = (from: Json) => ({
    fields: {
      base: { type: 'number', label: 'Base', default: 8 },
      half: {
        type: 'number',
        label: 'Metade',
        readOnly: true,
        derive: 'half',
        from: 'base',
      },
      pool: {
        type: 'resource',
        label: 'Reserva',
        permanent: { min: 0, max: 20 },
      },
      r: { type: 'resource', label: 'R', max: from },
      free: { type: 'resource', label: 'Livre', temp: true },
    },
  })

  it.each([
    ['derivado (readOnly)', { field: 'half' }, {}, 4],
    ['padrão de outro campo', { field: 'base' }, {}, 8],
    [
      'permanente de outro resource',
      { field: 'pool' },
      { pool: { current: 3, permanent: 6 } },
      6,
    ],
    ['atual de outro resource', { field: 'pool' }, { pool: { current: 3 } }, 3],
  ])('teto pelo campo: %s', (_, max, values, cap) => {
    const t = capTemplate(max)
    const ok = validateSheet(t, { values: { ...values, r: { current: cap } } })
    expect(ok.filter(i => i.path.startsWith('values.r'))).toEqual([])
    const over = validateSheet(t, {
      values: { ...values, r: { current: cap + 1 } },
    })
    expect(over).toContainEqual({
      path: 'values.r.current',
      message: `acima do máximo (${cap})`,
    })
  })

  it('resource sem teto conhecido aceita qualquer atual até o limite técnico', () => {
    const t = capTemplate(undefined as unknown as Json)
    expect(
      validateSheet(t, { values: { free: { current: 9999, temp: 3 } } })
    ).toEqual([])
  })
})

describe('formatIssue', () => {
  it('sem caminho, usa só o prefixo', () => {
    expect(formatIssue('helena', { path: '', message: 'malformado' })).toBe(
      'helena: malformado'
    )
    expect(formatIssue('helena', { path: 'values.x', message: 'm' })).toBe(
      'helena values.x: m'
    )
  })
})
