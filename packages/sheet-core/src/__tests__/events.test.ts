/// <reference types="bun-types" />
import { describe, expect, it } from 'bun:test'
import fc from 'fast-check'
import { compileTemplate } from '../compile'
import type { SheetData } from '../contract'
import { jsonEqual } from '../equal'
import {
  applyBatch,
  diffToBatch,
  invert,
  MAX_EVENTS_PER_BATCH,
  parsePath,
  type SheetEvent,
} from '../events'
import { describeBatch, describeEvent } from '../labels'
import { character, clone, type Json, templates } from './fixtures'

const model = compileTemplate(templates['vtm-v20'])
const dndModel = compileTemplate(templates['dnd5e-2014'])
const OWNER = ['owner'] as const
const helena = () => character('helena').sheet as unknown as SheetData

const ok = (r: ReturnType<typeof applyBatch>) => {
  if (!r.ok) throw new Error(`lote recusado: ${JSON.stringify(r.issues)}`)
  return r.sheet
}

describe('applyBatch: caminho feliz', () => {
  it('gasta 1 Sangue sem mudar a ficha de entrada', () => {
    const sheet = helena()
    const before = clone(sheet)
    const next = ok(
      applyBatch(
        model,
        sheet,
        {
          events: [
            {
              path: 'values.blood',
              from: { current: 9 },
              to: { current: 8 },
            },
          ],
        },
        OWNER
      )
    )
    expect(next.values.blood).toEqual({ current: 8 })
    expect(sheet).toEqual(before)
  })

  it('lote com vários campos é aplicado inteiro (curar com Sangue)', () => {
    const next = ok(
      applyBatch(
        model,
        helena(),
        {
          events: [
            {
              path: 'values.health',
              from: { bashing: 1, lethal: 1, aggravated: 0 },
              to: { bashing: 0, lethal: 1, aggravated: 0 },
            },
            { path: 'values.blood', from: { current: 9 }, to: { current: 8 } },
          ],
        },
        OWNER
      )
    )
    expect(next.values.health).toEqual({ bashing: 0, lethal: 1, aggravated: 0 })
    expect(next.values.blood).toEqual({ current: 8 })
  })

  it('campo ausente tem from null; to null volta ao padrão', () => {
    const sheet = helena()
    const values = { ...sheet.values } as Record<string, unknown>
    delete values.athletics
    const without = { ...sheet, values } as SheetData
    const set = ok(
      applyBatch(
        model,
        without,
        { events: [{ path: 'values.athletics', from: null, to: 2 }] },
        OWNER
      )
    )
    expect(set.values.athletics).toBe(2)
    const reset = ok(
      applyBatch(
        model,
        set,
        { events: [{ path: 'values.athletics', from: 2, to: null }] },
        OWNER
      )
    )
    expect(Object.hasOwn(reset.values, 'athletics')).toBe(false)
  })

  it('especialização: grava e remove', () => {
    const next = ok(
      applyBatch(
        model,
        helena(),
        {
          events: [
            { path: 'specialties.strength', from: null, to: 'Arrombar' },
            {
              path: 'specialties.occult',
              from: 'Hermetismo',
              to: null,
            },
          ],
        },
        OWNER
      )
    )
    expect(next.specialties).toEqual({
      intelligence: 'Memória eidética',
      strength: 'Arrombar',
    })
  })

  it('from compara sem depender da ordem das chaves', () => {
    expect(
      applyBatch(
        model,
        helena(),
        {
          events: [
            {
              path: 'values.health',
              from: { aggravated: 0, lethal: 1, bashing: 1 },
              to: { aggravated: 0, lethal: 2, bashing: 1 },
            },
          ],
        },
        OWNER
      ).ok
    ).toBe(true)
  })
})

