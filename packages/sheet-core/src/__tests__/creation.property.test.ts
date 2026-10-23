/// <reference types="bun-types" />
import { describe, expect, it } from 'bun:test'
import fc from 'fast-check'
import { compileTemplate } from '../compile'
import { costOf } from '../costs'
import {
  type CreationCheck,
  type CreationChoices,
  checkCreation,
  effectiveCreationConfig,
} from '../creation'
import { stored } from '../fields'
import { resolve } from '../resolve'
import { ACCT_ABILITIES, ACCT_ATTRIBUTES, acct } from './accounting-fixture'
import { dnd } from './fixtures'

// Propriedades da contabilização (doc/plano-v4.md §6.1), geradas dentro de
// domínios válidos do template sintético.

const model = compileTemplate(acct())
const config = effectiveCreationConfig(model)
type Values = Record<string, unknown>

const item = (prefix: string, i: number, extra: Values) => ({
  id: `${prefix}${i}`,
  ...extra,
})
const arbSheet: fc.Arbitrary<Values> = fc
  .record({
    lineage: fc.constantFrom('a', 'b', 'c'),
    form: fc.constantFrom('normal', 'strong'),
    attrs: fc.array(fc.integer({ min: 1, max: 5 }), {
      minLength: ACCT_ATTRIBUTES.length,
      maxLength: ACCT_ATTRIBUTES.length,
    }),
    app: fc.option(fc.integer({ min: 0, max: 5 }), { nil: undefined }),
    abilities: fc.array(fc.integer({ min: 0, max: 5 }), {
      minLength: ACCT_ABILITIES.length,
      maxLength: ACCT_ABILITIES.length,
    }),
    powers: fc.array(
      fc.record({
        name: fc.constantFrom('Força Bruta', 'Velocidade', 'Visão', 'Outro'),
        value: fc.integer({ min: 0, max: 5 }),
      }),
      { maxLength: 3 }
    ),
    gifts: fc.integer({ min: 0, max: 4 }),
    con: fc.integer({ min: 1, max: 5 }),
    ctl: fc.integer({ min: 1, max: 5 }),
    morality: fc.option(fc.integer({ min: 0, max: 10 }), { nil: undefined }),
    arete: fc.integer({ min: 1, max: 4 }),
    sphereA: fc.integer({ min: 0, max: 5 }),
    merits: fc.array(fc.integer({ min: 1, max: 7 }), { maxLength: 3 }),
    flaws: fc.array(fc.integer({ min: 1, max: 7 }), { maxLength: 3 }),
  })
  .map(r => {
    const values: Values = {
      name: 'P',
      lineage: r.lineage,
      form: r.form,
      con: r.con,
      ctl: r.ctl,
      arete: r.arete,
      sphereA: r.sphereA,
      powers: r.powers.map((p, i) => item('p', i, p)),
      gifts: Array.from({ length: r.gifts }, (_, i) =>
        item('g', i, { name: `D${i}` })
      ),
      merits: r.merits.map((cost, i) =>
        item('m', i, { name: `Q${i}`, meta: { cost } })
      ),
      flaws: r.flaws.map((bonus, i) =>
        item('f', i, { name: `F${i}`, meta: { bonus } })
      ),
    }
    ACCT_ATTRIBUTES.forEach((id, i) => {
      if (id !== 'app') values[id] = r.attrs[i]
    })
    if (r.app !== undefined) values.app = r.app
    ACCT_ABILITIES.forEach((id, i) => {
      values[id] = r.abilities[i]
    })
    if (r.morality !== undefined) values.morality = r.morality
    return values
  })

const arbChoices: fc.Arbitrary<CreationChoices> = fc.record({
  priorities: fc.record(
    {
      attributes: fc.shuffledSubarray(['phys', 'soc', 'men'], {
        minLength: 3,
        maxLength: 3,
      }),
      abilities: fc.shuffledSubarray(['talents', 'knowledges'], {
        minLength: 2,
        maxLength: 2,
      }),
    },
    { requiredKeys: [] }
  ),
})

const run = (values: Values, choices: CreationChoices) =>
  checkCreation(model, { values }, { config, choices })

// O que importa da conta, sem a ordem dos componentes
const summary = (c: CreationCheck) => ({
  complete: c.complete,
  savable: c.savable,
  freebies: c.freebies,
  groups: c.budgets.flatMap(b =>
    b.groups.map(g => [
      b.id,
      g.id,
      g.budget,
      g.invested,
      g.basic,
      g.extra,
      g.freebieCost,
    ])
  ),
  lines: c.lines.map(l => [l.id, l.units, l.cost]),
  problems: c.problems
    .map(p => [
      p.code,
      p.severity,
      p.group ?? '',
      p.amount ?? 0,
      [...p.paths].sort(),
    ])
    .sort(),
})

const shuffleKeys = (values: Values, seed: number): Values => {
  const keys = Object.keys(values)
  const out: Values = {}
  const order = keys
    .map((k, i) => [k, (i * 7919 + seed) % 101] as const)
    .sort((a, b) => a[1] - b[1])
  for (const [k] of order) {
    const v = values[k]
    out[k] = Array.isArray(v) ? [...v].reverse() : v
  }
  return out
}

