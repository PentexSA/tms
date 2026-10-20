/// <reference types="bun-types" />
import { describe, expect, it } from 'bun:test'
import fc from 'fast-check'
import { compileTemplate } from '../compile'
import type { SheetData } from '../contract'
import { planState, statePreview } from '../effects'
import { applyBatch, invert } from '../events'
import { describe as describeField } from '../fields'
import { resolve } from '../resolve'
import { validateSheet } from '../validate'
import { character, type Json, vtm, wta } from './fixtures'

// Formas do Lobisomem (W20): `state` com modificadores e o custo opcional da
// mudança instantânea (1 Fúria). E um `state` mínimo sem nome de sistema, que
// prova que nada aqui é do Garou.

const model = compileTemplate(wta())
const iara = () => character('iara').sheet as unknown as SheetData
const withValues = (values: Record<string, unknown>): SheetData => {
  const s = iara()
  return { ...s, values: { ...s.values, ...values } } as SheetData
}
const rage = (current: number, permanent = 4) => ({ current, permanent })

// Uma postura de duas opções, sem custo, num template de outra criatura
const stanceModel = (() => {
  const t = vtm() as Json & { fields: Record<string, Json> }
  t.templateVersion = '9.9.7'
  t.fields.stance = {
    type: 'state',
    label: 'Postura',
    editableIn: ['play'],
    options: [
      { id: 'calm', label: 'Calma' },
      {
        id: 'guard',
        label: 'Guarda',
        modifiers: [{ field: 'dexterity', op: 'add', value: 1 }],
      },
    ],
  }
  const play = (t.sections as Json[]).find(s => s.id === 'play')
  if (play) play.fields = [...(play.fields as string[]), 'stance']
  return compileTemplate(t)
})()

describe('planState: a troca de forma', () => {
  it('sem custo: um evento só, a troca', () => {
    expect(planState(model, iara(), 'form', 'crinos')).toEqual({
      ok: true,
      events: [{ path: 'values.form', from: 'hominideo', to: 'crinos' }],
      preview: [{ label: 'Forma', change: 'Hominídeo → Crinos' }],
      label: 'Forma: Crinos',
    })
  })

  it('mudança instantânea: a troca e 1 Fúria no mesmo lote', () => {
    const plan = planState(model, iara(), 'form', 'crinos', { payCost: true })
    expect(plan).toEqual({
      ok: true,
      events: [
        { path: 'values.form', from: 'hominideo', to: 'crinos' },
        { path: 'values.rage', from: rage(3), to: rage(2) },
      ],
      preview: [
        { label: 'Forma', change: 'Hominídeo → Crinos' },
        { label: 'Fúria', change: '3 → 2' },
      ],
      label: 'Forma: Crinos (1 Fúria)',
    })
  })

  it('sem Fúria, a mudança instantânea é bloqueada; a lenta continua', () => {
    const sheet = withValues({ rage: rage(0) })
    expect(
      planState(model, sheet, 'form', 'crinos', { payCost: true })
    ).toEqual({ ok: false, reason: 'Fúria insuficiente' })
    expect(planState(model, sheet, 'form', 'crinos').ok).toBe(true)
  })

  it('a forma atual, uma opção inexistente ou um campo que não é estado', () => {
    expect(planState(model, iara(), 'form', 'hominideo')).toEqual({
      ok: false,
      reason: 'Já em Hominídeo',
    })
    expect(planState(model, iara(), 'form', 'urrah')).toEqual({
      ok: false,
      reason: 'Opção inexistente',
    })
    expect(planState(model, iara(), 'rage', 'crinos')).toEqual({
      ok: false,
      reason: 'Estado inexistente',
    })
  })

  it('um custo obrigatório é pago mesmo sem pedir', () => {
    const t = wta() as Json & { fields: Record<string, Json> }
    t.templateVersion = '9.9.8'
    const form = t.fields.form as Json
    form.cost = { ...(form.cost as Json), optional: false }
    const strict = compileTemplate(t)
    const plan = planState(strict, iara(), 'form', 'lupino')
    expect(plan.ok && plan.events.map(e => e.path)).toEqual([
      'values.form',
      'values.rage',
    ])
  })

  it('sem `cost`, pedir para pagar não muda nada (a postura mínima)', () => {
    const sheet = { values: {}, specialties: {} } as unknown as SheetData
    const plan = planState(stanceModel, sheet, 'stance', 'guard', {
      payCost: true,
    })
    expect(plan.ok && plan.events).toEqual([
      { path: 'values.stance', from: null, to: 'guard' },
    ])
  })
})

