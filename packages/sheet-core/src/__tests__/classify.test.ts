/// <reference types="bun-types" />
import { describe, expect, it } from 'bun:test'
import fc from 'fast-check'
import { classifyBatch, classifyChange, editClass } from '../classify'
import { compileTemplate, type SheetModel } from '../compile'
import type { SheetData } from '../contract'
import { jsonEqual } from '../equal'
import { applyBatch, diffToBatch, invert, type SheetEvent } from '../events'
import { stored } from '../fields'
import { resolve } from '../resolve'
import { character, characters, clone, templates } from './fixtures'

const models: Record<string, SheetModel> = Object.fromEntries(
  Object.entries(templates).map(([system, t]) => [system, compileTemplate(t)])
)
const model = (system: string) => models[system] as SheetModel
const ALL = ['owner', 'storyteller'] as const

const sheetOf = (id: string) => character(id).sheet as unknown as SheetData
const systemOf = (id: string) => character(id).system

const without = (sheet: SheetData, ...ids: string[]): SheetData => {
  const values = { ...sheet.values } as Record<string, unknown>
  for (const id of ids) delete values[id]
  return { ...sheet, values } as SheetData
}

interface Patch {
  values?: Record<string, unknown>
  specialties?: Record<string, unknown>
}

// O lote que leva a ficha ao `patch` (null apaga o valor guardado), conferido
// pelo applyBatch: um teste que classifica um lote inválido não prova nada.
function batch(m: SheetModel, before: SheetData, patch: Patch): SheetEvent[] {
  const merge = (a: object | undefined, b: Record<string, unknown> = {}) =>
    Object.fromEntries(
      Object.entries({ ...a, ...b }).filter(([, v]) => v !== null)
    )
  const after = {
    values: merge(before.values, patch.values),
    specialties: merge(before.specialties, patch.specialties),
  } as SheetData
  const events = diffToBatch(m, before, after)
  const r = applyBatch(m, before, { events }, ALL)
  if (!r.ok) throw new Error(JSON.stringify(r.issues))
  return events
}

const classify = (id: string, patch: Patch, sheet = sheetOf(id)) => {
  const m = model(systemOf(id))
  return classifyBatch(m, sheet, batch(m, sheet, patch))
}

const parts = (r: ReturnType<typeof classifyBatch>) =>
  Object.fromEntries(r.parts.map(p => [p.path, p.kind]))

