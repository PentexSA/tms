/// <reference types="bun-types" />
import { describe, expect, it } from 'bun:test'
import { classifyBatch, hasMechanicalNames } from '../classify'
import { compileTemplate } from '../compile'
import type { SheetData } from '../contract'
import { costOf, ledgerPaths, planXpSpend } from '../costs'
import { applyBatch } from '../events'
import { acct } from './accounting-fixture'
import { templates } from './fixtures'

// Aprovação de um pedido de XP no core (doc/plano-v4.md, Etapa 7) e a
// proteção das projeções do extrato e da identidade dos itens.

const model = compileTemplate(acct())
const sheet = (values: Record<string, unknown> = {}): SheetData => ({
  values: {
    name: 'Teste',
    lineage: 'b',
    xpTotal: 30,
    xpSpent: 2,
    ...values,
  } as SheetData['values'],
})
const snapshot = (
  values: Record<string, unknown>,
  target: Parameters<typeof costOf>[2]
) => {
  const r = costOf(model, sheet(values), target)
  if (!r.ok) throw new Error('fixture: o pedido precisa ter preço')
  return { target, from: r.from, cost: r.cost }
}

describe('ledgerPaths', () => {
  it('acha as projeções do extrato num lote, inclusive para apagar', () => {
    expect(
      ledgerPaths(model, [
        { path: 'values.name' },
        { path: 'values.xpTotal' },
        { path: 'specialties.xpSpent' },
        { path: 'values.xpSpent' },
        { path: 'lixo' },
      ])
    ).toEqual(['values.xpTotal', 'values.xpSpent'])
  })

  it('template sem extrato não tem projeção', () => {
    const dnd = compileTemplate(templates['dnd5e-2014'])
    expect(ledgerPaths(dnd, [{ path: 'values.level' }])).toEqual([])
  })
})

describe('planXpSpend', () => {
  const opts = { spent: 2, newItemId: 'novo' }

  it('campo: o traço sobe um nível e o gasto entra no extrato', () => {
    const plan = planXpSpend(
      model,
      sheet({ dex: 2 }),
      snapshot({ dex: 2 }, { field: 'dex' }),
      opts
    )
    expect(plan).toEqual({
      ok: true,
      from: 2,
      to: 3,
      cost: 8,
      events: [
        { path: 'values.dex', from: 2, to: 3 },
        { path: 'values.xpSpent', from: 2, to: 10 },
      ],
    })
    if (!plan.ok) return
    // O lote passa no applyBatch do narrador
    const applied = applyBatch(
      model,
      sheet({ dex: 2 }),
      { events: plan.events },
      ['storyteller']
    )
    expect(applied.ok).toBe(true)
  })

  it('campo ausente: o "de" é null (o padrão), e o permanente do recurso', () => {
    const plan = planXpSpend(
      model,
      sheet({ con: 3 }),
      snapshot({ con: 3 }, { field: 'will' }),
      opts
    )
    expect(plan.ok && plan.events[0]).toEqual({
      path: 'values.will',
      from: null,
      to: { current: 3, permanent: 4 },
    })
  })

  it('item existente e item novo preservam os outros itens', () => {
    const powers = [
      { id: 'p1', name: 'Visão', value: 2 },
      { id: 'p2', name: 'Velocidade', value: 1 },
    ]
    const raise = planXpSpend(
      model,
      sheet({ powers }),
      snapshot({ powers }, { field: 'powers', item: 'p1' }),
      opts
    )
    expect(raise.ok && raise.events[0]?.to).toEqual([
      { id: 'p1', name: 'Visão', value: 3 },
      { id: 'p2', name: 'Velocidade', value: 1 },
    ])
    const fresh = planXpSpend(
      model,
      sheet({ powers }),
      snapshot({ powers }, { field: 'powers', name: 'Força Bruta' }),
      opts
    )
    expect(fresh.ok && fresh.events[0]?.to).toEqual([
      ...powers,
      { id: 'novo', name: 'Força Bruta', value: 1 },
    ])
  })

  it('alvo, preço ou elegibilidade mudados: desatualizado', () => {
    const req = snapshot({ dex: 2 }, { field: 'dex' })
    expect(planXpSpend(model, sheet({ dex: 3 }), req, opts)).toEqual({
      ok: false,
      stale: 'target',
    })
    expect(planXpSpend(model, sheet({ dex: 5 }), req, opts)).toEqual({
      ok: false,
      stale: 'target',
    })
    // A exceção de linhagem muda o preço de um poder
    const powers = [{ id: 'p1', name: 'Velocidade', value: 2 }]
    const power = snapshot({ powers }, { field: 'powers', item: 'p1' })
    expect(
      planXpSpend(model, sheet({ powers, lineage: 'a' }), power, opts)
    ).toEqual({
      ok: false,
      stale: 'price',
    })
    // O Arete baixou: a Esfera não pode mais subir
    const sphere = snapshot({ arete: 3, sphereA: 1 }, { field: 'sphereA' })
    expect(
      planXpSpend(model, sheet({ arete: 1, sphereA: 1 }), sphere, opts)
    ).toEqual({
      ok: false,
      stale: 'eligibility',
    })
    // O item novo já existe
    const fresh = snapshot({}, { field: 'powers', name: 'Visão' })
    expect(
      planXpSpend(
        model,
        sheet({ powers: [{ id: 'x', name: 'Visão', value: 1 }] }),
        fresh,
        opts
      )
    ).toEqual({ ok: false, stale: 'eligibility' })
  })

  it('mudança que não altera preço nem elegibilidade não invalida', () => {
    const req = snapshot({ dex: 2 }, { field: 'dex' })
    const plan = planXpSpend(
      model,
      sheet({ dex: 2, notes: 'outra', str: 4, will: { current: 1 } }),
      req,
      opts
    )
    expect(plan.ok).toBe(true)
  })

  it('sem extrato: desatualizado por elegibilidade', () => {
    const dnd = compileTemplate(templates['dnd5e-2014'])
    expect(
      planXpSpend(
        dnd,
        { values: {} },
        { target: { field: 'str' }, from: 10, cost: 1 },
        opts
      )
    ).toEqual({ ok: false, stale: 'eligibility' })
  })
})

