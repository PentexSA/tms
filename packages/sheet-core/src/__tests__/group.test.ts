/// <reference types="bun-types" />
import { describe, expect, it } from 'bun:test'
import fc from 'fast-check'
import { compileTemplate, type SheetModel } from '../compile'
import type { SheetData } from '../contract'
import { applyBatch, diffToBatch, type SheetEvent } from '../events'
import {
  damageTargets,
  type HistoryEvent,
  invertBatch,
  isReversible,
  planGroupDamage,
} from '../group'
import { withEffectiveFrom } from '../labels'
import { validateSheet } from '../validate'
import { character, characters, dnd, type Json, templates } from './fixtures'

// v3, Etapa 10: o dano em grupo e a reversão de um lote, puros.

const models: Record<string, SheetModel> = Object.fromEntries(
  Object.entries(templates).map(([s, t]) => [s, compileTemplate(t)])
)
const model = (system: string) => models[system] as SheetModel
const ALL = ['owner', 'storyteller'] as const
const sheetOf = (id: string, values: Record<string, unknown> = {}) => {
  const s = character(id).sheet as unknown as SheetData
  return { ...s, values: { ...s.values, ...values } } as SheetData
}
const systemOf = (id: string) => character(id).system

const applied = (
  m: SheetModel,
  sheet: SheetData,
  events: readonly SheetEvent[]
) => {
  const r = applyBatch(m, sheet, { events }, ALL)
  if (!r.ok) throw new Error(JSON.stringify(r.issues))
  return r.sheet
}

// O que o servidor grava no histórico: o `from` efetivo e se estava vazio
const history = (
  m: SheetModel,
  before: SheetData,
  events: readonly SheetEvent[]
): HistoryEvent[] =>
  withEffectiveFrom(m, before, events).map((e, i) => ({
    ...e,
    fromAbsent: (events[i]?.from ?? null) === null,
  }))

describe('damageTargets: o alvo vem do tipo', () => {
  it('a Vitalidade no WoD, o PV no D&D; CoC e Fate não têm', () => {
    expect(damageTargets(model('vtm-v20')).map(f => f.id)).toEqual(['health'])
    expect(damageTargets(model('dnd5e-2014')).map(f => f.id)).toEqual(['hp'])
    expect(damageTargets(model('fate-core'))).toEqual([])
  })
})

describe('planGroupDamage: a tabela', () => {
  it('2 letais na Vitalidade', () => {
    const m = model('vtm-v20')
    const sheet = sheetOf('helena', {
      health: { aggravated: 0, lethal: 0, bashing: 0 },
    })
    const plan = planGroupDamage(m, sheet, {
      kind: 'damage',
      type: 'lethal',
      amount: 2,
    })
    if (!plan.ok) throw new Error(plan.reason)
    expect(applied(m, sheet, plan.events).values.health).toEqual({
      aggravated: 0,
      lethal: 2,
      bashing: 0,
    })
    expect(plan.preview[0]?.label).toBe('Vitalidade')
  })

  it('curar contusivo', () => {
    const m = model('vtm-v20')
    const sheet = sheetOf('helena', {
      health: { aggravated: 0, lethal: 1, bashing: 2 },
    })
    const plan = planGroupDamage(m, sheet, {
      kind: 'heal',
      type: 'bashing',
      amount: 1,
    })
    if (!plan.ok) throw new Error(plan.reason)
    expect(applied(m, sheet, plan.events).values.health).toEqual({
      aggravated: 0,
      lethal: 1,
      bashing: 1,
    })
  })

  it('dano no PV do D&D consome primeiro o temporário', () => {
    const m = model('dnd5e-2014')
    const sheet = sheetOf('lia', { hp: { current: 27, max: 27, temp: 5 } })
    const plan = planGroupDamage(m, sheet, { kind: 'damage', amount: 8 })
    if (!plan.ok) throw new Error(plan.reason)
    expect(applied(m, sheet, plan.events).values.hp).toEqual({
      current: 24,
      max: 27,
      temp: 0,
    })
    expect(plan.label).toBe('8 de dano em PV')
  })

  it('sem alvo, sem tipo ou sem efeito: indisponível, com o motivo', () => {
    expect(
      planGroupDamage(model('fate-core'), sheetOf('dandara'), {
        kind: 'damage',
        amount: 1,
      })
    ).toEqual({ ok: false, reason: 'Esta ficha não leva dano' })
    expect(
      planGroupDamage(model('vtm-v20'), sheetOf('helena'), {
        kind: 'damage',
        type: 'fire',
        amount: 1,
      })
    ).toEqual({ ok: false, reason: 'Tipo de dano inválido' })
    const full = sheetOf('lia', { hp: { current: 27, max: 27, temp: 0 } })
    expect(
      planGroupDamage(model('dnd5e-2014'), full, { kind: 'heal', amount: 2 })
    ).toMatchObject({ ok: false })
    expect(
      planGroupDamage(model('vtm-v20'), sheetOf('helena'), {
        kind: 'damage',
        amount: 0,
      })
    ).toEqual({ ok: false, reason: 'Quantidade inválida' })
  })
})

