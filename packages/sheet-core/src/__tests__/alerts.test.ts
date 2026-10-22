/// <reference types="bun-types" />
import { describe, expect, it } from 'bun:test'
import { alertsOf } from '../alerts'
import { compileTemplate } from '../compile'
import type { SheetData } from '../contract'
import { resolve } from '../resolve'
import { character, type Json, templates, vtm } from './fixtures'

// v3, Etapa 8: o template diz quando uma linha da Mesa merece atenção; o core
// calcula. O mesmo código no WoD e no fixture de D&D.

const model = (system: string) => compileTemplate(templates[system])
const ST = ['storyteller'] as const

const sheetOf = (id: string, values: Record<string, unknown> = {}) => {
  const s = character(id).sheet as unknown as SheetData
  return { ...s, values: { ...s.values, ...values } } as SheetData
}
const ids = (system: string, sheet: SheetData, roles: readonly string[] = ST) =>
  alertsOf(model(system), sheet, roles).map(a => a.id)

describe('alertsOf: Vampiro', () => {
  it('a ficha de exemplo, sem nada no limite, não tem alerta', () => {
    expect(ids('vtm-v20', sheetOf('helena'))).toEqual([])
  })

  it('Incapacitado: a Vitalidade marcada até o último nível', () => {
    const six = { aggravated: 0, lethal: 6, bashing: 0 }
    const seven = { aggravated: 1, lethal: 6, bashing: 0 }
    expect(ids('vtm-v20', sheetOf('helena', { health: six }))).toEqual([])
    expect(ids('vtm-v20', sheetOf('helena', { health: seven }))).toEqual([
      'incapacitated',
    ])
  })

  it('FdV zerada e sem Sangue, com o rótulo do template, na ordem dele', () => {
    const sheet = sheetOf('helena', {
      willpower: { current: 0, permanent: 7 },
      blood: { current: 0 },
    })
    expect(alertsOf(model('vtm-v20'), sheet, ST)).toEqual([
      {
        id: 'noWillpower',
        label: 'Força de Vontade zerada',
        field: 'willpower',
      },
      { id: 'noBlood', label: 'Sem Sangue', field: 'blood' },
    ])
  })

  it('aceita a ficha já resolvida (a Mesa resolve uma vez)', () => {
    const m = model('vtm-v20')
    const sheet = sheetOf('helena', { blood: { current: 0 } })
    expect(alertsOf(m, resolve(m, sheet), ST).map(a => a.id)).toEqual([
      'noBlood',
    ])
  })
})

describe('alertsOf: Mago e Lobisomem no limite', () => {
  it('o Mago de exemplo (roda e Vitalidade ferida) não tem alerta; FdV zerada tem', () => {
    expect(ids('mta-m20', sheetOf('tomas'))).toEqual([])
    expect(
      ids(
        'mta-m20',
        sheetOf('tomas', { willpower: { current: 0, permanent: 5 } })
      )
    ).toEqual(['noWillpower'])
  })

  it('Vitalidade ferida com agravado, mas não Incapacitado: nada', () => {
    const hurt = { aggravated: 2, lethal: 1, bashing: 1 }
    expect(ids('wta-w20', sheetOf('iara', { health: hurt }))).toEqual([])
  })

  it('Fúria 0 no Lobisomem', () => {
    const rage = { current: 0, permanent: 4 }
    expect(ids('wta-w20', sheetOf('iara', { rage }))).toEqual(['noRage'])
  })
})

describe('alertsOf: D&D (o mesmo código)', () => {
  it('PV abaixo da metade do máximo guardado', () => {
    const hp = (current: number) => ({ current, max: 27, temp: 0 })
    expect(ids('dnd5e-2014', sheetOf('lia', { hp: hp(14) }))).toEqual([])
    expect(ids('dnd5e-2014', sheetOf('lia', { hp: hp(13) }))).toEqual(['lowHp'])
  })

  it('CoC e Fate sem alerts: nunca há alerta', () => {
    expect(ids('coc7e', sheetOf('joana'))).toEqual([])
    expect(ids('fate-core', sheetOf('dandara'))).toEqual([])
  })
})

describe('alertsOf e as permissões', () => {
  // Um recurso numa seção que só o narrador lê, e um alerta sobre ele
  function secretPool() {
    const t = vtm()
    const fields = t.fields as Record<string, Json>
    fields.secret = { type: 'resource', label: 'Reserva secreta', max: 10 }
    const sections = t.sections as Json[]
    const notes = sections.find(
      s =>
        (
          (s.permissions as Json | undefined)?.read as string[] | undefined
        )?.join() === 'storyteller'
    )
    if (!notes) throw new Error('o Vampiro não tem seção só do narrador')
    notes.fields = [...(notes.fields as string[]), 'secret']
    t.alerts = [
      {
        id: 'noSecret',
        label: 'Sem reserva',
        rule: 'resource-at-most',
        field: 'secret',
        value: 0,
      },
    ]
    return compileTemplate(t)
  }

  it('um alerta sobre campo que o papel não lê não existe para ele', () => {
    const m = secretPool()
    const sheet = sheetOf('helena', { secret: { current: 0 } })
    expect(alertsOf(m, sheet, ['storyteller']).map(a => a.id)).toEqual([
      'noSecret',
    ])
    expect(alertsOf(m, sheet, ['owner'])).toEqual([])
  })
})
