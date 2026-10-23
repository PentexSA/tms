/// <reference types="bun-types" />
import { describe, expect, it } from 'bun:test'
import { compileTemplate } from '../compile'
import type { SheetData } from '../contract'
import { isEditableIn, type SheetMode } from '../modes'
import {
  canRead,
  canReadSection,
  canWrite,
  stripRestricted,
} from '../permissions'
import { character, clone, templates } from './fixtures'

const model = compileTemplate(templates['vtm-v20'])
const helena = () => character('helena').sheet as unknown as SheetData

// Seção "storyteller" do Vampiro: read e write só do narrador. As demais não
// declaram permissions (dono e narrador leem e escrevem). Outro jogador da
// crônica não tem papel na ficha: o `player` saiu do registry na v3 e vale
// como papel desconhecido.
describe('matriz papel × seção', () => {
  it.each([
    // papéis           campo comum       notas do narrador
    [['owner'], { read: true, write: true }, { read: false, write: false }],
    [['storyteller'], { read: true, write: true }, { read: true, write: true }],
    [['player'], { read: false, write: false }, { read: false, write: false }],
    [
      ['owner', 'storyteller'],
      { read: true, write: true },
      { read: true, write: true },
    ],
    [[], { read: false, write: false }, { read: false, write: false }],
    [['admin'], { read: false, write: false }, { read: false, write: false }],
  ] as const)('%p', (roles, common, restricted) => {
    expect({
      read: canRead(model, 'strength', roles),
      write: canWrite(model, 'strength', roles),
    }).toEqual(common)
    expect({
      read: canRead(model, 'storytellerNotes', roles),
      write: canWrite(model, 'storytellerNotes', roles),
    }).toEqual(restricted)
  })

  it('campo fora de seção segue a regra padrão (clã)', () => {
    expect(canRead(model, 'clan', ['owner'])).toBe(true)
    expect(canRead(model, 'clan', ['storyteller'])).toBe(true)
    expect(canRead(model, 'clan', ['player'])).toBe(false)
    expect(canWrite(model, 'clan', ['player'])).toBe(false)
    expect(canWrite(model, 'clan', ['owner'])).toBe(true)
  })

  it('seção sem permissions com papel desconhecido: não lê (fail secure)', () => {
    expect(canReadSection(model, 'attributes', ['player'])).toBe(false)
    expect(canReadSection(model, 'attributes', ['viewer'])).toBe(false)
    expect(canRead(model, 'strength', ['admin', 'player'])).toBe(false)
  })

  it('campo inexistente nunca é lido nem escrito', () => {
    expect(canRead(model, 'isAdmin', ['storyteller'])).toBe(false)
    expect(canWrite(model, 'isAdmin', ['storyteller'])).toBe(false)
    expect(canRead(model, '__proto__', ['storyteller'])).toBe(false)
  })

  it('campo derivado não é escrito por ninguém (D&D)', () => {
    const dnd = compileTemplate(templates['dnd5e-2014'])
    expect(canRead(dnd, 'initiative', ['owner'])).toBe(true)
    expect(canWrite(dnd, 'initiative', ['storyteller'])).toBe(false)
  })

  it('seções', () => {
    expect(canReadSection(model, 'storyteller', ['owner'])).toBe(false)
    expect(canReadSection(model, 'storyteller', ['storyteller'])).toBe(true)
    expect(canReadSection(model, 'attributes', ['owner'])).toBe(true)
    expect(canReadSection(model, 'naoExiste', ['storyteller'])).toBe(false)
  })

  it('campo citado por uma seção aberta e uma restrita obedece à restrita', () => {
    const t = clone(templates['vtm-v20'] as Record<string, unknown>)
    const sections = t.sections as { id: string; fields?: string[] }[]
    const about = sections.find(s => s.id === 'about')
    about?.fields?.push('storytellerNotes')
    const m = compileTemplate(t)
    expect(m.fields.get('storytellerNotes')?.sectionIds).toEqual([
      'about',
      'storyteller',
    ])
    expect(canRead(m, 'storytellerNotes', ['owner'])).toBe(false)
    expect(canWrite(m, 'storytellerNotes', ['owner'])).toBe(false)
  })
})

describe('stripRestricted', () => {
  it('remove valores e especializações que o papel não lê', () => {
    const sheet = helena()
    const withSpecialty = {
      ...sheet,
      specialties: { ...sheet.specialties, storytellerNotes: 'x' },
    } as SheetData
    const out = stripRestricted(model, withSpecialty, ['owner'])
    expect(Object.hasOwn(out.values, 'storytellerNotes')).toBe(false)
    expect(Object.hasOwn(out.specialties ?? {}, 'storytellerNotes')).toBe(false)
    expect(out.values.name).toBe('Helena Varga')
  })

  it('outro jogador (papel fora do registry) não recebe nada', () => {
    expect(stripRestricted(model, helena(), ['player'])).toEqual({
      values: {},
      specialties: {},
    })
  })

  it('o narrador recebe tudo', () => {
    const sheet = helena()
    expect(stripRestricted(model, sheet, ['storyteller'])).toEqual({
      values: sheet.values,
      specialties: sheet.specialties ?? {},
    })
  })

  it('sem papel, nada', () => {
    expect(stripRestricted(model, helena(), [])).toEqual({
      values: {},
      specialties: {},
    })
  })

  it('remove também chaves que não existem no template', () => {
    const sheet = helena()
    const out = stripRestricted(
      model,
      { values: { ...sheet.values, isAdmin: true } } as unknown as SheetData,
      ['storyteller']
    )
    expect(Object.hasOwn(out.values, 'isAdmin')).toBe(false)
  })

  it('não muda a ficha original', () => {
    const sheet = helena()
    const before = clone(sheet)
    stripRestricted(model, sheet, ['player'])
    expect(sheet).toEqual(before)
  })
})

describe('isEditableIn (UX, não é controle de acesso)', () => {
  const field = (id: string) => {
    const f = model.fields.get(id)
    if (!f) throw new Error(id)
    return f
  }

  it.each([
    ['blood', 'read', false],
    ['blood', 'play', true],
    ['blood', 'evolve', true],
    ['strength', 'play', false],
    ['strength', 'evolve', true],
    ['notes', 'play', true],
    ['notes', 'evolve', true],
  ] as const)('%s em %s → %p', (id, mode: SheetMode, expected) => {
    expect(isEditableIn(field(id), mode)).toBe(expected)
  })

  it('derivado não é editável em modo nenhum', () => {
    const dnd = compileTemplate(templates['dnd5e-2014'])
    const initiative = dnd.fields.get('initiative')
    for (const mode of ['read', 'play', 'evolve'] as const)
      expect(initiative && isEditableIn(initiative, mode)).toBe(false)
  })
})
