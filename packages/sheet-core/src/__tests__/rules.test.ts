/// <reference types="bun-types" />
import { describe, expect, it } from 'bun:test'
import fc from 'fast-check'
import { compileTemplate } from '../compile'
import type {
  ResourceAction,
  SheetData,
  TemplateAction,
  TrackField,
} from '../contract'
import {
  IMPLEMENTED_EFFECTS,
  planAction,
  planDamage,
  planDefaultAction,
} from '../effects'
import { applyBatch } from '../events'
import { withEffectiveFrom } from '../labels'
import { type ResolvedResource, resolve } from '../resolve'
import { gain, setCurrent, spend, takeDamage } from '../rules/resource'
import { damage, heal } from '../rules/wod-stacking'
import { validateSheet } from '../validate'
import { character, templates } from './fixtures'

const model = compileTemplate(templates['vtm-v20'])
const dndModel = compileTemplate(templates['dnd5e-2014'])
const health = model.fields.get('health')?.def as TrackField
const helena = () => character('helena').sheet as unknown as SheetData
const withValues = (values: Record<string, unknown>): SheetData => {
  const s = helena()
  return { ...s, values: { ...s.values, ...values } } as SheetData
}

// Vitalidade da V20: 7 níveis; agravado, letal, contusivo (do mais grave).
const h = (aggravated = 0, lethal = 0, bashing = 0) => ({
  aggravated,
  lethal,
  bashing,
})

describe('wod-stacking (Vitalidade)', () => {
  it.each([
    [
      'vazia + 1 contusivo',
      h(),
      'bashing',
      1,
      h(0, 0, 1),
      '+1 nível contusivo',
    ],
    ['vazia + 2 letais', h(), 'lethal', 2, h(0, 2, 0), '+2 níveis letal'],
    [
      'cheia de contusivo + contusivo: vira letal',
      h(0, 0, 7),
      'bashing',
      1,
      h(0, 1, 6),
      'Trilha cheia: contusivo a mais virou letal',
    ],
    [
      'cheia de letal + agravado',
      h(0, 7, 0),
      'aggravated',
      1,
      h(1, 6, 0),
      '+1 nível agravado',
    ],
    [
      'cheia com 1 contusivo + letal: o letal toma a caixa',
      h(0, 6, 1),
      'lethal',
      1,
      h(0, 7, 0),
      '+1 nível letal',
    ],
    [
      'quase cheia + 2 letais: ocupa a última e troca um contusivo',
      h(0, 0, 6),
      'lethal',
      2,
      h(0, 2, 5),
      '+2 níveis letal',
    ],
  ])('%s', (_, before, type, n, after, note) => {
    expect(damage(health, before, type, n)).toEqual({
      counts: after,
      changed: true,
      note,
    })
  })

  it.each([
    ['contusivo numa trilha cheia de letal', h(0, 7, 0), 'bashing'],
    ['letal numa trilha cheia de agravado', h(7, 0, 0), 'lethal'],
  ])('nunca cria dano mais grave: %s', (_, before, type) => {
    expect(damage(health, before, type, 1)).toEqual({
      counts: before,
      changed: false,
      note: `Vitalidade cheia: ${type === 'bashing' ? 'contusivo' : 'letal'} não muda a trilha`,
    })
  })

  it('curar remove do tipo escolhido', () => {
    expect(heal(health, h(0, 1, 1), 'bashing')).toEqual({
      counts: h(0, 1, 0),
      changed: true,
      note: 'Curou 1 nível contusivo',
    })
    expect(heal(health, h(0, 1, 1), 'aggravated')).toEqual({
      counts: h(0, 1, 1),
      changed: false,
      note: 'Nada a curar: sem dano agravado',
    })
  })

  it('valor guardado ausente ou malformado vale trilha vazia', () => {
    expect(damage(health, undefined, 'lethal').counts).toEqual(h(0, 1, 0))
    expect(
      damage(health, { lethal: -3, bashing: 2.7 } as never, 'lethal').counts
    ).toEqual(h(0, 1, 2))
  })

  it.each([
    ['tipo inexistente', 'fire', 1],
    ['zero', 'lethal', 0],
    ['negativo', 'lethal', -1],
    ['fração', 'lethal', 1.5],
  ])('entrada inválida não muda nada: %s', (_, type, n) => {
    expect(damage(health, h(0, 1, 0), type, n).changed).toBe(false)
  })

  it('n gigante é limitado pelo número de níveis', () => {
    expect(damage(health, h(), 'aggravated', 1_000_000).counts).toEqual(
      h(7, 0, 0)
    )
  })

  it('qualquer sequência de dano e cura fica dentro da regra', () => {
    const op = fc.record({
      heal: fc.boolean(),
      type: fc.constantFrom('aggravated', 'lethal', 'bashing'),
      n: fc.integer({ min: 1, max: 9 }),
    })
    fc.assert(
      fc.property(fc.array(op, { maxLength: 30 }), ops => {
        let counts: Record<string, number> = h()
        for (const o of ops) {
          const before = counts
          counts = {
            ...(o.heal ? heal : damage)(health, counts, o.type, o.n).counts,
          }
          const total = Object.values(counts).reduce((s, x) => s + x, 0)
          expect(total).toBeLessThanOrEqual(7)
          for (const x of Object.values(counts))
            expect(x).toBeGreaterThanOrEqual(0)
          // O agravado só cresce com dano agravado
          if (!o.heal && o.type !== 'aggravated')
            expect(counts.aggravated).toBe(before.aggravated)
        }
        expect(
          validateSheet(templates['vtm-v20'], { values: { health: counts } })
        ).toEqual([])
      })
    )
  })
})

