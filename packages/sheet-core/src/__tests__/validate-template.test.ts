/// <reference types="bun-types" />
import { describe, expect, it } from 'bun:test'
import { validateTemplate } from '../validate'
import { type Json, palette, paths, reference, vtm } from './fixtures'

// Onde a porta é deliberadamente mais estrita que a referência: estrutura
// inesperada vira erro (nunca exceção) e ids não podem ser nomes de
// Object.prototype, como em schema.json.

type Fields = Record<string, Json>
const fieldsOf = (t: Json) => t.fields as Fields

describe('validateTemplate: fail secure', () => {
  // Cada caso dentro de um array: com `[]` solto, o Bun espalharia zero
  // argumentos e trataria o parâmetro como callback `done`.
  it.each([[null], [undefined], [42], ['vtm-v20'], [[]]])(
    'recusa template que não é objeto (%p)',
    input => {
      expect(validateTemplate(input, palette)).toEqual([
        { path: '', message: 'template malformado' },
      ])
    }
  )

  it('lista que não é array vira erro, onde a referência lançava exceção', () => {
    const t = vtm()
    const blood = fieldsOf(t).blood
    if (blood) blood.actions = 5
    expect(() => reference.validateTemplate(t, palette)).toThrow()
    expect(paths(validateTemplate(t, palette))).toContain(
      'fields.blood.actions'
    )
  })

  it('efeito de boost com nome de Object.prototype não lança exceção', () => {
    const t = vtm()
    const [boost] = (t.roll as Json).boosts as Json[]
    if (boost) boost.effect = 'constructor'
    expect(() => reference.validateTemplate(t, palette)).toThrow()
    expect(validateTemplate(t, palette)).toContainEqual({
      path: 'roll.boosts.willpower.effect',
      message: "efeito 'constructor' fora da lista fechada",
    })
  })

  it('tipo de campo com nome de Object.prototype não lança exceção', () => {
    const t = vtm()
    fieldsOf(t).name = { type: 'constructor', label: 'Nome' }
    expect(() => reference.validateTemplate(t, palette)).toThrow()
    expect(validateTemplate(t, palette)).toContainEqual({
      path: 'fields.name.type',
      message: "type 'constructor' fora da lista fechada",
    })
  })

  it.each(['constructor', 'toString', 'valueOf', 'hasOwnProperty'])(
    'rejeita id de campo %p (prototype pollution em fields[id])',
    id => {
      const t = vtm()
      fieldsOf(t)[id] = { type: 'text', label: 'X' }
      expect(validateTemplate(t, palette)).toContainEqual({
        path: `fields.${id}`,
        message: 'id inválido',
      })
    }
  )

  it('rejeita id de opção com nome de Object.prototype', () => {
    const t = vtm()
    const clan = fieldsOf(t).clan
    const options = clan?.options as Json[]
    options.push({ id: 'toString', label: 'X' })
    expect(paths(validateTemplate(t, palette))).toContain('fields.clan.options')
  })

  it('grupo de seção sem lista de campos é erro', () => {
    const t = vtm()
    const attributes = (t.sections as Json[]).find(s => s.id === 'attributes')
    const [group] = (attributes?.groups ?? []) as Json[]
    if (group) delete group.fields
    expect(paths(validateTemplate(t, palette))).toContain(
      `sections.attributes.groups.${group?.id}.fields`
    )
  })

  it('item de lista que não é objeto é erro', () => {
    const t = vtm()
    t.sections = [...(t.sections as Json[]), 'seção']
    expect(validateTemplate(t, palette)).toContainEqual({
      path: `sections.${(t.sections as unknown[]).length - 1}`,
      message: 'precisa ser objeto',
    })
  })

  it('identidade pública não pode derivar de uma seção restrita', () => {
    const t = vtm()
    fieldsOf(t).publicChip = {
      type: 'derived',
      label: 'Selo público',
      derive: 'sum',
      from: 'storytellerNotes',
    }
    ;(t.identity as Json).chip = 'publicChip'
    expect(validateTemplate(t, palette)).toContainEqual({
      path: 'identity.chip',
      message: 'campo ou dependência de seção com leitura restrita',
    })
  })

  it('nunca lança exceção, mesmo com valores de tipos trocados em todo lugar', () => {
    const t = vtm()
    for (const f of Object.values(fieldsOf(t))) {
      for (const k of Object.keys(f)) if (k !== 'type') f[k] = { x: [1, null] }
    }
    t.sections = { not: 'a list' }
    t.roll = 'pool-success'
    t.identity = ['name']
    t.accent = 7
    expect(() => validateTemplate(t, palette)).not.toThrow()
    expect(validateTemplate(t, palette).length).toBeGreaterThan(0)
  })
})
