/// <reference types="bun-types" />
import { describe, expect, it } from 'bun:test'
import { validateSheet, validateTemplate } from '../validate'
import {
  character,
  characters,
  dnd,
  fmt,
  type Json,
  palette,
  reference,
  templates,
  vtm,
  wta,
} from './fixtures'

// Teste diferencial: a porta em TS precisa dar exatamente os mesmos erros que a
// referência executável (design/scripts/validate.mjs), nos fixtures e em
// variações inválidas deles. As diferenças deliberadas (mais estritas) ficam em
// validate-template.test.ts e validate-sheet.test.ts.

const BIDI = String.fromCodePoint(0x202e)

type Fields = Record<string, Json>
type Section = Json & { id: string; fields?: string[] }
const fieldsOf = (t: Json) => t.fields as Fields
const sectionsOf = (t: Json) => t.sections as Section[]
const restrictedField = (t: Json) => {
  const s = sectionsOf(t).find(x => x.permissions)
  return s?.fields?.[0] ?? 'storytellerNotes'
}

describe('paridade nos fixtures', () => {
  for (const [system, t] of Object.entries(templates)) {
    it(`validateTemplate(${system}) não tem erro e bate com a referência`, () => {
      const issues = validateTemplate(t, palette)
      expect(issues).toEqual([])
      expect(fmt(system, issues)).toEqual(
        reference.validateTemplate(t, palette)
      )
    })
  }

  for (const c of characters) {
    it(`validateSheet(${c.id}, ${c.system}) não tem erro e bate com a referência`, () => {
      const t = templates[c.system]
      const issues = validateSheet(t, c.sheet)
      expect(issues).toEqual([])
      expect(fmt(c.id, issues)).toEqual(
        reference.validateSheet(t, c.sheet, c.id)
      )
    })
  }
})

