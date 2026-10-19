/// <reference types="bun-types" />
import { describe, expect, it } from 'bun:test'
import { compileTemplate } from '../compile'
import type { SheetData } from '../contract'
import { inactiveNote } from '../fields'
import { inactiveChanges } from '../labels'
import { type ResolvedRating, resolve } from '../resolve'
import { character, mta, vtm } from './fixtures'

// Teto não destrutivo (contrato §3, `cap`): Esferas ≤ Arete. Baixar o teto
// não apaga ponto; o excedente fica inativo e volta quando o teto sobe.

const model = compileTemplate(mta())
// Otto: Arete 2, Forças 3, Matéria 2, Primórdio 1
const otto = (values: Record<string, unknown> = {}): SheetData => {
  const s = character('otto').sheet as unknown as SheetData
  return { ...s, values: { ...s.values, ...values } } as SheetData
}
const rating = (sheet: SheetData, id: string) =>
  resolve(model, sheet).get(id) as ResolvedRating

describe('inactiveNote', () => {
  it('diz quantos pontos ficam inativos e o teto', () => {
    expect(inactiveNote(rating(otto(), 'forces'))).toBe(
      '1 inativo, máx. pelo Arete 2'
    )
    expect(inactiveNote(rating(otto(), 'matter'))).toBeNull()
  })
})

describe('inactiveChanges (resumo do Concluir)', () => {
  it('baixar o Arete avisa as Esferas que ficam inativas, sem mudar valor', () => {
    const before = otto()
    const after = otto({ arete: 1 })
    expect(inactiveChanges(model, before, after)).toEqual([
      { label: 'Forças', change: '2 inativo, máx. pelo Arete 1' },
      { label: 'Matéria', change: '1 inativo, máx. pelo Arete 1' },
    ])
    expect(after.values.forces).toBe(3)
  })

  it('subir o Arete: o que estava inativo volta a valer', () => {
    expect(inactiveChanges(model, otto(), otto({ arete: 3 }))).toEqual([
      { label: 'Forças', change: 'volta a valer' },
    ])
  })

  it('subir uma Esfera acima do Arete avisa só ela', () => {
    expect(inactiveChanges(model, otto(), otto({ matter: 4 }))).toEqual([
      { label: 'Matéria', change: '2 inativo, máx. pelo Arete 2' },
    ])
  })

  it('sem mudança de teto, nada a avisar; o Vampiro não tem cap', () => {
    expect(inactiveChanges(model, otto(), otto({ strength: 3 }))).toEqual([])
    const v = compileTemplate(vtm())
    const helena = character('helena').sheet as unknown as SheetData
    expect(inactiveChanges(v, helena, helena)).toEqual([])
  })
})
