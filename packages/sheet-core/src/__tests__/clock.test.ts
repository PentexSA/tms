/// <reference types="bun-types" />
import { describe, expect, it } from 'bun:test'
import fc from 'fast-check'
import { compileTemplate } from '../compile'
import type { ClockField, SheetData } from '../contract'
import { planClock } from '../effects'
import { applyBatch, invert, type SheetEvent } from '../events'
import { describeEvent, withEffectiveFrom } from '../labels'
import { REGISTRY } from '../registry'
import { CLOCK_RULES, gain, isImplementedClockRule, lose } from '../rules/clock'
import { validateSheet } from '../validate'
import { character, mta } from './fixtures'

// Roda de Quintessência e Paradoxo do Mago (M20): 20 casas, a Quintessência
// enche do início e o Paradoxo do fim (contrato §3, `clock`).

const model = compileTemplate(mta())
const wheel = model.fields.get('wheel')?.def as ClockField
const w = (quintessence = 0, paradox = 0) => ({ quintessence, paradox })
const otto = () => character('otto').sheet as unknown as SheetData

describe('mage-quint-paradox (roda)', () => {
  it.each([
    [
      'vazia + Quintessência',
      w(),
      'quintessence',
      1,
      w(1, 0),
      '+1 Quintessência',
    ],
    ['parcial + 3 Paradoxo', w(6, 2), 'paradox', 3, w(6, 5), '+3 Paradoxo'],
    [
      'cheia + Paradoxo: consome Quintessência',
      w(6, 14),
      'paradox',
      1,
      w(5, 15),
      'Sem casa livre: 1 Quintessência virou Paradoxo',
    ],
    [
      'quase cheia + 3 Paradoxo: ocupa a livre e consome 2',
      w(6, 13),
      'paradox',
      3,
      w(4, 16),
      'Sem casa livre: 2 Quintessência virou Paradoxo',
    ],
    [
      'quase cheia + 3 Quintessência: entra só 1',
      w(6, 13),
      'quintessence',
      3,
      w(7, 13),
      '+1 Quintessência (sem casa livre para o resto)',
    ],
  ])('%s', (_, before, fill, n, after, note) => {
    expect(gain(wheel, before, fill, n)).toEqual({
      counts: after,
      changed: true,
      note,
    })
  })

  it.each([
    [
      'cheia + Quintessência: bloqueado',
      w(6, 14),
      'quintessence',
      'Sem casa livre: Quintessência não entra',
    ],
    [
      'toda de Paradoxo + Paradoxo: bloqueado',
      w(0, 20),
      'paradox',
      'Todas as casas já são de Paradoxo',
    ],
    [
      'toda de Quintessência + Quintessência: bloqueado',
      w(20, 0),
      'quintessence',
      'Todas as casas já são de Quintessência',
    ],
  ])('%s', (_, before, fill, note) => {
    expect(gain(wheel, before, fill)).toEqual({
      counts: before,
      changed: false,
      note,
    })
  })

  it('perder tira do preenchimento escolhido, até zero', () => {
    expect(lose(wheel, w(6, 2), 'paradox')).toEqual({
      counts: w(6, 1),
      changed: true,
      note: '−1 Paradoxo',
    })
    expect(lose(wheel, w(2, 0), 'quintessence', 5).counts).toEqual(w(0, 0))
    expect(lose(wheel, w(6, 0), 'paradox')).toEqual({
      counts: w(6, 0),
      changed: false,
      note: 'Nada a tirar: sem Paradoxo',
    })
  })

  it('valor ausente ou malformado conta como roda vazia', () => {
    expect(gain(wheel, undefined, 'paradox').counts).toEqual(w(0, 1))
    expect(
      gain(wheel, { quintessence: -3, paradox: 2.7 }, 'paradox').counts
    ).toEqual(w(0, 3))
  })

  it('preenchimento inexistente ou n inválido não muda nada', () => {
    for (const [fill, n] of [
      ['banal', 1],
      ['__proto__', 1],
      ['paradox', 0],
      ['paradox', 1.5],
    ] as const)
      expect(gain(wheel, w(6, 2), fill, n).changed).toBe(false)
  })

  it('regra fora da implementação fica indisponível, sem lançar', () => {
    const odd = { ...wheel, rule: 'outra' } as unknown as ClockField
    expect(gain(odd, w(6, 2), 'paradox')).toEqual({
      counts: w(6, 2),
      changed: false,
      note: 'regra indisponível',
    })
  })

  it('toda regra da lista fechada tem implementação', () => {
    for (const rule of REGISTRY.clockRules)
      expect(isImplementedClockRule(rule)).toBe(true)
    expect(Object.keys(CLOCK_RULES)).toEqual([...REGISTRY.clockRules])
    expect(isImplementedClockRule('toString')).toBe(false)
  })

  it('propriedade: a soma nunca passa das casas, e a ficha continua válida', () => {
    const op = fc.record({
      lose: fc.boolean(),
      fill: fc.constantFrom('quintessence', 'paradox'),
      n: fc.integer({ min: 1, max: 25 }),
    })
    fc.assert(
      fc.property(fc.array(op, { maxLength: 40 }), ops => {
        let counts: Record<string, number> = w()
        for (const o of ops) {
          const before = counts
          counts = {
            ...(o.lose ? lose : gain)(wheel, counts, o.fill, o.n).counts,
          }
          const total = (counts.quintessence ?? 0) + (counts.paradox ?? 0)
          expect(total).toBeLessThanOrEqual(20)
          for (const x of Object.values(counts))
            expect(x).toBeGreaterThanOrEqual(0)
          // Ganhar Quintessência nunca tira Paradoxo
          if (!o.lose && o.fill === 'quintessence')
            expect(counts.paradox).toBe(before.paradox)
        }
        expect(validateSheet(mta(), { values: { wheel: counts } })).toEqual([])
      })
    )
  })

  it('propriedade: o lote da regra passa no applyBatch e o inverso desfaz', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 20 }),
        fc.integer({ min: 0, max: 20 }),
        fc.constantFrom('quintessence', 'paradox'),
        fc.boolean(),
        (q, p, fill, isLose) => {
          fc.pre(q + p <= 20)
          const sheet = {
            ...otto(),
            values: { ...otto().values, wheel: w(q, p) },
          }
          const change = (isLose ? lose : gain)(wheel, w(q, p), fill)
          fc.pre(change.changed)
          const events: SheetEvent[] = [
            { path: 'values.wheel', from: w(q, p), to: change.counts },
          ]
          const applied = applyBatch(model, sheet, { events }, ['owner'])
          if (!applied.ok) throw new Error(applied.kind)
          const undone = applyBatch(
            model,
            applied.sheet,
            { events: invert(events) },
            ['owner']
          )
          if (!undone.ok) throw new Error(undone.kind)
          expect(undone.sheet.values.wheel).toEqual(w(q, p))
        }
      )
    )
  })
})