describe('resource', () => {
  const r = (id: string, values = {}, m = model) =>
    resolve(m, withValues(values)).get(id) as ResolvedResource

  it('gastar e recuperar respeitam 0 e o teto', () => {
    expect(spend(r('blood'), 3)).toEqual({ current: 6 })
    expect(spend(r('blood'), 99)).toEqual({ current: 0 })
    expect(gain(r('blood'), 99)).toEqual({ current: 15 })
    expect(gain(r('willpower'), 9)).toEqual({ current: 7, permanent: 7 })
    expect(setCurrent(r('blood'), 40)).toEqual({ current: 15 })
    expect(setCurrent(r('blood'), -2)).toEqual({ current: 0 })
  })

  it('PV do D&D: o dano consome primeiro os temporários', () => {
    const lia = character('lia').sheet as unknown as SheetData
    const hp = resolve(dndModel, lia).get('hp') as ResolvedResource
    expect(takeDamage(hp, 3)).toEqual({ current: 27, max: 27, temp: 2 })
    expect(takeDamage(hp, 8)).toEqual({ current: 24, max: 27, temp: 0 })
  })

  it('sem tempFirst, dano é gasto', () => {
    expect(takeDamage(r('blood'), 2)).toEqual({ current: 7 })
  })
})

describe('ações do template', () => {
  const vtmActions = model.template.actions ?? []
  const wake = vtmActions.find(a => a.id === 'wake') as TemplateAction
  const bloodDef = model.fields.get('blood')?.def
  const heal1 = (
    bloodDef?.type === 'resource' ? bloodDef.actions?.[0] : undefined
  ) as ResourceAction
  const mustApply = (sheet: SheetData, events: readonly unknown[]) => {
    const r = applyBatch(model, sheet, { events }, ['owner'])
    if (!r.ok) throw new Error(JSON.stringify(r.issues))
    return r.sheet
  }

  it('Despertar gasta 1 Sangue, com prévia', () => {
    const plan = planAction(model, helena(), wake)
    expect(plan).toEqual({
      ok: true,
      events: [
        { path: 'values.blood', from: { current: 9 }, to: { current: 8 } },
      ],
      preview: [{ label: 'Sangue', change: '9 → 8' }],
      label: 'Despertar (nova noite)',
    })
    if (plan.ok)
      expect(mustApply(helena(), plan.events).values.blood).toEqual({
        current: 8,
      })
  })

  it('Despertar sem Sangue fica indisponível', () => {
    expect(
      planAction(model, withValues({ blood: { current: 0 } }), wake)
    ).toEqual({
      ok: false,
      reason: 'Sem pontos de sangue para gastar',
    })
  })

  it('Curar 1 nível por 1 Sangue: letal antes de contusivo, num lote só', () => {
    const plan = planAction(model, helena(), heal1, 'blood')
    expect(plan).toMatchObject({
      ok: true,
      label: 'Curou 1 nível letal (1 Sangue)',
      events: [
        {
          path: 'values.health',
          to: { aggravated: 0, lethal: 0, bashing: 1 },
        },
        { path: 'values.blood', from: { current: 9 }, to: { current: 8 } },
      ],
    })
    if (plan.ok) {
      const next = mustApply(helena(), plan.events)
      expect(next.values.health).toEqual(h(0, 0, 1))
    }
  })

  it('Curar não toca no agravado e cobra o custo', () => {
    expect(
      planAction(model, withValues({ health: h(2, 0, 0) }), heal1, 'blood')
    ).toEqual({ ok: false, reason: 'Nada a curar com este recurso' })
    expect(
      planAction(model, withValues({ blood: { current: 0 } }), heal1, 'blood')
    ).toEqual({ ok: false, reason: 'Sangue insuficiente' })
  })

  it('efeitos sem implementação ficam indisponíveis', () => {
    for (const effect of ['rest.long', 'rest.short'] as const)
      expect(
        planAction(model, helena(), { id: 'x', label: 'X', effect })
      ).toEqual({ ok: false, reason: 'Ainda não disponível nesta versão' })
  })

  it('recurso inexistente ou trilha errada', () => {
    expect(
      planAction(model, helena(), {
        id: 'x',
        label: 'X',
        effect: 'resource.spend',
        params: { field: 'strength', amount: 1 },
      })
    ).toEqual({ ok: false, reason: 'Recurso inexistente' })
    expect(
      planAction(model, helena(), {
        id: 'x',
        label: 'X',
        effect: 'health.heal',
        params: { field: 'blood', types: ['lethal'] },
      })
    ).toEqual({ ok: false, reason: 'Trilha inexistente' })
  })

  it('recuperar até o teto', () => {
    const gainWp: TemplateAction = {
      id: 'g',
      label: 'Recuperar FdV',
      effect: 'resource.gain',
      params: { field: 'willpower', amount: 1 },
    }
    expect(planAction(model, helena(), gainWp)).toMatchObject({
      ok: true,
      events: [{ to: { current: 6, permanent: 7 } }],
    })
    expect(
      planAction(
        model,
        withValues({ willpower: { current: 7, permanent: 7 } }),
        gainWp
      )
    ).toEqual({ ok: false, reason: 'Força de Vontade já está no máximo' })
  })
})

