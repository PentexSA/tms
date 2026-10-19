/// <reference types="bun-types" />
import { describe, expect, it } from 'bun:test'
import { compileTemplate } from '../compile'
import {
  type ResolvedField,
  type ResolvedNumber,
  type ResolvedRating,
  type ResolvedResource,
  type ResolvedStacking,
  resolve,
} from '../resolve'
import { character, clone, type Json, templates } from './fixtures'

const vtmModel = compileTemplate(templates['vtm-v20'])
const healthDef = vtmModel.fields.get('health')?.def
const levels =
  healthDef?.type === 'track' ? (healthDef.levels ?? []).map(l => l.label) : []

function field<T extends ResolvedField>(
  sheet: { values: Json },
  id: string,
  model = vtmModel
): T {
  const f = resolve(model, sheet).get(id)
  if (!f) throw new Error(`campo ausente: ${id}`)
  return f as T
}

describe('resolve: as fichas de Vampiro', () => {
  it.each([
    ['helena', 8, 15, 3],
    ['caio', 10, 13, 1],
    ['marta', 9, 14, 2],
    ['beto', 11, 12, 1],
  ])(
    '%s: Sangue pela Geração %i (máx. %i, %i por turno)',
    (id, gen, max, perTurn) => {
      const c = character(id)
      // A Geração sai do antecedente (13 menos os pontos)
      expect(field<ResolvedNumber>(c.sheet, 'generation').value).toBe(gen)
      const blood = field<ResolvedResource>(c.sheet, 'blood')
      expect(blood.max).toBe(max)
      expect(blood.cap).toBe(max)
      expect(blood.perTurn).toBe(perTurn)
      expect(blood.current).toBe(
        (c.sheet.values.blood as Json).current as number
      )
    }
  )

  it('Geração: sem o antecedente, 13ª; acima de 5 pontos, para na 8ª', () => {
    const c = clone(character('caio'))
    const generation = () => field<ResolvedNumber>(c.sheet, 'generation').value
    c.sheet.values.backgrounds = []
    expect(generation()).toBe(13)
    c.sheet.values.backgrounds = [{ id: 'b1', name: 'Geração', value: 9 }]
    expect(generation()).toBe(8)
    expect(field<ResolvedResource>(c.sheet, 'blood').max).toBe(15)
  })

  it('Força de Vontade: o permanente limita o atual', () => {
    const fdv = field<ResolvedResource>(character('helena').sheet, 'willpower')
    expect(fdv).toMatchObject({ current: 5, permanent: 7, cap: 7, shownMax: 7 })
  })

  it.each([
    ['helena', 2, 1, -1],
    ['caio', 3, 2, -1],
    ['beto', 3, 2, -1],
    ['marta', 0, null, 0],
  ] as const)(
    '%s: Vitalidade com %i níveis de dano (nível %p, penalidade %i)',
    (id, filled, index, penalty) => {
      const health = field<ResolvedStacking>(character(id).sheet, 'health')
      expect(health.filled).toBe(filled)
      expect(health.level?.label ?? null).toBe(
        index === null ? null : (levels[index] ?? 'nível inexistente')
      )
      expect(health.penalty).toBe(penalty)
      expect(health.incapacitated).toBe(false)
    }
  )

  it('Vitalidade cheia: incapacitado e sem penalidade numérica', () => {
    const c = character('helena')
    c.sheet.values.health = { aggravated: 2, lethal: 5, bashing: 0 }
    const health = field<ResolvedStacking>(c.sheet, 'health')
    expect(health.level?.label).toBe(levels[6])
    expect(health.penalty).toBeNull()
    expect(health.incapacitated).toBe(true)
  })

  it('atributo guardado e habilidade ausente (vale o mínimo)', () => {
    const c = character('helena')
    delete c.sheet.values.athletics
    expect(field<ResolvedRating>(c.sheet, 'strength').value).toBe(2)
    expect(field<ResolvedRating>(c.sheet, 'athletics').value).toBe(0)
  })

  it('ficha nova: tudo no padrão do tipo', () => {
    const r = resolve(vtmModel, { values: {} })
    expect(r.number('strength')).toBe(1) // atributos começam em 1 (min)
    expect(r.number('athletics')).toBe(0)
    const blood = r.get('blood') as ResolvedResource
    // Ficha nova nasce na 13ª geração (default do template): 10 de Sangue.
    expect(r.number('generation')).toBe(13)
    expect(blood.max).toBe(10)
    expect(blood.current).toBe(10) // recurso começa cheio
    const fdv = r.get('willpower') as ResolvedResource
    expect(fdv).toMatchObject({ current: 1, permanent: 1 })
    expect((r.get('health') as ResolvedStacking).filled).toBe(0)
    expect(r.get('name')).toMatchObject({ value: '' })
    expect(r.get('clan')).toMatchObject({ value: null, option: null })
    expect(r.get('disciplines')).toMatchObject({ items: [] })
  })

  it('a escolha mostra a opção do template', () => {
    expect(field(character('helena').sheet, 'clan')).toMatchObject({
      value: 'tremere',
      option: { id: 'tremere' },
    })
  })

  it('lista e texto devolvem o que está guardado', () => {
    const c = character('helena')
    const disciplines = field(c.sheet, 'disciplines') as unknown as {
      items: Json[]
    }
    expect(disciplines.items).toEqual(c.sheet.values.disciplines as Json[])
  })

  it('valor malformado vale o padrão, nunca lança exceção', () => {
    const r = resolve(vtmModel, {
      values: {
        strength: '5',
        blood: 'cheio',
        health: null,
        disciplines: 'x',
        clan: 'admin',
      },
    })
    expect(r.number('strength')).toBe(1)
    expect((r.get('health') as ResolvedStacking).filled).toBe(0)
    expect(r.get('disciplines')).toMatchObject({ items: [] })
    expect(r.get('clan')).toMatchObject({ value: null })
  })

  it('percorre todos os campos na ordem do template', () => {
    const r = resolve(vtmModel, character('helena').sheet)
    expect(r.fields.map(f => f.id)).toEqual([...vtmModel.fields.keys()])
  })
})

