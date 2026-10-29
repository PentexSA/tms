/// <reference types="bun-types" />
import { describe, expect, it } from 'bun:test'
import { compileTemplate } from '../compile'
import { costOf, xpBalance, xpLedgerFields, xpTargetKey } from '../costs'
import { acct } from './accounting-fixture'
import { type Json, templates } from './fixtures'

// Preço de evolução por XP (doc/plano-v4.md §3.2), sobre o template
// sintético. Números de teste, não do livro.

const model = compileTemplate(acct())
const sheet = (values: Record<string, unknown> = {}) => ({
  values: { name: 'Teste', lineage: 'b', ...values },
})
const cost = (
  values: Record<string, unknown>,
  target: Parameters<typeof costOf>[2]
) => costOf(model, sheet(values), target)

describe('costOf: preços', () => {
  it('valor atual × fator, um nível por vez', () => {
    expect(cost({ dex: 2 }, { field: 'dex' })).toEqual({
      ok: true,
      target: { field: 'dex' },
      from: 2,
      to: 3,
      cost: 8,
      kind: 'raise',
      context: { rule: 'attribute', when: null, choices: {}, cap: null },
    })
  })

  it('primeiro ponto pelo preço de novo; depois, pelo fator', () => {
    expect(cost({}, { field: 'alert' })).toMatchObject({
      ok: true,
      from: 0,
      to: 1,
      cost: 3,
      kind: 'new',
    })
    expect(cost({ alert: 1 }, { field: 'alert' })).toMatchObject({
      cost: 2,
      kind: 'raise',
    })
  })

  it('a base conta, não o efetivo da Forma', () => {
    expect(cost({ str: 2, form: 'strong' }, { field: 'str' })).toMatchObject({
      from: 2,
      cost: 8,
    })
  })

  it('permanente do recurso, com o padrão de fórmula', () => {
    // Vontade padrão = Consciência
    expect(cost({ con: 3 }, { field: 'will' })).toMatchObject({
      from: 3,
      to: 4,
      cost: 3,
    })
    expect(
      cost({ will: { current: 1, permanent: 5 } }, { field: 'will' })
    ).toMatchObject({ from: 5, cost: 5 })
  })

  it('item de lista existente e item novo', () => {
    const powers = [{ id: 'p1', name: 'Visão', value: 2 }]
    expect(cost({ powers }, { field: 'powers', item: 'p1' })).toMatchObject({
      from: 2,
      to: 3,
      cost: 14,
    })
    expect(
      cost({ powers }, { field: 'powers', name: 'Velocidade' })
    ).toMatchObject({
      from: 0,
      to: 1,
      cost: 10,
      kind: 'new',
    })
  })

  it('exceção por linhagem e catálogo: nome digitado não dá desconto', () => {
    const powers = [{ id: 'p1', name: 'Força Bruta', value: 2 }]
    const a = { lineage: 'a', powers }
    expect(cost(a, { field: 'powers', item: 'p1' })).toMatchObject({
      cost: 10,
      context: { rule: 'power', when: 0, choices: { lineage: 'a' } },
    })
    expect(cost(a, { field: 'powers', name: 'Velocidade' })).toMatchObject({
      cost: 8,
    })
    // Fora do catálogo, ou da lista da linhagem: preço base
    expect(cost(a, { field: 'powers', name: 'velocidade' })).toMatchObject({
      cost: 10,
    })
    expect(cost(a, { field: 'powers', name: 'Visão' })).toMatchObject({
      cost: 10,
    })
    expect(cost({ powers }, { field: 'powers', item: 'p1' })).toMatchObject({
      cost: 14,
    })
  })

  it('afinidade: a opção escolhida é o próprio alvo', () => {
    const v = { arete: 3, sphereA: 1, sphereB: 1, affinity: 'sphereA' }
    expect(cost(v, { field: 'sphereA' })).toMatchObject({
      cost: 7,
      context: { when: 0, cap: 3 },
    })
    expect(cost(v, { field: 'sphereB' })).toMatchObject({
      cost: 8,
      context: { when: null },
    })
  })

  it('exceção que proíbe a compra (linhagem c)', () => {
    expect(cost({ lineage: 'c', app: 0 }, { field: 'app' })).toEqual({
      ok: false,
      code: 'XP_COST_UNAVAILABLE',
      reason: 'excluded',
      target: { field: 'app' },
      from: 0,
    })
    expect(cost({ app: 2 }, { field: 'app' })).toMatchObject({
      ok: true,
      cost: 8,
    })
  })
})