describe('planGroupDamage: mais de um alvo', () => {
  // O D&D com um segundo recurso que leva dano (a Égide do mago)
  function twoTargets() {
    const t = dnd()
    const fields = t.fields as Record<string, Json>
    fields.ward = {
      type: 'resource',
      label: 'Égide',
      max: 10,
      defaultAction: 'damage1',
      editableIn: ['play'],
    }
    const sections = t.sections as Json[]
    const play = sections.find(x => x.zone === 'play') as Json
    play.fields = [...(play.fields as string[]), 'ward']
    return compileTemplate(t)
  }

  it('sem a escolha, pede onde aplicar; com ela, aplica no escolhido', () => {
    const m = twoTargets()
    expect(damageTargets(m).map(f => f.id)).toEqual(['hp', 'ward'])
    const sheet = sheetOf('lia', { ward: { current: 10 } })
    expect(planGroupDamage(m, sheet, { kind: 'damage', amount: 3 })).toEqual({
      ok: false,
      reason: 'Escolha onde aplicar',
    })
    const plan = planGroupDamage(m, sheet, {
      kind: 'damage',
      amount: 3,
      field: 'ward',
    })
    if (!plan.ok) throw new Error(plan.reason)
    expect(applied(m, sheet, plan.events).values.ward).toEqual({ current: 7 })
  })

  it('um alvo que não leva dano não é escolhido', () => {
    expect(
      planGroupDamage(model('vtm-v20'), sheetOf('helena'), {
        kind: 'damage',
        amount: 1,
        field: 'blood',
      })
    ).toEqual({ ok: false, reason: 'Escolha onde aplicar' })
  })
})

describe('invertBatch', () => {
  const m = model('vtm-v20')

  it('um lote com texto não é reversível; um só de recursos e trilhas é', () => {
    const text: SheetEvent = { path: 'values.concept', from: null, to: 'x' }
    const blood: SheetEvent = {
      path: 'values.blood',
      from: { current: 9 },
      to: { current: 8 },
    }
    const specialty: SheetEvent = {
      path: 'specialties.occult',
      from: 'a',
      to: 'b',
    }
    expect(isReversible(m, [blood])).toBe(true)
    expect(isReversible(m, [blood, text])).toBe(false)
    expect(isReversible(m, [specialty])).toBe(false)
    expect(isReversible(m, [])).toBe(false)
    expect(invertBatch(m, sheetOf('helena'), [blood, text])).toEqual({
      ok: false,
      kind: 'irreversible',
      paths: ['values.concept'],
    })
  })

  it('o caminho que estava vazio volta a ficar vazio (o padrão volta a acompanhar a fonte)', () => {
    const before = sheetOf('helena')
    const values = { ...before.values } as Record<string, unknown>
    delete values.willpower
    const empty = { ...before, values } as SheetData
    const events: SheetEvent[] = [
      {
        path: 'values.willpower',
        from: null,
        to: { current: 1, permanent: 2 },
      },
    ]
    const after = applied(m, empty, events)
    const inv = invertBatch(m, after, history(m, empty, events))
    if (!inv.ok) throw new Error(inv.kind)
    expect(inv.events).toEqual([
      {
        path: 'values.willpower',
        from: { current: 1, permanent: 2 },
        to: null,
      },
    ])
    expect(applied(m, after, inv.events).values).toEqual(empty.values)
  })

  it('o jogador gastou depois: recusa, com o caminho em conflito', () => {
    const before = sheetOf('helena', { blood: { current: 9 } })
    const events: SheetEvent[] = [
      { path: 'values.blood', from: { current: 9 }, to: { current: 6 } },
    ]
    const after = applied(m, before, events)
    const later = applied(m, after, [
      { path: 'values.blood', from: { current: 6 }, to: { current: 5 } },
    ])
    expect(invertBatch(m, later, history(m, before, events))).toEqual({
      ok: false,
      kind: 'conflict',
      paths: ['values.blood'],
    })
  })
})