describe('classifyBatch: a tabela da Etapa 4', () => {
  describe('Força de Vontade do Vampiro (resource)', () => {
    it('só o temporário é play', () => {
      const r = classify('helena', {
        values: { willpower: { current: 4, permanent: 7 } },
      })
      expect(parts(r)).toEqual({ 'values.willpower#current': 'play' })
      expect(r.kind).toBe('play')
    })

    it('o permanente é advance', () => {
      const r = classify('helena', {
        values: { willpower: { current: 5, permanent: 8 } },
      })
      expect(parts(r)).toEqual({ 'values.willpower#permanent': 'advance' })
    })

    it('os dois juntos: as duas partes, e vale advance', () => {
      const r = classify('helena', {
        values: { willpower: { current: 6, permanent: 8 } },
      })
      expect(parts(r)).toEqual({
        'values.willpower#current': 'play',
        'values.willpower#permanent': 'advance',
      })
      expect(r.kind).toBe('advance')
    })
  })

  describe('Dons do Lobisomem (list com meta numérico)', () => {
    const gifts = () =>
      clone(sheetOf('iara').values.gifts) as unknown as {
        id: string
        name: string
        notes?: string
        meta: Record<string, unknown>
      }[]

    it('incluir um Dom é advance', () => {
      const next = [
        ...gifts(),
        { id: 'g9', name: 'Sentidos Aguçados', meta: { rank: 1 } },
      ]
      const r = classify('iara', { values: { gifts: next } })
      expect(parts(r)).toEqual({ 'values.gifts#g9': 'advance' })
    })

    it('mudar o Posto de 1 para 2 é advance', () => {
      const next = gifts()
      next[0]!.meta.rank = 2
      const r = classify('iara', { values: { gifts: next } })
      expect(parts(r)).toEqual({ 'values.gifts#g1.meta.rank': 'advance' })
    })

    it('remover um Dom é advance', () => {
      const r = classify('iara', { values: { gifts: gifts().slice(1) } })
      expect(parts(r)).toEqual({ 'values.gifts#g1': 'advance' })
    })

    it('mudar as notas ou a origem (meta de texto) é edit', () => {
      const next = gifts()
      next[0]!.notes = 'aprendido com o Galliard da seita'
      next[1]!.meta.source = 'Tribo'
      const r = classify('iara', { values: { gifts: next } })
      expect(parts(r)).toEqual({
        'values.gifts#g1.notes': 'edit',
        'values.gifts#g2.meta.source': 'edit',
      })
      expect(r.kind).toBe('edit')
    })
  })

  describe('Disciplinas do Vampiro (list com value)', () => {
    const disciplines = () =>
      clone(sheetOf('helena').values.disciplines) as unknown as Record<
        string,
        unknown
      >[]

    it('subir o value é advance', () => {
      const next = disciplines()
      next[1]!.value = 3
      const r = classify('helena', { values: { disciplines: next } })
      expect(parts(r)).toEqual({ 'values.disciplines#d2.value': 'advance' })
    })

    it('trocar a especialização do item é edit', () => {
      const next = disciplines()
      next[0]!.specialty = 'Trilha da Conjuração'
      const r = classify('helena', { values: { disciplines: next } })
      expect(parts(r)).toEqual({ 'values.disciplines#d1.specialty': 'edit' })
    })

    it('reordenar é edit', () => {
      const r = classify('helena', {
        values: { disciplines: disciplines().reverse() },
      })
      expect(parts(r)).toEqual({ 'values.disciplines#order': 'edit' })
    })
  })

  describe('WoD: o resto da ficha', () => {
    it('rating sem editableIn play (Atributo) é advance', () => {
      const r = classify('helena', { values: { strength: 3 } })
      expect(parts(r)).toEqual({ 'values.strength': 'advance' })
    })

    it('xpTotal (number) é advance', () => {
      const r = classify('helena', { values: { xpTotal: 40 } })
      expect(r.kind).toBe('advance')
    })

    it('Vitalidade (track wod-stacking) é play, por tipo de dano', () => {
      const r = classify('helena', {
        values: { health: { aggravated: 0, lethal: 2, bashing: 0 } },
      })
      expect(r.kind).toBe('play')
      expect(r.parts.every(p => p.path.startsWith('values.health#'))).toBe(true)
    })

    it('texto, choice e especialização são edit', () => {
      const r = classify('helena', {
        values: { concept: 'Outra coisa', clan: 'brujah' },
        specialties: { occult: 'Necromancia' },
      })
      expect(parts(r)).toEqual({
        'values.concept': 'edit',
        'values.clan': 'edit',
        'specialties.occult': 'edit',
      })
    })

    it('a Roda do Mago (clock) é play', () => {
      const wheel = sheetOf('tomas').values.wheel as Record<string, number>
      const [first] = Object.keys(wheel)
      const r = classify('tomas', {
        values: { wheel: { ...wheel, [first!]: (wheel[first!] ?? 0) + 1 } },
      })
      expect(r.kind).toBe('play')
    })

    it('a forma do Lobisomem (state) é play, e não muda a base dos Atributos', () => {
      const r = classify('iara', { values: { form: 'crinos' } })
      expect(parts(r)).toEqual({ 'values.form': 'play' })
    })

    it('Méritos (meta de custo) incluir é advance; Cicatrizes (sem número), edit', () => {
      const merit = { id: 'm9', name: 'Sono Leve', meta: { cost: 1 } }
      expect(classify('helena', { values: { merits: [merit] } }).kind).toBe(
        'advance'
      )
      const scar = { id: 's9', name: 'Orelha rasgada' }
      const scars = sheetOf('iara').values.battleScars as unknown[]
      expect(
        classify('iara', { values: { battleScars: [...scars, scar] } }).kind
      ).toBe('edit')
    })
  })

  describe('D&D 5e', () => {
    const lia = () => sheetOf('lia').values as Record<string, unknown>

    it('slots: used é play, max é advance, nível novo é advance', () => {
      const slots = clone(lia().spellSlots) as Record<
        string,
        { max: number; used: number }
      >
      expect(
        parts(
          classify('lia', {
            values: { spellSlots: { ...slots, 2: { max: 3, used: 2 } } },
          })
        )
      ).toEqual({ 'values.spellSlots#2.used': 'play' })
      expect(
        parts(
          classify('lia', {
            values: { spellSlots: { ...slots, 2: { max: 4, used: 1 } } },
          })
        )
      ).toEqual({ 'values.spellSlots#2.max': 'advance' })
      expect(
        parts(
          classify('lia', {
            values: { spellSlots: { ...slots, 4: { max: 1, used: 0 } } },
          })
        )
      ).toEqual({ 'values.spellSlots#4': 'advance' })
    })

    it('a proficiência (mark) é advance', () => {
      expect(parts(classify('lia', { values: { arcana: 'expert' } }))).toEqual({
        'values.arcana': 'advance',
      })
    })

    it('Condições (tags com play) e Inspiração (rating com play) são play', () => {
      const r = classify('lia', {
        values: { conditions: ['caido'], inspiration: 1 },
      })
      expect(parts(r)).toEqual({
        'values.conditions': 'play',
        'values.inspiration': 'play',
      })
    })

    it('PV: temp é play; max guardado é advance', () => {
      expect(
        parts(
          classify('lia', {
            values: { hp: { current: 27, max: 27, temp: 0 } },
          })
        )
      ).toEqual({ 'values.hp#temp': 'play' })
      expect(
        parts(
          classify('lia', {
            values: { hp: { current: 27, max: 33, temp: 5 } },
          })
        )
      ).toEqual({ 'values.hp#max': 'advance' })
    })

    it('Ouro e inventário (editableIn play) são play; o nível é advance', () => {
      const inventory = clone(lia().inventory) as {
        id: string
        meta: Record<string, unknown>
      }[]
      inventory[0]!.meta.qty = 3
      const r = classify('lia', {
        values: {
          gold: 30,
          inventory: [
            ...inventory,
            { id: 'i9', name: 'Corda', meta: { qty: 1 } },
          ],
        },
      })
      expect(parts(r)).toEqual({
        'values.gold': 'play',
        'values.inventory#i1.meta.qty': 'play',
        'values.inventory#i9': 'play',
      })
      expect(classify('lia', { values: { level: 6 } }).kind).toBe('advance')
    })

    it('Ataques (meta numérico) incluir é advance; Magias (só texto), edit', () => {
      const attack = { id: 'a9', name: 'Adaga', meta: { bonus: 4 } }
      expect(
        classify('lia', {
          values: { attacks: [...(lia().attacks as unknown[]), attack] },
        }).kind
      ).toBe('advance')
      const spell = { id: 'luz', name: 'Luz', meta: { level: 'Truque' } }
      expect(
        classify('lia', {
          values: { spells: [...(lia().spells as unknown[]), spell] },
        }).kind
      ).toBe('edit')
    })
  })

  describe('CoC 7e e Fate (mesmo código)', () => {
    it('CoC: perícia (percent) é advance; Condições e Sanidade são play', () => {
      expect(parts(classify('joana', { values: { mythos: 5 } }))).toEqual({
        'values.mythos': 'advance',
      })
      const r = classify('joana', {
        values: { conditions: ['morrendo'], sanity: { current: 48 } },
      })
      expect(parts(r)).toEqual({
        'values.conditions': 'play',
        'values.sanity#current': 'play',
      })
    })

    it('Fate: Consequências (lista fixa com play) são play; perícia é advance; Façanha nova, edit', () => {
      const consequences = clone(sheetOf('dandara').values.consequences) as {
        id: string
        text: string
      }[]
      consequences[1]!.text = 'Tornozelo torcido'
      expect(parts(classify('dandara', { values: { consequences } }))).toEqual({
        'values.consequences#moderate.text': 'play',
      })
      expect(classify('dandara', { values: { fight: 3 } }).kind).toBe('advance')
      const stunts = (sheetOf('dandara').values.stunts ?? []) as unknown[]
      expect(
        classify('dandara', {
          values: { stunts: [...stunts, { id: 'x9', name: 'Golpe' }] },
        }).kind
      ).toBe('edit')
    })
  })
})