describe('identidade mecânica de itens', () => {
  it('lista com catálogo ou em conta: trocar o nome é evolução', () => {
    expect(hasMechanicalNames(model, 'powers')).toBe(true)
    expect(hasMechanicalNames(model, 'gifts')).toBe(true)
    expect(hasMechanicalNames(model, 'merits')).toBe(true)
    expect(hasMechanicalNames(model, 'name')).toBe(false)
    const before = sheet({ powers: [{ id: 'p1', name: 'Visão', value: 1 }] })
    const rename = classifyBatch(model, before, [
      {
        path: 'values.powers',
        from: before.values.powers,
        to: [{ id: 'p1', name: 'Velocidade', value: 1 }],
      },
    ])
    expect(rename.parts).toEqual([
      { path: 'values.powers#p1.name', kind: 'advance' },
    ])
  })

  it('lista sem catálogo nem conta: o nome continua edição', () => {
    const dnd = compileTemplate(templates['dnd5e-2014'])
    expect(hasMechanicalNames(dnd, 'attacks')).toBe(false)
    expect(hasMechanicalNames(dnd, 'level')).toBe(false)
    const before = { values: { attacks: [{ id: 'a1', name: 'Espada' }] } }
    const rename = classifyBatch(dnd, before, [
      {
        path: 'values.attacks',
        from: before.values.attacks,
        to: [{ id: 'a1', name: 'Machado' }],
      },
    ])
    expect(rename.kind).toBe('edit')
  })

  it('nos WoD, o nome da Disciplina e do Antecedente é mecânico', () => {
    const vtm = compileTemplate(templates['vtm-v20'])
    expect(hasMechanicalNames(vtm, 'disciplines')).toBe(true)
    expect(hasMechanicalNames(vtm, 'backgrounds')).toBe(true)
    expect(hasMechanicalNames(vtm, 'merits')).toBe(false)
  })
})
