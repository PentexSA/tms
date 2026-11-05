/// <reference types="bun-types" />
import { describe, expect, it } from 'bun:test'
import fc from 'fast-check'
import { compileTemplate, type SheetModel } from '../compile'
import { editResource } from '../fields'
import { type ResolvedResource, resolve } from '../resolve'
import { validateSheet } from '../validate'
import { dnd, vtm, wta } from './fixtures'

// T-22: na criação, o atual cheio acompanha o permanente (ou o máximo
// gravado); o atual gasto fica onde está. Fora da criação, o de hoje: o atual
// só desce quando passaria do teto.

type Values = Record<string, unknown>

const v20 = compileTemplate(vtm())
const w20 = compileTemplate(wta())
const d5 = compileTemplate(dnd())

const res = (model: SheetModel, values: Values, id: string) =>
  resolve(model, { values }).get(id) as ResolvedResource

describe('editResource', () => {
  const FOLLOW = { follow: true }
  const STAY = { follow: false }

  it('com follow e o atual cheio, o permanente leva o atual', () => {
    const r = res(v20, { courage: 3 }, 'willpower')
    expect(r).toMatchObject({ permanent: 3, current: 3 })
    expect(editResource(r, 'permanent', 4, FOLLOW)).toEqual({
      permanent: 4,
      current: 4,
    })
    // e desce junto
    expect(editResource(r, 'permanent', 2, FOLLOW)).toEqual({
      permanent: 2,
      current: 2,
    })
  })

  it('com o atual gasto, o atual fica; desce só se passar do teto', () => {
    const r = res(
      v20,
      { courage: 3, willpower: { permanent: 3, current: 2 } },
      'willpower'
    )
    expect(editResource(r, 'permanent', 4, FOLLOW)).toEqual({
      permanent: 4,
      current: 2,
    })
    expect(editResource(r, 'permanent', 1, FOLLOW)).toEqual({
      permanent: 1,
      current: 1,
    })
  })

  it('sem follow, é o de hoje: o atual cheio não sobe', () => {
    const r = res(v20, { courage: 3 }, 'willpower')
    expect(editResource(r, 'permanent', 4, STAY)).toEqual({
      permanent: 4,
      current: 3,
    })
    expect(editResource(r, 'permanent', 2, STAY)).toEqual({
      permanent: 2,
      current: 2,
    })
  })

  it('a linha do atual só muda o atual', () => {
    const r = res(w20, { auspice: 'ahroun' }, 'rage')
    expect(editResource(r, 'current', 3, FOLLOW)).toEqual({
      permanent: 5,
      current: 3,
    })
  })

  it('sem teto (tempUncapped, o Renome), o atual não acompanha', () => {
    const r = res(
      w20,
      { auspice: 'ahroun', glory: { permanent: 2, current: 2 } },
      'glory'
    )
    expect(editResource(r, 'permanent', 3, FOLLOW)).toEqual({
      permanent: 3,
      current: 2,
    })
    expect(editResource(r, 'permanent', 1, FOLLOW)).toEqual({
      permanent: 1,
      current: 2,
    })
  })

  it('overMax: o atual não acompanha nem desce', () => {
    const t = vtm()
    const fields = t.fields as Record<string, Record<string, unknown>>
    fields.willpower = { ...fields.willpower, overMax: true }
    const model = compileTemplate(t)
    const r = res(model, { courage: 3 }, 'willpower')
    expect(editResource(r, 'permanent', 2, FOLLOW)).toEqual({
      permanent: 2,
      current: 3,
    })
  })

  it('o máximo gravado (PV do D&D) acompanha como o permanente', () => {
    const r = res(d5, { hp: { max: 10, current: 10, temp: 0 } }, 'hp')
    expect(editResource(r, 'max', 12, FOLLOW)).toEqual({
      max: 12,
      current: 12,
      temp: 0,
    })
    expect(editResource(r, 'max', 12, STAY)).toEqual({
      max: 12,
      current: 10,
      temp: 0,
    })
    const hurt = res(d5, { hp: { max: 10, current: 6, temp: 0 } }, 'hp')
    expect(editResource(hurt, 'max', 12, FOLLOW)).toEqual({
      max: 12,
      current: 6,
      temp: 0,
    })
    expect(editResource(hurt, 'max', 4, FOLLOW)).toEqual({
      max: 4,
      current: 4,
      temp: 0,
    })
  })

  it('propriedade: partindo de cheio, o atual sempre iguala o permanente, e a ficha valida', () => {
    const template = wta()
    fc.assert(
      fc.property(
        fc.constantFrom('rage', 'gnosis', 'willpower'),
        fc.array(fc.integer({ min: 1, max: 10 }), {
          minLength: 1,
          maxLength: 12,
        }),
        (id, steps) => {
          let values: Values = {
            name: 'Teste',
            breed: 'lupino',
            auspice: 'ahroun',
            tribe: 'fianna',
          }
          for (const n of steps) {
            const next = editResource(res(w20, values, id), 'permanent', n, {
              follow: true,
            })
            expect(next.current).toBe(n)
            expect(next.permanent).toBe(n)
            values = { ...values, [id]: next }
          }
          const issues = validateSheet(template, { values })
          expect(issues.filter(i => i.path.includes(id))).toEqual([])
        }
      )
    )
  })
})