describe('applyBatch: fail secure', () => {
  const one = (event: unknown, roles: readonly string[] = OWNER) =>
    applyBatch(model, helena(), { events: [event] }, roles)

  it.each([[null], [42], [{}], [{ events: [] }], [{ events: 'x' }]])(
    'lote malformado é inválido (%p)',
    batch => {
      const r = applyBatch(model, helena(), batch, OWNER)
      expect(r).toMatchObject({ ok: false, kind: 'invalid' })
    }
  )

  it(`lote acima de ${MAX_EVENTS_PER_BATCH} eventos`, () => {
    const events = Array.from({ length: MAX_EVENTS_PER_BATCH + 1 }, () => ({
      path: 'values.blood',
      from: { current: 9 },
      to: { current: 9 },
    }))
    expect(applyBatch(model, helena(), { events }, OWNER)).toMatchObject({
      ok: false,
      kind: 'invalid',
      issues: [{ message: `lote acima de ${MAX_EVENTS_PER_BATCH} eventos` }],
    })
  })

  it.each([
    'values.__proto__',
    'values.constructor',
    'values.blood.current',
    'values.',
    'sheet.blood',
    'specialties',
    'values.blood ',
  ])('caminho hostil ou malformado: %p', path => {
    expect(one({ path, from: null, to: 1 })).toMatchObject({
      ok: false,
      kind: 'invalid',
    })
  })

  it('evento sem to, campo inexistente e caminho repetido', () => {
    expect(one({ path: 'values.blood', from: null })).toMatchObject({
      kind: 'invalid',
      issues: [{ message: 'evento malformado' }],
    })
    expect(one({ path: 'values.isAdmin', from: null, to: true })).toMatchObject(
      { kind: 'invalid', issues: [{ path: 'values.isAdmin' }] }
    )
    const twice = { path: 'values.strength', from: 2, to: 3 }
    expect(
      applyBatch(model, helena(), { events: [twice, twice] }, OWNER)
    ).toMatchObject({
      kind: 'invalid',
      issues: [{ message: 'caminho repetido no lote' }],
    })
  })

  it('campo derivado nunca é gravado (D&D)', () => {
    const lia = character('lia').sheet as unknown as SheetData
    expect(
      applyBatch(
        dndModel,
        lia,
        { events: [{ path: 'values.initiative', from: null, to: 9 }] },
        OWNER
      )
    ).toMatchObject({ ok: false, kind: 'invalid' })
  })

  it('from velho é conflito, com o caminho', () => {
    expect(
      one({ path: 'values.blood', from: { current: 10 }, to: { current: 9 } })
    ).toEqual({
      ok: false,
      kind: 'conflict',
      issues: [
        {
          path: 'values.blood',
          message: 'o valor mudou antes deste lote (conflito)',
        },
      ],
    })
  })

  it('valor fora da regra é recusado pelo validador', () => {
    expect(one({ path: 'values.strength', from: 2, to: 6 })).toEqual({
      ok: false,
      kind: 'invalid',
      issues: [{ path: 'values.strength', message: 'acima do máximo 5' }],
    })
    expect(
      one({ path: 'specialties.name', from: null, to: 'x' })
    ).toMatchObject({ ok: false, kind: 'invalid' })
  })

  it('tudo ou nada: um evento inválido derruba o lote', () => {
    const sheet = helena()
    const r = applyBatch(
      model,
      sheet,
      {
        events: [
          { path: 'values.blood', from: { current: 9 }, to: { current: 8 } },
          { path: 'values.strength', from: 2, to: 6 },
        ],
      },
      OWNER
    )
    expect(r.ok).toBe(false)
    expect(sheet.values.blood).toEqual({ current: 9 })
  })
})

describe('applyBatch: permissões por papel', () => {
  const notes = { path: 'values.storytellerNotes', from: null, to: 'segredo' }
  const blood = {
    path: 'values.blood',
    from: { current: 9 },
    to: { current: 8 },
  }
  const sheet = () => {
    const s = helena()
    const values = { ...s.values } as Record<string, unknown>
    delete values.storytellerNotes
    return { ...s, values } as SheetData
  }

  it.each([
    [['owner'], blood, true],
    [['storyteller'], blood, true],
    [['player'], blood, false],
    [[], blood, false],
    [['admin'], blood, false],
    [['owner'], notes, false],
    [['storyteller'], notes, true],
    [['owner', 'storyteller'], notes, true],
    [['player'], notes, false],
  ] as const)('%p escreve %p → %p', (roles, event, allowed) => {
    const r = applyBatch(model, sheet(), { events: [event] }, roles)
    expect(r.ok).toBe(allowed)
    if (!allowed) expect(r).toMatchObject({ kind: 'forbidden' })
  })

  it('permissão vem antes do conflito (não revela o valor atual)', () => {
    const r = applyBatch(
      model,
      helena(),
      { events: [{ ...notes, from: 'chute' }] },
      ['player']
    )
    expect(r).toMatchObject({ ok: false, kind: 'forbidden' })
  })
})

