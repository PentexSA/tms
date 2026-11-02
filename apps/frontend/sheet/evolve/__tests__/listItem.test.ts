import type { ListField, ListItem } from '@tms/sheet-core'
import { modelOf } from '../../../test/fixtures'
import { withItemDefaults } from '../listItem'

// T-23: o item grava o mínimo do template que o editor já mostra. Nenhum
// valor é inventado para meta sem mínimo, e o que já foi gravado fica.

const listDef = (system: string, id: string): ListField => {
  const def = modelOf(system).fields.get(id)?.def
  if (def?.type !== 'list') throw new Error(`lista ausente: ${id}`)
  return def
}

describe('withItemDefaults', () => {
  it('Defeito: o bônus nasce com o mínimo do template', () => {
    expect(
      withItemDefaults(listDef('vtm-v20', 'flaws'), { id: 'f1', name: 'D' })
    ).toEqual({ id: 'f1', name: 'D', meta: { bonus: 1 } })
  })

  it('Qualidade: o custo nasce com o mínimo; o meta de texto fica vazio', () => {
    expect(
      withItemDefaults(listDef('vtm-v20', 'merits'), { id: 'm1', name: 'Q' })
    ).toEqual({ id: 'm1', name: 'Q', meta: { cost: 1 } })
  })

  it('o valor já gravado fica; o vazio ganha o mínimo', () => {
    const item: ListItem = {
      id: 'g1',
      name: 'Pulo',
      meta: { rank: 3, source: 'Tribo' },
    }
    const def = listDef('wta-w20', 'gifts')
    expect(withItemDefaults(def, item)).toBe(item)
    expect(
      withItemDefaults(listDef('wta-w20', 'fetishes'), {
        id: 'x',
        name: 'Faca',
        meta: { level: '' },
      })
    ).toEqual({ id: 'x', name: 'Faca', meta: { level: 1, gnosis: 1 } })
  })

  it('o mínimo 0 também é gravado (Nível do Rito)', () => {
    expect(
      withItemDefaults(listDef('wta-w20', 'rites'), { id: 'r1', name: 'R' })
    ).toEqual({ id: 'r1', name: 'R', meta: { level: 0 } })
  })

  it('meta sem mínimo (Ataque do D&D) não ganha valor', () => {
    const item: ListItem = { id: 'a1', name: 'Adaga' }
    expect(withItemDefaults(listDef('dnd5e-2014', 'attacks'), item)).toBe(item)
  })

  it('lista fixa e aspecto (sem meta) ficam como estão', () => {
    const fixed: ListItem = { id: 'dynamic', text: 'Elétrica', value: 2 }
    expect(withItemDefaults(listDef('mta-m20', 'resonance'), fixed)).toBe(fixed)
    const aspect: ListItem = { id: 'i1', text: 'Café forte' }
    expect(withItemDefaults(listDef('fate-core', 'aspects'), aspect)).toBe(
      aspect
    )
  })
})