describe('classifyBatch: valores efetivos', () => {
  it('primeiro gasto de FdV sem FdV gravada (null → efetivo) é só play', () => {
    const m = model('vtm-v20')
    const sheet = without(sheetOf('helena'), 'willpower')
    const eff = stored(
      resolve(m, sheet).get('willpower')!,
      resolve(m, sheet)
    ) as { current: number; permanent: number }
    const events = [
      {
        path: 'values.willpower',
        from: null,
        to: { current: eff.current - 1, permanent: eff.permanent },
      },
    ]
    expect(applyBatch(m, sheet, { events }, ALL).ok).toBe(true)
    const r = classifyBatch(m, sheet, events)
    expect(parts(r)).toEqual({ 'values.willpower#current': 'play' })
  })

  it('Lobisomem sem FdV gravada: trocar a tribo muda a FdV permanente padrão (advance)', () => {
    // Garras Vermelhas: 3; Observadores das Estrelas: 4
    const r = classify('caue', {
      values: { tribe: 'observadores-das-estrelas' },
    })
    expect(parts(r)).toEqual({
      'values.tribe': 'edit',
      'values.willpower#current': 'play',
      'values.willpower#permanent': 'advance',
    })
    expect(r.kind).toBe('advance')
  })

  it('com a FdV já gravada, trocar a tribo é só edit', () => {
    const sheet = sheetOf('caue')
    const withWill = {
      ...sheet,
      values: { ...sheet.values, willpower: { current: 3, permanent: 3 } },
    } as SheetData
    const r = classify(
      'caue',
      { values: { tribe: 'observadores-das-estrelas' } },
      withWill
    )
    expect(parts(r)).toEqual({ 'values.tribe': 'edit' })
  })

  it('Vampiro sem Humanidade gravada: subir Consciência é advance em dois campos', () => {
    const r = classify(
      'helena',
      { values: { conscience: 4 } },
      without(sheetOf('helena'), 'humanity')
    )
    expect(parts(r)).toEqual({
      'values.conscience': 'advance',
      'values.humanity': 'advance',
    })
  })

  it('apagar um valor igual ao padrão não tem classe', () => {
    const m = model('vtm-v20')
    const sheet = sheetOf('helena')
    // Humanidade 6 gravada; a padrão é Consciência + Autocontrole = 7
    const r = classify('helena', { values: { humanity: 7 } })
    expect(r.kind).toBe('advance')
    const same = { ...sheet, values: { ...sheet.values, humanity: 7 } }
    const back = classifyBatch(m, same as SheetData, [
      { path: 'values.humanity', from: 7, to: null },
    ])
    expect(back).toEqual({ parts: [], kind: null })
  })
})