// Lotes válidos gerados: atributos e habilidades do Vampiro com valores na faixa.
const ratingIds = [...model.fields.values()]
  .filter(f => f.def.type === 'rating')
  .map(f => f.id)
const arbitraryAfter = fc
  .uniqueArray(
    fc.record({
      id: fc.constantFrom(...ratingIds),
      value: fc.integer({ min: 1, max: 5 }),
    }),
    { selector: x => x.id, minLength: 1, maxLength: 12 }
  )
  .map(changes => {
    const after = helena()
    const values = { ...after.values } as Record<string, unknown>
    for (const c of changes) values[c.id] = c.value
    return { ...after, values } as SheetData
  })

describe('propriedades', () => {
  it('diffToBatch leva a ficha de antes à de depois', () => {
    fc.assert(
      fc.property(arbitraryAfter, after => {
        const before = helena()
        const events = diffToBatch(model, before, after)
        if (!events.length) return
        const next = ok(applyBatch(model, before, { events }, OWNER))
        expect(jsonEqual(next.values, after.values)).toBe(true)
      })
    )
  })

  it('aplicar e desfazer devolve a ficha original', () => {
    fc.assert(
      fc.property(arbitraryAfter, after => {
        const before = helena()
        const events = diffToBatch(model, before, after)
        if (!events.length) return
        const next = ok(applyBatch(model, before, { events }, OWNER))
        const back = ok(
          applyBatch(model, next, { events: invert(events) }, OWNER)
        )
        expect(jsonEqual(back.values, before.values)).toBe(true)
        expect(jsonEqual(back.specialties, before.specialties)).toBe(true)
      })
    )
  })

  it('um lote com um evento inválido nunca muda nada', () => {
    fc.assert(
      fc.property(
        arbitraryAfter,
        fc.integer({ min: 8, max: 99 }),
        (after, bad) => {
          const before = helena()
          const events: SheetEvent[] = [
            ...diffToBatch(model, before, after),
            {
              path: 'values.willpower',
              from: { current: 5, permanent: 7 },
              to: { current: bad, permanent: 7 },
            },
          ]
          const r = applyBatch(model, before, { events }, OWNER)
          expect(r.ok).toBe(false)
        }
      )
    )
  })
})

describe('invert e diffToBatch', () => {
  it('invert troca from e to, na ordem inversa', () => {
    expect(
      invert([
        { path: 'values.a', from: 1, to: 2 },
        { path: 'values.b', from: null, to: 'x' },
      ])
    ).toEqual([
      { path: 'values.b', from: 'x', to: null },
      { path: 'values.a', from: 2, to: 1 },
    ])
  })

  it('diffToBatch segue a ordem do template e põe especializações depois', () => {
    const before = helena()
    const after = clone(before) as unknown as {
      values: Json
      specialties: Json
    }
    after.values.occult = 5
    after.values.strength = 3
    after.specialties.strength = 'Arrombar'
    const paths = diffToBatch(model, before, after as unknown as SheetData).map(
      e => e.path
    )
    expect(paths).toEqual([
      'values.strength',
      'values.occult',
      'specialties.strength',
    ])
  })

  it('sem mudança, nenhum evento', () => {
    expect(diffToBatch(model, helena(), helena())).toEqual([])
  })

  it('parsePath', () => {
    expect(parsePath('values.blood')).toEqual({
      scope: 'values',
      fieldId: 'blood',
    })
    expect(parsePath('specialties.occult')).toEqual({
      scope: 'specialties',
      fieldId: 'occult',
    })
    expect(parsePath(null)).toBeNull()
  })
})