describe('Regenerar (Lobisomem, ação do menu sem custo)', () => {
  const wta = compileTemplate(templates['wta-w20'])
  const regenerate = wta.template.actions?.find(
    a => a.id === 'regenerate'
  ) as TemplateAction
  const taina = () => character('taina').sheet as unknown as SheetData

  it('cura 1 nível letal antes do contusivo, sem gastar recurso', () => {
    const plan = planAction(wta, taina(), regenerate)
    expect(plan).toMatchObject({
      ok: true,
      events: [
        {
          path: 'values.health',
          to: { aggravated: 1, lethal: 1, bashing: 1 },
        },
      ],
    })
  })

  it('o agravado fica: só com agravado, nada a curar', () => {
    const s = taina()
    const sheet = {
      ...s,
      values: { ...s.values, health: { aggravated: 2, lethal: 0, bashing: 0 } },
    } as SheetData
    expect(planAction(wta, sheet, regenerate)).toEqual({
      ok: false,
      reason: 'Nada a curar: sem dano contusivo ou letal',
    })
  })
})

describe('ação padrão do dock (toque longo)', () => {
  it('spend1 no Sangue e na FdV', () => {
    expect(planDefaultAction(model, helena(), 'blood')).toMatchObject({
      ok: true,
      label: 'Gastar 1 Sangue',
      events: [{ to: { current: 8 } }],
    })
    expect(planDefaultAction(model, helena(), 'willpower')).toMatchObject({
      ok: true,
      events: [{ to: { current: 4, permanent: 7 } }],
    })
    expect(
      planDefaultAction(model, withValues({ blood: { current: 0 } }), 'blood')
    ).toEqual({ ok: false, reason: 'Sem Sangue para gastar' })
  })

  it('Sangue no padrão: o from cru é null, a prévia mostra o efetivo', () => {
    // 13ª geração e nada guardado: 10 de 10
    const fresh = { values: { name: 'Nova' }, specialties: {} } as SheetData
    const plan = planDefaultAction(model, fresh, 'blood')
    expect(plan).toMatchObject({
      ok: true,
      events: [{ path: 'values.blood', from: null, to: { current: 9 } }],
      preview: [{ label: 'Sangue', change: '10 → 9' }],
    })
  })

  it('withEffectiveFrom: só preenche o que não tem valor guardado', () => {
    const sheet = {
      values: { name: 'Nova', strength: 3 },
      specialties: {},
    } as SheetData
    expect(
      withEffectiveFrom(model, sheet, [
        { path: 'values.blood', from: null, to: { current: 9 } },
        { path: 'values.strength', from: 3, to: 4 },
        { path: 'values.dexterity', from: null, to: 2 },
        // Texto nunca ganha conteúdo; especialização e caminho ruim ficam
        { path: 'values.notes', from: null, to: 'x' },
        { path: 'specialties.occult', from: null, to: 'x' },
        { path: 'values.naoExiste', from: null, to: 1 },
        { path: 'lixo', from: null, to: 1 },
      ])
    ).toEqual([
      { path: 'values.blood', from: { current: 10 }, to: { current: 9 } },
      { path: 'values.strength', from: 3, to: 4 },
      { path: 'values.dexterity', from: 1, to: 2 },
      { path: 'values.notes', from: null, to: 'x' },
      { path: 'specialties.occult', from: null, to: 'x' },
      { path: 'values.naoExiste', from: null, to: 1 },
      { path: 'lixo', from: null, to: 1 },
    ])
  })

  it('sem ação padrão (Vitalidade abre o sheet)', () => {
    expect(planDefaultAction(model, helena(), 'health')).toEqual({
      ok: false,
      reason: 'Sem ação padrão',
    })
    expect(planDefaultAction(model, helena(), 'naoExiste')).toEqual({
      ok: false,
      reason: 'Campo inexistente',
    })
  })

  it('D&D: damage1 nos PV (temporários antes) e use1 nos espaços', () => {
    const lia = character('lia').sheet as unknown as SheetData
    expect(planDefaultAction(dndModel, lia, 'hp')).toMatchObject({
      ok: true,
      events: [{ to: { current: 27, temp: 4 } }],
    })
    expect(planDefaultAction(dndModel, lia, 'spellSlots')).toMatchObject({
      ok: true,
      label: 'Usou 1 espaço de 1º nível',
    })
    const dead = {
      ...lia,
      values: { ...lia.values, hp: { current: 0, max: 27, temp: 0 } },
    } as SheetData
    expect(planDefaultAction(dndModel, dead, 'hp')).toEqual({
      ok: false,
      reason: 'PV já está em 0',
    })
  })

  it('gain1 respeita o teto', () => {
    const t = structuredClone(templates['vtm-v20']) as {
      fields: Record<string, Record<string, unknown>>
    }
    const blood = t.fields.blood
    if (blood) blood.defaultAction = 'gain1'
    const m = compileTemplate(t)
    expect(planDefaultAction(m, helena(), 'blood')).toMatchObject({
      ok: true,
      label: 'Recuperar 1 Sangue',
    })
    expect(
      planDefaultAction(m, withValues({ blood: { current: 15 } }), 'blood')
    ).toEqual({ ok: false, reason: 'Sangue já está no máximo' })
  })
})