// Lotes gerados: em cada ficha de exemplo, campos trocados pelo valor de
// outra ficha do mesmo sistema ou apagados (voltam ao padrão), e às vezes as
// especializações de outra ficha. Só entram os lotes que o applyBatch aceita.
const editable = (m: SheetModel) =>
  [...m.fields.values()].filter(f => !f.readOnly).map(f => f.id)

const arbitraryCase = fc
  .constantFrom(...characters.map(c => c.id))
  .chain(id => {
    const system = systemOf(id)
    const donors = characters.filter(c => c.system === system).map(c => c.id)
    return fc.record({
      id: fc.constant(id),
      changes: fc.uniqueArray(
        fc.record({
          field: fc.constantFrom(...editable(model(system))),
          donor: fc.option(fc.constantFrom(...donors)),
        }),
        { selector: c => c.field, minLength: 1, maxLength: 8 }
      ),
      specialtiesFrom: fc.option(fc.constantFrom(...donors)),
    })
  })
  .map(({ id, changes, specialtiesFrom }) => {
    const m = model(systemOf(id))
    const before = sheetOf(id)
    const values = { ...before.values } as Record<string, unknown>
    for (const { field, donor } of changes) {
      const v = donor ? sheetOf(donor).values[field] : undefined
      if (v === undefined) delete values[field]
      else values[field] = v
    }
    const specialties = specialtiesFrom
      ? sheetOf(specialtiesFrom).specialties
      : before.specialties
    const after = { values, specialties } as SheetData
    const events = diffToBatch(m, before, after)
    const ok = events.length > 0 && applyBatch(m, before, { events }, ALL).ok
    return { m, before, after, events, ok }
  })

// Algum valor efetivo (ou especialização) mudou de uma ficha para a outra.
const effectChanged = (m: SheetModel, a: SheetData, b: SheetData) => {
  const ra = resolve(m, a)
  const rb = resolve(m, b)
  return [...m.fields.values()].some(
    f =>
      ra.specialty(f.id) !== rb.specialty(f.id) ||
      (!f.readOnly &&
        !jsonEqual(stored(ra.get(f.id)!, ra), stored(rb.get(f.id)!, rb)))
  )
}