describe('propriedades de checkCreation', () => {
  it('custos e contadores nunca negativos; savable/complete coerentes', () => {
    fc.assert(
      fc.property(arbSheet, arbChoices, (values, choices) => {
        const c = run(values, choices)
        for (const g of c.budgets.flatMap(b => b.groups)) {
          expect(g.invested).toBeGreaterThanOrEqual(0)
          expect(g.basic).toBeGreaterThanOrEqual(0)
          expect(g.missing).toBeGreaterThanOrEqual(0)
          expect(g.extra).toBeGreaterThanOrEqual(0)
          expect(g.freebieCost).toBeGreaterThanOrEqual(0)
        }
        for (const l of c.lines) expect(l.cost).toBeGreaterThanOrEqual(0)
        expect(c.freebies?.spent).toBeGreaterThanOrEqual(0)
        expect(c.savable).toBe(!c.problems.some(p => p.severity === 'blocking'))
        expect(c.complete).toBe(c.problems.length === 0)
      })
    )
  })

  it('a ordem dos campos e dos itens não muda a conta', () => {
    fc.assert(
      fc.property(
        arbSheet,
        arbChoices,
        fc.nat(100),
        (values, choices, seed) => {
          expect(summary(run(shuffleKeys(values, seed), choices))).toEqual(
            summary(run(values, choices))
          )
        }
      )
    )
  })

  it('mesma entrada, mesma conta (cliente e servidor usam a mesma função)', () => {
    fc.assert(
      fc.property(arbSheet, arbChoices, (values, choices) => {
        const copy = JSON.parse(JSON.stringify(values)) as Values
        expect(run(copy, choices)).toEqual(run(values, choices))
      })
    )
  })

  it('subir e descer o mesmo ponto devolve o saldo', () => {
    fc.assert(
      fc.property(
        arbSheet,
        arbChoices,
        fc.constantFrom(
          ...ACCT_ATTRIBUTES.filter(a => a !== 'app'),
          ...ACCT_ABILITIES
        ),
        (values, choices, id) => {
          const v = values[id] as number
          if (v >= 5) return
          const up = run({ ...values, [id]: v + 1 }, choices)
          const back = run({ ...values, [id]: v }, choices)
          expect(back).toEqual(run(values, choices))
          // Subir nunca diminui o gasto de bônus
          expect(up.freebies?.spent ?? 0).toBeGreaterThanOrEqual(
            back.freebies?.spent ?? 0
          )
        }
      )
    )
  })

  it('ausente e materializado com o mesmo valor dão a mesma conta', () => {
    fc.assert(
      fc.property(
        arbSheet,
        arbChoices,
        fc.constantFrom('app', 'morality', 'will'),
        (values, choices, id) => {
          const without = { ...values }
          delete without[id]
          const r = resolve(model, { values: without })
          const field = r.get(id)
          if (!field) return
          const materialized = { ...without, [id]: stored(field, r) }
          expect(summary(run(materialized, choices))).toEqual(
            summary(run(without, choices))
          )
        }
      )
    )
  })

  it('modificador temporário não gera investimento nem desconto', () => {
    fc.assert(
      fc.property(arbSheet, arbChoices, (values, choices) => {
        expect(run({ ...values, form: 'strong' }, choices)).toEqual(
          run({ ...values, form: 'normal' }, choices)
        )
        const target = { field: 'str' }
        expect(
          costOf(model, { values: { ...values, form: 'strong' } }, target)
        ).toEqual(
          costOf(model, { values: { ...values, form: 'normal' } }, target)
        )
      })
    )
  })

  it('créditos não dão saldo ilimitado', () => {
    fc.assert(
      fc.property(arbSheet, arbChoices, (values, choices) => {
        const f = run(values, choices).freebies
        expect(f?.credit).toBeLessThanOrEqual(3)
        expect(f?.remaining).toBeLessThanOrEqual((f?.available ?? 0) + 3)
      })
    )
  })

  it('custo de XP válido é positivo e sobe um nível', () => {
    const targets = [
      ...ACCT_ATTRIBUTES,
      ...ACCT_ABILITIES,
      'con',
      'morality',
      'will',
      'arete',
      'sphereA',
    ]
    fc.assert(
      fc.property(arbSheet, fc.constantFrom(...targets), (values, field) => {
        const r = costOf(model, { values }, { field })
        if (!r.ok) return
        expect(r.cost).toBeGreaterThan(0)
        expect(r.to).toBe(r.from + 1)
      })
    )
  })
})

describe('propriedades do point-buy (D&D)', () => {
  const m = compileTemplate(dnd())
  const c = effectiveCreationConfig(m)
  const TABLE = [0, 1, 2, 3, 4, 5, 7, 9]
  const IDS = ['str', 'dex', 'con', 'int', 'wis', 'cha']
  it('o gasto é a soma da tabela, em qualquer ordem', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 8, max: 15 }), {
          minLength: 6,
          maxLength: 6,
        }),
        scores => {
          const values = Object.fromEntries(IDS.map((id, i) => [id, scores[i]]))
          const reversed = Object.fromEntries(
            IDS.map((id, i) => [id, scores[5 - i]])
          )
          const total = scores.reduce((n, s) => n + (TABLE[s - 8] ?? 0), 0)
          const a = checkCreation(m, { values }, { config: c })
          const b = checkCreation(m, { values: reversed }, { config: c })
          expect(a.budgets[0]?.groups[0]?.invested).toBe(total)
          expect(b.budgets[0]?.groups[0]?.invested).toBe(total)
          expect(a.complete).toBe(total === 27)
          expect(a.savable).toBe(total <= 27)
        }
      )
    )
  })
})
