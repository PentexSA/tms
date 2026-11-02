/// <reference types="bun-types" />
import { describe, expect, it } from 'bun:test'
import { compileTemplate } from '../compile'
import { fieldOrder, fieldPlace, fieldRank } from '../order'
import { clone, type Json, templates } from './fixtures'

// T-54: o template volta do banco como `jsonb`, que reordena as chaves de
// objeto pelo tamanho e depois pelos bytes. O resumo de "Salvar" saía nessa
// ordem ("Senhor, Coragem, Força, Consciência…"). A ordem da ficha vem das
// seções e grupos, que são arrays e não mudam.

/** As chaves como o `jsonb` devolve: por tamanho, depois por bytes. */
const jsonbOrder = (fields: Json): Json =>
  Object.fromEntries(
    Object.entries(fields).sort(([a], [b]) =>
      a.length !== b.length
        ? a.length - b.length
        : Buffer.compare(Buffer.from(a), Buffer.from(b))
    )
  )

const fromDatabase = (system: string) => {
  const t = clone(templates[system]) as Json & { fields: Json }
  t.fields = jsonbOrder(t.fields)
  // Mesmo sistema e versão com outro texto: o compileTemplate recompila
  return compileTemplate(t)
}

describe('fieldOrder', () => {
  const model = fromDatabase('vtm-v20')

  it('o modelo vindo do jsonb está fora da ordem da ficha (a causa)', () => {
    const keys = [...model.fields.keys()]
    expect(keys.indexOf('sire')).toBeLessThan(keys.indexOf('strength'))
  })

  it('segue as seções e grupos do template, não as chaves do jsonb', () => {
    const order = fieldOrder(model)
    const pos = (id: string) => order.indexOf(id)
    // Atributos: Físicos, Sociais, Mentais
    expect(pos('strength')).toBeLessThan(pos('dexterity'))
    expect(pos('stamina')).toBeLessThan(pos('charisma'))
    expect(pos('appearance')).toBeLessThan(pos('perception'))
    expect(pos('wits')).toBeLessThan(pos('awareness'))
    // Habilidades antes de Vantagens; Virtudes na ordem do grupo
    expect(pos('brawl')).toBeLessThan(pos('drive'))
    expect(pos('occult')).toBeLessThan(pos('disciplines'))
    expect(pos('conscience')).toBeLessThan(pos('selfControl'))
    expect(pos('selfControl')).toBeLessThan(pos('courage'))
    // Cada campo uma vez, e todos os campos do modelo
    expect(new Set(order).size).toBe(order.length)
    expect(order.length).toBe(model.fields.size)
  })

  it('a mesma ordem venha o template do arquivo ou do jsonb', () => {
    const file = compileTemplate(templates['vtm-v20'])
    const inSections = (m: typeof model) =>
      fieldOrder(m).filter(id => fieldPlace(m, id))
    expect(inSections(model)).toEqual(inSections(file))
  })

  it('o rank segue a ordem; campo desconhecido vai para o fim', () => {
    expect(fieldRank(model, 'strength')).toBeLessThan(
      fieldRank(model, 'courage')
    )
    expect(fieldRank(model, 'nao-existe')).toBe(Number.MAX_SAFE_INTEGER)
  })
})

describe('fieldPlace', () => {
  const model = fromDatabase('vtm-v20')

  it('separa a Consciência Talento da Consciência Virtude', () => {
    expect(model.fields.get('awareness')?.def.label).toBe('Consciência')
    expect(model.fields.get('conscience')?.def.label).toBe('Consciência')
    expect(fieldPlace(model, 'awareness')).toEqual({
      section: 'Habilidades',
      group: 'Talentos',
    })
    expect(fieldPlace(model, 'conscience')).toEqual({
      section: 'Vantagens',
      group: 'Virtudes',
    })
  })

  it('campo fora de seção não tem lugar', () => {
    expect(fieldPlace(model, 'nao-existe')).toBeNull()
  })

  it('vale para qualquer sistema: só seções e grupos', () => {
    for (const system of Object.keys(templates)) {
      const m = fromDatabase(system)
      const order = fieldOrder(m)
      expect(order.length).toBe(m.fields.size)
      for (const section of m.sections.values())
        for (const id of section.fieldIds)
          expect(fieldPlace(m, id)?.section).toBeDefined()
    }
  })
})