const templateMutations: [string, (t: Json) => void][] = [
  [
    'rótulo com HTML',
    t => {
      fieldsOf(t).name = { type: 'text', label: '<img src=x onerror=alert(1)>' }
    },
  ],
  [
    'rótulo com controle bidi',
    t => {
      t.name = `Vampiro${BIDI}oripmaV`
    },
  ],
  [
    'chave desconhecida no topo',
    t => {
      t.onclick = 'alert(1)'
    },
  ],
  [
    'chave desconhecida num campo',
    t => {
      fieldsOf(t).name = { type: 'text', label: 'Nome', style: 'color:red' }
    },
  ],
  [
    'tipo de campo fora da lista',
    t => {
      fieldsOf(t).name = { type: 'formula', label: 'Nome' }
    },
  ],
  [
    'derivação fora da lista',
    t => {
      fieldsOf(t).hack = {
        type: 'number',
        label: 'X',
        readOnly: true,
        derive: 'eval',
        from: 'name',
      }
    },
  ],
  [
    'derivação de item de lista que não é lista',
    t => {
      fieldsOf(t).hack = {
        type: 'number',
        label: 'X',
        readOnly: true,
        derive: 'half',
        from: { list: 'name', item: 'X' },
      }
    },
  ],
  [
    'derivação de item fora do catálogo da lista',
    t => {
      fieldsOf(t).hackList = {
        type: 'list',
        label: 'L',
        item: { value: { type: 'rating', min: 0, max: 5 } },
        catalog: ['A'],
      }
      fieldsOf(t).hack = {
        type: 'number',
        label: 'X',
        readOnly: true,
        derive: 'half',
        from: { list: 'hackList', item: 'B' },
      }
    },
  ],
  [
    'skin fora da lista',
    t => {
      t.skin = 'neon'
    },
  ],
  [
    'schema desconhecido',
    t => {
      t.schema = 2
    },
  ],
  [
    'templateVersion fora de semver',
    t => {
      t.templateVersion = '1.0'
    },
  ],
  [
    'cor livre no accent',
    t => {
      ;(t.accent as Json).fallback = '#ff0000'
    },
  ],
  [
    'dock com 4 campos',
    t => {
      t.dock = [...(t.dock as string[]), 'name']
    },
  ],
  [
    'campo de seção restrita no dock',
    t => {
      t.dock = [restrictedField(t)]
    },
  ],
  [
    'campo de seção restrita na identidade',
    t => {
      ;(t.identity as Json).summary = [restrictedField(t)]
    },
  ],
  [
    'coluna do cabeçalho cita campo inexistente',
    t => {
      ;(t.identity as Json).columns = [['naoExiste']]
    },
  ],
  [
    'emblema fora da lista fechada',
    t => {
      ;(t.identity as Json).emblem = 'caveira'
    },
  ],
  [
    'campo de seção restrita nas colunas do cabeçalho',
    t => {
      ;(t.identity as Json).columns = [[restrictedField(t)]]
    },
  ],
  [
    'seção cita campo inexistente',
    t => {
      sectionsOf(t)
        .find(s => Array.isArray(s.fields))
        ?.fields?.push('naoExiste')
    },
  ],
  [
    'id de seção repetido',
    t => {
      const [first] = sectionsOf(t)
      if (first) sectionsOf(t).push({ ...first })
    },
  ],
  [
    'layout fora da lista',
    t => {
      const [first] = sectionsOf(t)
      if (first) first.layout = 'html'
    },
  ],
  [
    'papel fora da lista',
    t => {
      const s = sectionsOf(t).find(x => x.permissions)
      if (s) s.permissions = { read: ['admin'] }
    },
  ],
  [
    'aninhamento acima de 12 níveis',
    t => {
      let deep: Json = { x: 1 }
      for (let i = 0; i < 14; i++) deep = { x: deep }
      t.ladders = { ...(t.ladders as Json), deep }
    },
  ],
  [
    'chave __proto__ no catálogo de campos',
    t => {
      t.fields = JSON.parse(
        JSON.stringify(t.fields).replace(
          /^\{/,
          '{"__proto__":{"type":"text","label":"x"},'
        )
      )
    },
  ],
  [
    'texto acima de 1000 caracteres',
    t => {
      t.license = 'x'.repeat(1001)
    },
  ],
  [
    'rótulo de aba acima de 14 caracteres',
    t => {
      t.zoneLabels = { build: 'x'.repeat(15) }
    },
  ],
  [
    'modelo de rolagem fora da lista',
    t => {
      ;(t.roll as Json).model = 'custom'
    },
  ],
]

const vtmOnlyMutations: [string, (t: Json) => void][] = [
  [
    'boost incompatível com o modelo de rolagem',
    t => {
      const [boost] = (t.roll as Json).boosts as Json[]
      if (boost) boost.effect = 'plus2'
    },
  ],
  [
    'penalidade de Vitalidade fora da faixa',
    t => {
      const [, level] = (fieldsOf(t).health?.levels ?? []) as Json[]
      if (level) level.penalty = -11
    },
  ],
  [
    'curar com tipo de dano inexistente',
    t => {
      const [heal] = (fieldsOf(t).blood?.actions ?? []) as Json[]
      if (heal) heal.params = { field: 'health', types: ['fire'] }
    },
  ],
  [
    'penalidade de rolagem fora de trilha wod-stacking',
    t => {
      ;(t.roll as Json).penalty = { field: 'willpower' }
    },
  ],
  [
    'teto de recurso derivado de campo inexistente',
    t => {
      const blood = fieldsOf(t).blood
      if (blood) blood.max = { derive: 'vtmBloodPool', from: 'naoExiste' }
    },
  ],
]

// As ações do menu da ficha (Regenerar, sem custo) passam pela mesma checagem
// das ações de recurso.
const wtaOnlyMutations: [string, (t: Json) => void][] = [
  [
    'regenerar com tipo de dano inexistente',
    t => {
      const [regenerate] = t.actions as Json[]
      if (regenerate) regenerate.params = { field: 'health', types: ['fire'] }
    },
  ],
  [
    'regenerar fora de trilha wod-stacking',
    t => {
      const [regenerate] = t.actions as Json[]
      if (regenerate) regenerate.params = { field: 'rage', types: ['lethal'] }
    },
  ],
]

describe('paridade em templates inválidos', () => {
  for (const [name, base] of [
    ['vtm-v20', vtm],
    ['dnd5e-2014', dnd],
    ['wta-w20', wta],
  ] as const) {
    const mutations =
      name === 'vtm-v20'
        ? [...templateMutations, ...vtmOnlyMutations]
        : name === 'wta-w20'
          ? wtaOnlyMutations
          : templateMutations
    for (const [label, mutate] of mutations) {
      it(`${name}: ${label}`, () => {
        const t = base()
        mutate(t)
        const expected = reference.validateTemplate(t, palette)
        expect(expected.length).toBeGreaterThan(0)
        expect(fmt(name, validateTemplate(t, palette))).toEqual(expected)
      })
    }
  }
})

type Values = Record<string, unknown>
const sheetMutations: [
  string,
  string,
  (values: Values, sheet: Json) => void,
][] = [
  [
    'vampiro',
    'chave desconhecida no topo da ficha',
    (_, s) => {
      s.ownerId = 'outro-usuario'
    },
  ],
  [
    'vampiro',
    'campo inexistente',
    v => {
      v.isAdmin = true
    },
  ],
  [
    'vampiro',
    '__proto__ como campo',
    (_, s) => {
      s.values = JSON.parse(
        JSON.stringify(s.values).replace(
          /^\{/,
          '{"__proto__":{"polluted":true},'
        )
      )
    },
  ],
  [
    'vampiro',
    'atributo acima do máximo',
    v => {
      v.strength = 6
    },
  ],
  [
    'vampiro',
    'atributo não inteiro',
    v => {
      v.strength = 2.5
    },
  ],
  [
    'vampiro',
    'atributo como texto',
    v => {
      v.strength = '3'
    },
  ],
  [
    'vampiro',
    'Força de Vontade acima do permanente',
    v => {
      v.willpower = { current: 8, permanent: 7 }
    },
  ],
  [
    'vampiro',
    'Força de Vontade com permanente fora da faixa',
    v => {
      v.willpower = { current: 5, permanent: 11 }
    },
  ],
  [
    'vampiro',
    'Sangue acima do máximo da Geração',
    v => {
      v.generation = 8
      v.blood = { current: 16 }
    },
  ],
  [
    'vampiro',
    'cliente grava o máximo derivado do Sangue',
    v => {
      v.blood = { current: 5, max: 99 }
    },
  ],
  [
    'vampiro',
    'recurso com chave desconhecida',
    v => {
      v.blood = { current: 5, bonus: 10 }
    },
  ],
  [
    'vampiro',
    'mais dano que níveis de Vitalidade',
    v => {
      v.health = { aggravated: 4, lethal: 4, bashing: 0 }
    },
  ],
  [
    'vampiro',
    'tipo de dano inexistente',
    v => {
      v.health = { fire: 1 }
    },
  ],
  [
    'vampiro',
    'Vitalidade como texto',
    v => {
      v.health = 'morto'
    },
  ],
  [
    'vampiro',
    'Disciplina com chave não declarada',
    v => {
      const [first] = v.disciplines as Json[]
      if (first) first.onclick = 'x'
    },
  ],
  [
    'vampiro',
    'Disciplina acima do máximo',
    v => {
      const [first] = v.disciplines as Json[]
      if (first) first.value = 6
    },
  ],
  [
    'vampiro',
    'Disciplinas com id repetido',
    v => {
      const list = v.disciplines as Json[]
      v.disciplines = [...list, { ...list[0] }]
    },
  ],
  [
    'vampiro',
    'lista acima de 200 itens',
    v => {
      v.disciplines = Array.from({ length: 201 }, (_, i) => ({
        id: `d${i}`,
        name: 'X',
      }))
    },
  ],
  [
    'vampiro',
    'nome acima do maxLength',
    v => {
      v.name = 'x'.repeat(81)
    },
  ],
  [
    'vampiro',
    'clã fora das opções',
    v => {
      v.clan = 'admin'
    },
  ],
  [
    'vampiro',
    'especialização em campo que não aceita',
    (_, s) => {
      s.specialties = { name: 'x' }
    },
  ],
  [
    'vampiro',
    'especialização acima de 80 caracteres',
    (_, s) => {
      s.specialties = { strength: 'x'.repeat(81) }
    },
  ],
  [
    'd&d',
    'cliente grava campo derivado (readOnly)',
    v => {
      v.proficiencyBonus = 6
    },
  ],
  [
    'd&d',
    'meta numérico de ataque como texto',
    v => {
      const [first] = v.attacks as Json[]
      if (first) first.meta = { ...(first.meta as Json), bonus: '+99' }
    },
  ],
  [
    'd&d',
    'meta não declarado',
    v => {
      const [first] = v.attacks as Json[]
      if (first) first.meta = { ...(first.meta as Json), script: 'x' }
    },
  ],
  [
    'lobisomem',
    'forma que não existe',
    v => {
      v.form = 'urrah'
    },
  ],
  [
    'lobisomem',
    'rito com valor (a lista não tem valor)',
    v => {
      v.rites = [{ id: 'r1', name: 'Rito da Contrição', value: 2 }]
    },
  ],
  [
    'lobisomem',
    'Gnose do fetiche acima de 10',
    v => {
      v.fetishes = [{ id: 'f1', name: 'Viola', meta: { level: 1, gnosis: 11 } }]
    },
  ],
]

describe('paridade em fichas inválidas', () => {
  const ids = { vampiro: 'helena', 'd&d': 'lia', lobisomem: 'iara' } as const
  for (const [who, label, mutate] of sheetMutations) {
    it(`${who}: ${label}`, () => {
      const c = character(ids[who as keyof typeof ids])
      const t = templates[c.system]
      mutate(c.sheet.values, c.sheet)
      const expected = reference.validateSheet(t, c.sheet, c.id)
      expect(expected.length).toBeGreaterThan(0)
      expect(fmt(c.id, validateSheet(t, c.sheet))).toEqual(expected)
    })
  }
})