// Lotes gerados nas fichas de exemplo: campos de tipo reversível trocados
// pelo valor de outra ficha do mesmo sistema ou apagados
const REVERSIBLE = new Set([
  'rating',
  'number',
  'percent',
  'resource',
  'track',
  'slots',
  'clock',
  'state',
  'mark',
  'choice',
  'tags',
  'list',
])
const reversibleIds = (m: SheetModel) =>
  [...m.fields.values()]
    .filter(f => !f.readOnly && REVERSIBLE.has(f.type))
    .map(f => f.id)

const arbitraryCase = fc
  .constantFrom(...characters.map(c => c.id))
  .chain(id => {
    const system = systemOf(id)
    const donors = characters.filter(c => c.system === system).map(c => c.id)
    return fc.record({
      id: fc.constant(id),
      changes: fc.uniqueArray(
        fc.record({
          field: fc.constantFrom(...reversibleIds(model(system))),
          donor: fc.option(fc.constantFrom(...donors)),
        }),
        { selector: c => c.field, minLength: 1, maxLength: 6 }
      ),
    })
  })
  .map(({ id, changes }) => {
    const m = model(systemOf(id))
    const before = sheetOf(id)
    const values = { ...before.values } as Record<string, unknown>
    for (const { field, donor } of changes) {
      const v = donor ? sheetOf(donor).values[field] : undefined
      if (v === undefined) delete values[field]
      else values[field] = v
    }
    const events = diffToBatch(m, before, { ...before, values } as SheetData)
    const ok = events.length > 0 && applyBatch(m, before, { events }, ALL).ok
    return { m, before, events, ok }
  })

describe('propriedades', () => {
  it('aplicar e reverter devolve a ficha original, byte a byte', () => {
    fc.assert(
      fc.property(arbitraryCase, ({ m, before, events, ok }) => {
        fc.pre(ok)
        const after = applied(m, before, events)
        const inv = invertBatch(m, after, history(m, before, events))
        expect(inv.ok).toBe(true)
        if (!inv.ok) return
        const back = applied(m, after, inv.events)
        expect(back.values).toEqual(before.values)
        // O lote invertido passa no validateSheet
        expect(validateSheet(m.template, back)).toEqual([])
      }),
      { numRuns: 300 }
    )
  })

  it('qualquer mudança posterior num caminho da operação faz a reversão recusar, com ele', () => {
    fc.assert(
      fc.property(
        arbitraryCase,
        fc.nat(),
        ({ m, before, events, ok }, pick) => {
          fc.pre(ok)
          const after = applied(m, before, events)
          // Volta um dos caminhos ao valor de antes: mudou depois do lote
          const target = events[pick % events.length] as SheetEvent
          const later = applyBatch(
            m,
            after,
            {
              events: [{ path: target.path, from: target.to, to: target.from }],
            },
            ALL
          )
          // Um campo pode depender de outro caminho do lote: restaurar só
          // PV pode exceder o teto reduzido. Só uma escrita válida chega à
          // ficha pela API; uma tentativa recusada não produz conflito.
          fc.pre(later.ok)
          if (!later.ok) return
          const inv = invertBatch(m, later.sheet, history(m, before, events))
          expect(inv).toMatchObject({ ok: false, kind: 'conflict' })
          if (!inv.ok) expect(inv.paths).toContain(target.path)
        }
      ),
      { numRuns: 300 }
    )
  })

  it('restaurar só o recurso acima do teto é recusado; uma mudança válida cria conflito', () => {
    const m = model('coc7e')
    const before = sheetOf('joana')
    const events: SheetEvent[] = [
      { path: 'values.con', from: before.values.con, to: null },
      { path: 'values.hp', from: before.values.hp, to: null },
    ]
    const after = applied(m, before, events)
    const invalid = applyBatch(
      m,
      after,
      { events: [{ path: 'values.hp', from: null, to: before.values.hp }] },
      ALL
    )
    expect(invalid).toMatchObject({ ok: false, kind: 'invalid' })
    expect(invertBatch(m, after, history(m, before, events)).ok).toBe(true)
    const later = applied(m, after, [
      { path: 'values.hp', from: null, to: { current: 1 } },
    ])
    expect(invertBatch(m, later, history(m, before, events))).toEqual({
      ok: false,
      kind: 'conflict',
      paths: ['values.hp'],
    })
  })
})