describe('planDamage (sheet da Vitalidade)', () => {
  it('+1 letal e −1 contusivo, com o aviso da regra', () => {
    expect(planDamage(model, helena(), 'health', 'lethal', 1)).toMatchObject({
      ok: true,
      label: '+1 nível letal',
      events: [{ path: 'values.health', to: h(0, 2, 1) }],
    })
    expect(planDamage(model, helena(), 'health', 'bashing', -1)).toMatchObject({
      ok: true,
      label: 'Curou 1 nível contusivo',
    })
  })

  it('trilha cheia de letal: contusivo não vira evento vazio', () => {
    expect(
      planDamage(
        model,
        withValues({ health: h(0, 7, 0) }),
        'health',
        'bashing',
        1
      )
    ).toEqual({
      ok: false,
      reason: 'Vitalidade cheia: contusivo não muda a trilha',
    })
  })

  it('campo que não é trilha wod-stacking', () => {
    expect(planDamage(model, helena(), 'blood', 'lethal', 1).ok).toBe(false)
    expect(planDamage(model, helena(), 'health', 'lethal', 0).ok).toBe(false)
  })
})

describe('IMPLEMENTED_EFFECTS', () => {
  it('lista o que o planAction aplica; o resto a UI esconde', () => {
    expect([...IMPLEMENTED_EFFECTS].sort()).toEqual([
      'health.heal',
      'resource.gain',
      'resource.restore',
      'resource.spend',
    ])
    // Os descansos do D&D ainda não têm efeito nesta versão
    const actions = dndModel.template.actions ?? []
    expect(actions.length).toBeGreaterThan(0)
    for (const action of actions) {
      expect(IMPLEMENTED_EFFECTS.has(action.effect)).toBe(false)
      expect(planAction(dndModel, { values: {} } as SheetData, action)).toEqual(
        { ok: false, reason: 'Ainda não disponível nesta versão' }
      )
    }
  })
})
