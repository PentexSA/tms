/// <reference types="bun-types" />
import { describe, expect, it } from 'bun:test'
import { validateTemplate } from '../validate'
import {
  fmt,
  type Json,
  mta,
  palette,
  paths,
  reference,
  vtm,
  wta,
} from './fixtures'

// R-19 (P10-D): a frase de ajuda nas opções, nos grupos e nos itens fixos.
// Texto puro, até 200, sem link; no campo, até 400, também sem link.

type Fields = Record<string, Json>
const fieldsOf = (t: Json) => t.fields as Fields
const optionsOf = (f: Json | undefined) => (f?.options ?? []) as Json[]
const groupOf = (t: Json, section: string, group: string) => {
  const s = (t.sections as Json[]).find(x => x.id === section)
  return ((s?.groups ?? []) as Json[]).find(g => g.id === group)
}

// Cada mutação põe uma frase num nó novo: o core e a referência aceitam.
const valid: [string, () => Json][] = [
  [
    'opção de choice (Clã)',
    () => {
      const t = vtm()
      const [o] = optionsOf(fieldsOf(t).clan)
      if (o) o.help = 'Frase curta do time, para revisão.'
      return t
    },
  ],
  [
    'opção de state (Forma)',
    () => {
      const t = wta()
      const [o] = optionsOf(fieldsOf(t).form)
      if (o) o.help = 'Frase curta do time, para revisão.'
      return t
    },
  ],
  [
    'item fixo de lista (Ressonância)',
    () => {
      const t = mta()
      const [x] = (fieldsOf(t).resonance?.fixed ?? []) as Json[]
      if (x) x.help = 'Frase curta do time, para revisão.'
      return t
    },
  ],
  [
    'grupo de seção (Físicos)',
    () => {
      const t = vtm()
      const g = groupOf(t, 'attributes', 'physical')
      if (g) g.help = 'Frase curta do time, para revisão.'
      return t
    },
  ],
]

describe('help nos nós novos do template', () => {
  it.each(valid)('aceita a frase na %s', (_, make) => {
    const t = make()
    expect(validateTemplate(t, palette)).toEqual([])
    expect(reference.validateTemplate(t, palette)).toEqual([])
  })

  it('os fixtures acham os nós que o teste muda', () => {
    expect(optionsOf(fieldsOf(vtm()).clan).length).toBeGreaterThan(0)
    expect(optionsOf(fieldsOf(wta()).form).length).toBeGreaterThan(0)
    expect(
      (fieldsOf(mta()).resonance?.fixed as Json[] | undefined)?.length
    ).toBe(3)
    expect(groupOf(vtm(), 'attributes', 'physical')).toBeDefined()
  })
})

// Recusas: a mesma mensagem nos dois validadores, com o caminho do nó.
const refusals: [string, string, (t: Json) => void, string][] = [
  [
    'frase com link (://)',
    'fields.clan.options.brujah.help',
    t => {
      const o = optionsOf(fieldsOf(t).clan).find(x => x.id === 'brujah')
      if (o) o.help = 'Veja https://exemplo.test'
    },
    'ajuda com link (://, www.): a frase é texto puro',
  ],
  [
    'frase com www.',
    'fields.clan.options.brujah.help',
    t => {
      const o = optionsOf(fieldsOf(t).clan).find(x => x.id === 'brujah')
      if (o) o.help = 'Veja WWW.exemplo.test'
    },
    'ajuda com link (://, www.): a frase é texto puro',
  ],
  [
    'frase acima de 200',
    'fields.clan.options.brujah.help',
    t => {
      const o = optionsOf(fieldsOf(t).clan).find(x => x.id === 'brujah')
      if (o) o.help = 'a'.repeat(201)
    },
    'texto acima de 200 caracteres',
  ],
  [
    'frase com marcação',
    'fields.clan.options.brujah.help',
    t => {
      const o = optionsOf(fieldsOf(t).clan).find(x => x.id === 'brujah')
      if (o) o.help = '<b>forte</b>'
    },
    'texto com caracteres proibidos (< >, controle ou bidi): rótulo é texto, nunca HTML',
  ],
  [
    'frase com quebra de linha no grupo',
    'sections.attributes.groups.physical.help',
    t => {
      const g = groupOf(t, 'attributes', 'physical')
      if (g) g.help = 'linha um\nlinha dois'
    },
    'ajuda em uma linha só',
  ],
  [
    'frase vazia no grupo',
    'sections.attributes.groups.physical.help',
    t => {
      const g = groupOf(t, 'attributes', 'physical')
      if (g) g.help = ''
    },
    'texto obrigatório',
  ],
  [
    'link no help do campo (400)',
    'fields.humanity.help',
    t => {
      const f = fieldsOf(t).humanity
      if (f) f.help = 'Mais em exemplo.test://x'
    },
    'ajuda com link (://, www.): a frase é texto puro',
  ],
]

describe('help: recusas, iguais nos dois validadores', () => {
  it.each(refusals)('%s', (_, path, mutate, message) => {
    const t = vtm()
    mutate(t)
    const issues = validateTemplate(t, palette)
    expect(issues).toContainEqual({ path, message })
    expect(fmt('vtm-v20', issues)).toEqual(
      reference.validateTemplate(t, palette)
    )
  })

  it('opção de tags com link é recusada (D&D não entra: Condições do CoC)', () => {
    const t = mta()
    // Uma lista de tags mínima, para o teste não depender de outro template.
    fieldsOf(t).probe = {
      type: 'tags',
      label: 'Sonda',
      options: [{ id: 'a', label: 'A', help: 'www.exemplo.test' }],
    }
    const issues = validateTemplate(t, palette)
    expect(paths(issues)).toContain('fields.probe.options.a.help')
    expect(fmt('mta-m20', issues)).toEqual(
      reference.validateTemplate(t, palette)
    )
  })

  it('item fixo com frase acima de 200 é recusado', () => {
    const t = mta()
    const [x] = (fieldsOf(t).resonance?.fixed ?? []) as Json[]
    if (x) x.help = 'b'.repeat(201)
    expect(validateTemplate(t, palette)).toContainEqual({
      path: `fields.resonance.fixed.${x?.id}.help`,
      message: 'texto acima de 200 caracteres',
    })
  })

  it('a frase não é ecoada na mensagem de erro', () => {
    const t = vtm()
    const o = optionsOf(fieldsOf(t).clan).find(x => x.id === 'brujah')
    if (o) o.help = 'segredo-de-teste https://exemplo.test'
    for (const i of validateTemplate(t, palette))
      expect(i.message).not.toContain('segredo-de-teste')
  })
})