describe('rótulos das alterações (toast, resumo e histórico)', () => {
  const label = (event: SheetEvent) => describeEvent(model, event)

  it.each([
    [
      { path: 'values.blood', from: { current: 10 }, to: { current: 9 } },
      { label: 'Sangue', change: '10 → 9' },
    ],
    [
      {
        path: 'values.willpower',
        from: { current: 5, permanent: 7 },
        to: { current: 5, permanent: 8 },
      },
      { label: 'Força de Vontade', change: 'permanente 7 → 8' },
    ],
    [
      {
        path: 'values.health',
        from: { bashing: 1, lethal: 1, aggravated: 0 },
        to: { bashing: 0, lethal: 3, aggravated: 0 },
      },
      { label: 'Vitalidade', change: '+2 letal, −1 contusivo' },
    ],
    [
      { path: 'values.strength', from: 2, to: 3 },
      { label: 'Força', change: '2 → 3' },
    ],
    [
      { path: 'values.athletics', from: null, to: 1 },
      { label: 'Esportes', change: '0 → 1' },
    ],
    [
      { path: 'values.clan', from: 'tremere', to: 'brujah' },
      { label: 'Clã', change: 'Tremere → Brujah' },
    ],
    [
      { path: 'values.disciplines', from: [{}, {}, {}], to: [{}, {}, {}, {}] },
      { label: 'Disciplinas', change: '3 → 4 itens' },
    ],
    [
      { path: 'values.generation', from: 13, to: 12 },
      { label: 'Geração', change: '13 → 12' },
    ],
  ])('%p', (event, expected) => {
    expect(label(event)).toEqual(expected)
  })

  it('nunca repete texto escrito pelo jogador', () => {
    const secret = 'Deve um favor ao Primógeno'
    for (const event of [
      { path: 'values.notes', from: secret, to: `${secret}!` },
      { path: 'values.storytellerNotes', from: null, to: secret },
      { path: 'values.name', from: secret, to: 'x' },
      { path: 'specialties.occult', from: secret, to: 'y' },
    ]) {
      const text = JSON.stringify(label(event))
      expect(text).not.toContain(secret)
    }
    expect(label({ path: 'values.notes', from: 'a', to: 'b' })).toEqual({
      label: 'Notas',
      change: 'atualizado',
    })
    expect(label({ path: 'specialties.occult', from: 'a', to: 'b' })).toEqual({
      label: 'Ocultismo · especialização',
      change: 'atualizada',
    })
  })

  it('describeBatch: um evento ou "N alterações"', () => {
    expect(
      describeBatch(model, [
        { path: 'values.blood', from: { current: 10 }, to: { current: 9 } },
      ])
    ).toBe('Sangue 10 → 9')
    expect(
      describeBatch(model, [
        { path: 'values.strength', from: 2, to: 3 },
        { path: 'values.occult', from: 4, to: 5 },
      ])
    ).toBe('2 alterações')
  })

  it('outros tipos (D&D e Mago) têm rótulo sem quebrar', () => {
    const d = (path: string, from: unknown, to: unknown) =>
      describeEvent(dndModel, { path, from, to }).change
    expect(d('values.conditions', [], ['cego'])).toBe('0 → 1 marcada')
    expect(d('values.saveStr', 'none', 'proficient')).toMatch(/→/)
    expect(
      d(
        'values.deathSaves',
        { successes: [false, false, false] },
        { successes: [true, false, false] }
      )
    ).toBe('0 → 1 marcadas')
    expect(
      d('values.hp', { current: 27, temp: 5 }, { current: 27, temp: 2 })
    ).toBe('temporários 5 → 2')
    expect(
      d('values.hp', { current: 27, max: 27 }, { current: 27, max: 30 })
    ).toBe('máximo 27 → 30')
    expect(d('values.spellSlots', {}, { '1': { max: 4, used: 1 } })).toBe(
      'alterado'
    )
    expect(
      describeEvent(dndModel, { path: 'values.x', from: 1, to: 2 })
    ).toEqual({
      label: 'Campo',
      change: 'alterado',
    })
  })
})

describe('jsonEqual', () => {
  it.each([
    [{ a: 1, b: 2 }, { b: 2, a: 1 }, true],
    [{ a: 1, b: null }, { a: 1 }, true],
    [null, undefined, true],
    [[1, 2], [2, 1], false],
    [[1, 2], [1, 2], true],
    [{ a: [1] }, { a: { 0: 1 } }, false],
    [1, '1', false],
    [{ a: 1 }, { a: 1, b: 2 }, false],
    [{ a: 1 }, null, false],
  ])('%p = %p → %p', (a, b, expected) => {
    expect(jsonEqual(a, b)).toBe(expected)
  })
})
