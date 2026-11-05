/// <reference types="bun-types" />
import { describe, expect, it } from 'bun:test'
import { compileTemplate } from '../compile'
import { publicationIssues, validateTemplate } from '../validate'
import {
  fmt,
  type Json,
  mta,
  palette,
  reference,
  schema,
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

// Recusas do contrato (tamanho, marcação, vazio): a mesma mensagem nos dois
// validadores, com o caminho do nó.
const refusals: [string, string, (t: Json) => void, string][] = [
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
    'frase vazia no grupo',
    'sections.attributes.groups.physical.help',
    t => {
      const g = groupOf(t, 'attributes', 'physical')
      if (g) g.help = ''
    },
    'texto obrigatório',
  ],
]

describe('help: recusas do contrato, iguais nos dois validadores', () => {
  it.each(refusals)('%s', (_, path, mutate, message) => {
    const t = vtm()
    mutate(t)
    const issues = validateTemplate(t, palette)
    expect(issues).toContainEqual({ path, message })
    expect(fmt('vtm-v20', issues)).toEqual(
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
})

// O "sem link" e a linha única valem só na publicação, nos nós que usam
// $defs/helpText e $defs/helpShort no schema.json (P10-D, revisão).
const LINK = 'ajuda com link (://, www.): a frase é texto puro'
const LINE = 'ajuda em uma linha só'
const first = (v: unknown) => ((v ?? []) as Json[])[0]

// Cada nó do schema, com um template que o tem e onde pôr a frase
const NODES: [string, () => Json, (t: Json, v: string) => string][] = [
  [
    'fieldBase.help',
    vtm,
    (t, v) => {
      ;(fieldsOf(t).humanity as Json).help = v
      return 'fields.humanity.help'
    },
  ],
  [
    'field-state.options.note',
    wta,
    (t, v) => {
      const o = first(fieldsOf(t).form?.options) as Json
      o.note = v
      return `fields.form.options.${o.id}.note`
    },
  ],
  [
    'field-state.options.help',
    wta,
    (t, v) => {
      const o = first(fieldsOf(t).form?.options) as Json
      o.help = v
      return `fields.form.options.${o.id}.help`
    },
  ],
  [
    'field-choice.options.help',
    vtm,
    (t, v) => {
      const o = first(fieldsOf(t).clan?.options) as Json
      o.help = v
      return `fields.clan.options.${o.id}.help`
    },
  ],
  [
    'field-list.fixed.help',
    mta,
    (t, v) => {
      const x = first(fieldsOf(t).resonance?.fixed) as Json
      x.help = v
      return `fields.resonance.fixed.${x.id}.help`
    },
  ],
  [
    'section.groups.help',
    vtm,
    (t, v) => {
      const g = groupOf(t, 'attributes', 'physical') as Json
      g.help = v
      return 'sections.attributes.groups.physical.help'
    },
  ],
  [
    'roll.presets.help',
    wta,
    (t, v) => {
      const pr = first((t.roll as Json).presets) as Json
      pr.help = v
      return `roll.presets.${pr.id}.help`
    },
  ],
  [
    'templateAction.help',
    vtm,
    (t, v) => {
      const a = first(t.actions) as Json
      a.help = v
      return `actions.${a.id}.help`
    },
  ],
  [
    'chronicleOption.help',
    vtm,
    (t, v) => {
      t.options = [{ id: 'probe', label: 'Sonda', help: v }]
      return 'options.probe.help'
    },
  ],
  [
    'recovery.help',
    vtm,
    (t, v) => {
      const r = first(t.recoveries) as Json
      r.help = v
      return `recoveries.${r.id}.help`
    },
  ],
  [
    'field-list.catalogHelp/additionalProperties',
    mta,
    (t, v) => {
      const f = fieldsOf(t).backgrounds as Json
      const [name] = f.catalog as string[]
      f.catalogHelp = { [name as string]: v }
      return `fields.backgrounds.catalogHelp.${name}`
    },
  ],
  [
    'field-text.suggestionHelp/additionalProperties',
    vtm,
    (t, v) => {
      const f = fieldsOf(t).nature as Json
      const [name] = f.suggestions as string[]
      f.suggestionHelp = { [name as string]: v }
      return `fields.nature.suggestionHelp.${name}`
    },
  ],
  [
    'resourceAction.help',
    vtm,
    (t, v) => {
      const a = first(fieldsOf(t).blood?.actions) as Json
      a.help = v
      return `fields.blood.actions.${a.id}.help`
    },
  ],
]

// Os nós do schema.json que levam helpText ou helpShort
function schemaHelpNodes(): string[] {
  const out: string[] = []
  const walk = (n: unknown, path: string[]) => {
    if (Array.isArray(n)) return n.forEach((x, i) => walk(x, [...path, `${i}`]))
    if (typeof n !== 'object' || n === null) return
    const o = n as Json
    if (o.$ref === '#/$defs/helpText' || o.$ref === '#/$defs/helpShort')
      out.push(path.join('/'))
    for (const [k, v] of Object.entries(o)) walk(v, [...path, k])
  }
  walk(schema, [])
  return out
    .map(p =>
      p
        .replace(/^\$defs\//, '')
        .replace(/\/properties\//g, '.')
        .replace(/\/items/g, '')
    )
    .sort()
}

describe('publicationIssues: só na publicação, nos nós do schema', () => {
  it('os nós são exatamente os do schema.json', () => {
    expect(NODES.map(([n]) => n).sort()).toEqual(schemaHelpNodes())
  })

  it.each(NODES)(
    '%s: link e quebra de linha recusados, iguais à referência',
    (_, base, put) => {
      for (const [value, message] of [
        ['Veja https://exemplo.test', LINK],
        ['Veja WWW.exemplo.test', LINK],
        ['linha um\nlinha dois', LINE],
      ] as const) {
        const t = base()
        const path = put(t, value)
        const issues = publicationIssues(t)
        expect(issues).toEqual([{ path, message }])
        expect(fmt(t.system as string, issues)).toEqual(
          reference.publicationIssues(t)
        )
      }
    }
  )

  it('os templates do produto passam', () => {
    for (const t of [vtm(), wta(), mta()]) {
      expect(publicationIssues(t)).toEqual([])
      expect(reference.publicationIssues(t)).toEqual([])
    }
  })

  it('a leitura fica tolerante: uma versão com link na ajuda ainda compila', () => {
    const t = vtm()
    ;(fieldsOf(t).humanity as Json).help = 'Veja www.exemplo.test'
    const o = first(fieldsOf(t).clan?.options) as Json
    o.help = 'Veja https://exemplo.test'
    expect(validateTemplate(t, palette)).toEqual([])
    expect(reference.validateTemplate(t, palette)).toEqual([])
    expect(() => compileTemplate(t)).not.toThrow()
  })

  it('a frase não é ecoada na mensagem', () => {
    const t = vtm()
    const o = first(fieldsOf(t).clan?.options) as Json
    o.help = 'segredo-de-teste https://exemplo.test'
    for (const i of publicationIssues(t))
      expect(`${i.path} ${i.message}`).not.toContain('segredo-de-teste')
  })
})

// Commit 7: a frase por nome, num mapa ao lado da lista (catalogHelp e
// suggestionHelp), como o catalogDefaults do P07-D
describe('catalogHelp e suggestionHelp', () => {
  const background = (t: Json) => fieldsOf(t).backgrounds as Json
  const nature = (t: Json) => fieldsOf(t).nature as Json

  it('aceitam nomes da lista, com frase curta, nos dois validadores', () => {
    const t = vtm()
    const [b] = background(t).catalog as string[]
    const [s] = nature(t).suggestions as string[]
    background(t).catalogHelp = { [b as string]: 'Frase do time.' }
    nature(t).suggestionHelp = { [s as string]: 'Frase do time.' }
    expect(validateTemplate(t, palette)).toEqual([])
    expect(reference.validateTemplate(t, palette)).toEqual([])
  })

  it.each([
    [
      'nome fora do catálogo',
      (t: Json) => {
        background(t).catalogHelp = { 'Nome Inventado': 'Frase.' }
      },
      'fields.backgrounds.catalogHelp',
    ],
    [
      'nome fora das sugestões',
      (t: Json) => {
        nature(t).suggestionHelp = { 'Nome Inventado': 'Frase.' }
      },
      'fields.nature.suggestionHelp',
    ],
    [
      'frase acima de 200',
      (t: Json) => {
        const [b] = background(t).catalog as string[]
        background(t).catalogHelp = { [b as string]: 'a'.repeat(201) }
      },
      'fields.backgrounds.catalogHelp.',
    ],
    [
      'mapa que não é objeto',
      (t: Json) => {
        background(t).catalogHelp = ['Aliados']
      },
      'fields.backgrounds.catalogHelp',
    ],
    [
      'mapa vazio',
      (t: Json) => {
        background(t).catalogHelp = {}
      },
      'fields.backgrounds.catalogHelp',
    ],
  ] as [string, (t: Json) => void, string][])(
    'recusam %s, iguais à referência',
    (_, mutate, path) => {
      const t = vtm()
      mutate(t)
      const issues = validateTemplate(t, palette)
      expect(issues.some(i => i.path.startsWith(path))).toBe(true)
      expect(fmt('vtm-v20', issues)).toEqual(
        reference.validateTemplate(t, palette)
      )
    }
  )

  it('um mapa acima do limite dá um erro de tamanho e confere só os primeiros', () => {
    const t = vtm()
    const names = Object.fromEntries(
      Array.from({ length: 1000 }, (_, i) => [`Inventado ${i}`, 'Frase.'])
    )
    background(t).catalogHelp = names
    const issues = validateTemplate(t, palette).filter(i =>
      i.path.startsWith('fields.backgrounds.catalogHelp')
    )
    expect(issues).toContainEqual({
      path: 'fields.backgrounds.catalogHelp',
      message: 'de 1 a 200 nomes',
    })
    // 1 de tamanho e 200 de nome fora da lista, não 1000
    expect(issues).toHaveLength(201)
    expect(fmt('vtm-v20', validateTemplate(t, palette))).toEqual(
      reference.validateTemplate(t, palette)
    )
  })

  it('a chave proibida no nome continua barrada', () => {
    const t = vtm()
    background(t).catalogHelp = JSON.parse('{"__proto__": "x"}')
    expect(validateTemplate(t, palette).length).toBeGreaterThan(0)
  })
})