describe('costOf: indisponível e inválido', () => {
  const fail = (
    values: Record<string, unknown>,
    target: Parameters<typeof costOf>[2]
  ) => {
    const r = cost(values, target)
    return r.ok ? null : [r.code, r.reason]
  }

  it('teto do campo e pré-requisito pelo Arete', () => {
    expect(fail({ dex: 5 }, { field: 'dex' })).toEqual([
      'XP_MAX_REACHED',
      'max',
    ])
    expect(fail({ arete: 2, sphereA: 2 }, { field: 'sphereA' })).toEqual([
      'XP_PREREQUISITE',
      'cap',
    ])
  })

  it('preço ausente nunca vira zero', () => {
    // Virtude a partir de 0 sem preço de primeiro ponto
    const t = acct() as Json & { fields: Record<string, Json> }
    t.fields.con = { type: 'rating', label: 'Consciência', min: 0, max: 5 }
    t.templateVersion = '0.2.0'
    const m = compileTemplate(t)
    const r = costOf(m, { values: { con: 0 } }, { field: 'con' })
    expect(r).toMatchObject({
      ok: false,
      code: 'XP_COST_UNAVAILABLE',
      reason: 'no-new-price',
    })
  })

  it('alvos inválidos', () => {
    const powers = [{ id: 'p1', name: 'Visão', value: 1 }]
    expect(fail({}, { field: 'nope' })).toEqual([
      'XP_TARGET_INVALID',
      'unknown-field',
    ])
    expect(fail({}, { field: 'name' })).toEqual([
      'XP_TARGET_INVALID',
      'not-targetable',
    ])
    expect(fail({}, { field: 'xpAvailable' })).toEqual([
      'XP_TARGET_INVALID',
      'not-targetable',
    ])
    expect(fail({}, { field: 'gifts', name: 'X' })).toEqual([
      'XP_COST_UNAVAILABLE',
      'no-rule',
    ])
    expect(fail({}, { field: 'merits', name: 'X' })).toEqual([
      'XP_COST_UNAVAILABLE',
      'no-rule',
    ])
    expect(fail({}, { field: 'dex', item: 'p1' })).toEqual([
      'XP_TARGET_INVALID',
      'not-targetable',
    ])
    expect(fail({ powers }, { field: 'powers', item: 'p9' })).toEqual([
      'XP_TARGET_INVALID',
      'item-not-found',
    ])
    expect(
      fail({ powers }, { field: 'powers', item: 'p1', name: 'X' })
    ).toEqual(['XP_TARGET_INVALID', 'item-name-invalid'])
    expect(fail({ powers }, { field: 'powers' })).toEqual([
      'XP_TARGET_INVALID',
      'item-name-required',
    ])
    expect(fail({ powers }, { field: 'powers', name: 'Visão' })).toEqual([
      'XP_TARGET_INVALID',
      'item-duplicate',
    ])
    expect(fail({}, { field: 'powers', name: '<b>' })).toEqual([
      'XP_TARGET_INVALID',
      'item-name-invalid',
    ])
    expect(fail({}, { field: 'powers', name: '  ' })).toEqual([
      'XP_TARGET_INVALID',
      'item-name-invalid',
    ])
    expect(
      fail(
        { powers: [{ id: 'p1', name: 'Visão', value: 5 }] },
        { field: 'powers', item: 'p1' }
      )
    ).toEqual(['XP_MAX_REACHED', 'max'])
  })

  it('lista fixa não ganha item novo', () => {
    // Ressonância do Mago: lista fixa com pontos
    const { creation: _, ...t } = structuredClone(templates['mta-m20']) as Json
    const r = costOf(
      compileTemplate({
        ...t,
        templateVersion: '9.0.0',
        costs: {
          xp: {
            total: 'xpTotal',
            spent: 'xpSpent',
            rules: [
              {
                id: 'res',
                rule: 'per-current',
                factor: 3,
                new: 5,
                targets: ['resonance'],
              },
            ],
          },
        },
      }),
      { values: {} },
      { field: 'resonance', name: 'Nova' }
    )
    expect(r).toMatchObject({
      ok: false,
      code: 'XP_TARGET_INVALID',
      reason: 'fixed-list',
    })
  })
})

describe('sem `costs.xp`', () => {
  // D&D, CoC e Fate não têm campos nem custos de XP: nada de saldo inventado
  for (const system of ['dnd5e-2014', 'coc7e', 'fate-core']) {
    it(`${system}: indisponível, sem exceção nem preço zero`, () => {
      const m = compileTemplate(templates[system])
      const any = [...m.fields.keys()][0] as string
      expect(costOf(m, { values: {} }, { field: any })).toMatchObject({
        ok: false,
        code: 'XP_COST_UNAVAILABLE',
        reason: 'no-xp',
      })
      expect(xpBalance(m, { values: {} })).toBeNull()
      expect(xpLedgerFields(m)).toEqual([])
    })
  }
})

describe('saldo', () => {
  it('xpBalance e campos do extrato', () => {
    expect(xpBalance(model, sheet({ xpTotal: 12, xpSpent: 5 }))).toEqual({
      total: 12,
      spent: 5,
      available: 7,
    })
    expect(xpBalance(model, null)).toEqual({ total: 0, spent: 0, available: 0 })
    expect(xpLedgerFields(model)).toEqual(['xpTotal', 'xpSpent'])
  })

  it('xpTargetKey: campo, item pelo id e item novo pelo nome', () => {
    expect(xpTargetKey({ field: 'dex' })).toBe('dex')
    expect(xpTargetKey({ field: 'powers', item: 'p1' })).toBe('powers#p1')
    expect(xpTargetKey({ field: 'powers', name: 'Visão' })).toBe('powers@Visão')
  })
})