describe('propriedades', () => {
  it('um lote que muda algum valor efetivo tem classe; um que não muda, não', () => {
    fc.assert(
      fc.property(arbitraryCase, ({ m, before, after, events, ok }) => {
        fc.pre(ok)
        const r = classifyBatch(m, before, events)
        expect(r.kind !== null).toBe(effectChanged(m, before, after))
        expect(r.parts.length > 0).toBe(r.kind !== null)
      }),
      { numRuns: 300 }
    )
  })

  it('um lote sem efeito (o to igual ao efetivo) não tem classe', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...characters.map(c => c.id)),
        fc.integer({ min: 1, max: 12 }),
        (id, n) => {
          const m = model(systemOf(id))
          const before = sheetOf(id)
          const r = resolve(m, before)
          // Materializa o efetivo dos campos sem valor guardado
          const events = [...m.fields.values()]
            .filter(f => !f.readOnly && !Object.hasOwn(before.values, f.id))
            .slice(0, n)
            .map(f => ({
              path: `values.${f.id}`,
              from: null,
              to: stored(r.get(f.id)!, r) ?? null,
            }))
            .filter(e => e.to !== null)
          fc.pre(events.length > 0)
          expect(applyBatch(m, before, { events }, ALL).ok).toBe(true)
          expect(classifyBatch(m, before, events)).toEqual({
            parts: [],
            kind: null,
          })
        }
      )
    )
  })

  it('o lote invertido tem a mesma classe', () => {
    fc.assert(
      fc.property(arbitraryCase, ({ m, before, after, events, ok }) => {
        fc.pre(ok)
        const there = classifyBatch(m, before, events)
        const back = classifyBatch(m, after, invert(events))
        expect(back.kind).toBe(there.kind)
        expect(new Set(back.parts.map(p => `${p.path}:${p.kind}`))).toEqual(
          new Set(there.parts.map(p => `${p.path}:${p.kind}`))
        )
      }),
      { numRuns: 300 }
    )
  })

  it('classifyBatch não muda a ficha de entrada', () => {
    fc.assert(
      fc.property(arbitraryCase, ({ m, before, events }) => {
        const copy = clone(before)
        classifyBatch(m, before, events)
        expect(before).toEqual(copy)
      })
    )
  })
})

describe('editClass: o editor de Evoluir, sem o valor novo', () => {
  const of = (system: string, id: string) =>
    editClass(model(system).fields.get(id)!)

  it('o que muda um traço é advance; o que o jogo gasta é play; texto é edit', () => {
    expect(of('vtm-v20', 'strength')).toBe('advance')
    expect(of('vtm-v20', 'willpower')).toBe('advance')
    expect(of('vtm-v20', 'blood')).toBe('play')
    expect(of('dnd5e-2014', 'hp')).toBe('advance')
    expect(of('vtm-v20', 'health')).toBe('play')
    expect(of('vtm-v20', 'concept')).toBe('edit')
    expect(of('vtm-v20', 'clan')).toBe('edit')
    expect(of('wta-w20', 'form')).toBe('play')
    expect(of('mta-m20', 'wheel')).toBe('play')
    expect(of('dnd5e-2014', 'inspiration')).toBe('play')
    expect(of('dnd5e-2014', 'arcana')).toBe('advance')
    expect(of('dnd5e-2014', 'spellSlots')).toBe('advance')
  })

  it('lista: a parte mais solta (o servidor recusa a de evolução)', () => {
    expect(of('vtm-v20', 'disciplines')).toBe('edit')
    expect(of('dnd5e-2014', 'inventory')).toBe('play')
  })

  it('é a classe que classifyChange dá ao valor principal do campo', () => {
    for (const [system, m] of Object.entries(models))
      for (const field of m.fields.values()) {
        if (field.readOnly || field.type === 'list') continue
        const r = resolve(m, { values: {} } as unknown as SheetData)
        const value = stored(r.get(field.id)!, r)
        const kinds = [
          ...new Set(classifyChange(field, value, undefined).map(p => p.kind)),
        ]
        // Sem valor efetivo (choice vazio) não há o que comparar
        if (!kinds.length) continue
        // O editor muda várias partes: a mais restrita está entre elas
        if (field.type === 'resource' || field.type === 'slots')
          expect(kinds).toContain(editClass(field))
        else
          expect([system, field.id, kinds]).toEqual([
            system,
            field.id,
            [editClass(field)],
          ])
      }
  })
})