describe('resolve: outros sistemas (o código não sabe de Vampiro)', () => {
  it('D&D: derivados readOnly e score+mod', () => {
    const model = compileTemplate(templates['dnd5e-2014'])
    const r = resolve(model, character('lia').sheet)
    expect(r.number('proficiencyBonus')).toBe(3) // nível 5
    expect(r.number('initiative')).toBe(2) // Des 14
    expect(r.get('str')).toMatchObject({ value: 8, mod: -1, derived: false })
    expect(r.get('initiative')).toMatchObject({ derived: true, mod: null })
  })

  it('o número de um resource é o permanente ou, sem ele, o atual', () => {
    const t = clone(templates['dnd5e-2014'] as Json)
    ;(t.fields as Record<string, Json>).halfHp = {
      type: 'number',
      label: 'Metade dos PV',
      readOnly: true,
      derive: 'half',
      from: 'hp',
    }
    const r = resolve(compileTemplate(t), character('lia').sheet)
    expect(r.number('halfHp')).toBe(13) // PV atual 27, sem permanente
    expect(
      resolve(vtmModel, character('helena').sheet).number('willpower')
    ).toBe(7)
  })

  it('derivar de um campo que não é número vale 0', () => {
    const t = clone(templates['dnd5e-2014'] as Json)
    ;(t.fields as Record<string, Json>).nameMod = {
      type: 'number',
      label: 'X',
      readOnly: true,
      derive: 'half',
      from: 'name',
    }
    expect(
      resolve(compileTemplate(t), character('lia').sheet).number('nameMod')
    ).toBe(0)
  })

  it('D&D: PV com máximo guardado e temporários', () => {
    const model = compileTemplate(templates['dnd5e-2014'])
    const hp = resolve(model, character('lia').sheet).get('hp')
    expect(hp).toMatchObject({ current: 27, max: 27, temp: 5, cap: 27 })
  })

  it('Mago: teto não destrutivo das Esferas pelo Arete', () => {
    const model = compileTemplate(templates['mta-m20'])
    const c = character('tomas')
    c.sheet.values.forces = 4
    const forces = resolve(model, c.sheet).get('forces') as ResolvedRating
    expect(forces).toMatchObject({ base: 4, value: 3, cap: 3, inactive: 1 })
    c.sheet.values.arete = 5
    const raised = resolve(model, c.sheet).get('forces') as ResolvedRating
    expect(raised).toMatchObject({ value: 4, inactive: 0 })
  })

  it('Lobisomem: modificadores de forma com a origem', () => {
    const model = compileTemplate(templates['wta-w20'])
    const c = character('iara')
    c.sheet.values.form = 'crinos'
    const r = resolve(model, c.sheet)
    expect(r.get('strength')).toMatchObject({
      base: 3,
      value: 7,
      modifiers: [{ source: 'Crinos', op: 'add', value: 4 }],
    })
    // set fixa o valor; add nunca deixa abaixo de 0
    expect((r.get('appearance') as ResolvedRating).value).toBe(0)
    expect(
      (r.get('manipulation') as ResolvedRating).value
    ).toBeGreaterThanOrEqual(0)
  })

  it('todos os exemplos resolvem sem exceção', () => {
    for (const id of [
      'helena',
      'caio',
      'marta',
      'beto',
      'tomas',
      'iara',
      'lia',
      'joana',
      'dandara',
    ]) {
      const c = character(id)
      const model = compileTemplate(templates[c.system])
      const r = resolve(model, c.sheet)
      expect(r.fields.length).toBe(model.fields.size)
    }
  })
})