describe('planState: propriedades', () => {
  const form = model.fields.get('form')?.def
  const forms = form?.type === 'state' ? form.options : []

  it('o lote passa no applyBatch, não mexe em valor gravado de atributo e o inverso desfaz', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...forms.map(o => o.id)),
        fc.constantFrom(...forms.map(o => o.id)),
        fc.integer({ min: 0, max: 4 }),
        fc.boolean(),
        (from, to, current, payCost) => {
          const sheet = withValues({ form: from, rage: rage(current) })
          const plan = planState(model, sheet, 'form', to, { payCost })
          if (from === to) {
            expect(plan.ok).toBe(false)
            return
          }
          if (!plan.ok) {
            // Só a falta de Fúria bloqueia uma troca para outra forma
            expect(payCost && current === 0).toBe(true)
            return
          }
          // Nunca debita sem trocar: o primeiro evento é sempre a troca
          expect(plan.events[0]?.path).toBe('values.form')
          expect(plan.events.length).toBe(payCost ? 2 : 1)
          const applied = applyBatch(model, sheet, plan, ['owner'])
          if (!applied.ok) throw new Error(applied.kind)
          expect(validateSheet(model.template, applied.sheet)).toEqual([])
          for (const id of ['strength', 'dexterity', 'stamina', 'appearance'])
            expect(applied.sheet.values[id]).toEqual(sheet.values[id])
          const undone = applyBatch(
            model,
            applied.sheet,
            { events: invert(plan.events) },
            ['owner']
          )
          if (!undone.ok) throw new Error(undone.kind)
          expect(undone.sheet.values).toEqual(sheet.values)
        }
      )
    )
  })
})

describe('statePreview: o que cada forma faz, antes de trocar', () => {
  it('Crinos na Iara: For 7, Des 4, Vig 6, Man 0, Apa 0', () => {
    const crinos = statePreview(model, iara(), 'form').find(
      o => o.id === 'crinos'
    )
    expect(crinos).toMatchObject({
      label: 'Crinos',
      hint: 'lobisomem',
      note: 'Humanos que veem a forma Crinos sofrem o Delírio.',
      summary: 'For 7 · Des 4 · Vig 6 · Man 0 · Apa 0',
    })
  })

  it('a forma sem modificador não tem resumo, e todas as opções aparecem', () => {
    const preview = statePreview(model, iara(), 'form')
    expect(preview.map(o => o.id)).toEqual([
      'hominideo',
      'glabro',
      'crinos',
      'hispo',
      'lupino',
    ])
    expect(preview[0]).toMatchObject({ summary: '', effects: [] })
  })

  it('a prévia parte da ficha atual, não da forma em que ela está', () => {
    const inCrinos = withValues({ form: 'crinos' })
    const lupino = statePreview(model, inCrinos, 'form').find(
      o => o.id === 'lupino'
    )
    expect(lupino?.summary).toBe('Des 5 · Vig 5 · Man 0')
  })

  it('um campo que não é estado não tem prévia', () => {
    expect(statePreview(model, iara(), 'rage')).toEqual([])
  })
})

describe('describe de um atributo modificado: a origem é a opção', () => {
  it('a postura mínima não fala em "forma"', () => {
    const sheet = { values: { stance: 'guard', dexterity: 2 }, specialties: {} }
    const resolved = resolve(stanceModel, sheet)
    const dex = resolved.get('dexterity')
    if (!dex) throw new Error('dexterity')
    expect(describeField(dex, resolved)).toBe(
      'Destreza, 3 de 5, base 2 mais 1 em Guarda'
    )
  })
})