describe('rótulos da roda (toast, resumo e histórico)', () => {
  const label = (from: unknown, to: unknown) =>
    describeEvent(model, { path: 'values.wheel', from, to })

  it('um preenchimento leva o nome dele', () => {
    expect(label(w(6, 2), w(6, 3))).toEqual({
      label: 'Paradoxo',
      change: '2 → 3',
    })
  })

  it('os dois mudando: a roda com os dois trechos', () => {
    expect(label(w(6, 14), w(5, 15))).toEqual({
      label: 'Quintessência e Paradoxo',
      change: 'Quintessência 6 → 5, Paradoxo 14 → 15',
    })
  })

  it('sem valor guardado, o "de" efetivo é o padrão (Quintessência = Avatar 2)', () => {
    const sheet = otto()
    const { wheel: _, ...values } = sheet.values
    const [event] = withEffectiveFrom(model, { ...sheet, values }, [
      { path: 'values.wheel', from: null, to: w(3, 0) },
    ])
    expect(event && describeEvent(model, event)).toEqual({
      label: 'Quintessência',
      change: '2 → 3',
    })
  })

  it('sem Avatar nem roda guardada, o "de" efetivo é a roda vazia', () => {
    const sheet = otto()
    const { wheel: _, backgrounds: __, ...values } = sheet.values
    const [event] = withEffectiveFrom(model, { ...sheet, values }, [
      { path: 'values.wheel', from: null, to: w(1, 0) },
    ])
    expect(event && describeEvent(model, event)).toEqual({
      label: 'Quintessência',
      change: '0 → 1',
    })
  })
})

describe('planClock (sheet da roda)', () => {
  it('Paradoxo +1 com a roda cheia: um evento com a roda inteira e a prévia', () => {
    const sheet = otto()
    expect(planClock(model, sheet, 'wheel', 'paradox', 1)).toEqual({
      ok: true,
      events: [{ path: 'values.wheel', from: w(5, 15), to: w(4, 16) }],
      preview: [
        {
          label: 'Quintessência e Paradoxo',
          change: 'Quintessência 5 → 4, Paradoxo 15 → 16',
        },
      ],
      label: 'Sem casa livre: 1 Quintessência virou Paradoxo',
    })
  })

  it('−1 Quintessência', () => {
    expect(planClock(model, otto(), 'wheel', 'quintessence', -1)).toMatchObject(
      {
        ok: true,
        label: '−1 Quintessência',
        events: [{ to: w(4, 15) }],
      }
    )
  })

  it('bloqueio da regra não vira evento vazio', () => {
    expect(planClock(model, otto(), 'wheel', 'quintessence', 1)).toEqual({
      ok: false,
      reason: 'Sem casa livre: Quintessência não entra',
    })
  })

  it('campo que não é roda, ou passo zero', () => {
    expect(planClock(model, otto(), 'health', 'paradox', 1).ok).toBe(false)
    expect(planClock(model, otto(), 'wheel', 'paradox', 0).ok).toBe(false)
  })
})
