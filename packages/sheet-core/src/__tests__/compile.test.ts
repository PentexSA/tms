/// <reference types="bun-types" />
import { describe, expect, it } from 'bun:test'
import {
  compileTemplate,
  DEFAULT_ZONE_LABELS,
  type SheetModel,
  UnsupportedTemplateError,
  withValueDeps,
} from '../compile'
import { REGISTRY } from '../registry'
import { resolve } from '../resolve'
import { validateSheet } from '../validate'
import { clone, dnd, type Json, mta, templates, vtm, wta } from './fixtures'

type Fields = Record<string, Json>
const fieldsOf = (t: Json) => t.fields as Fields

const unsupported = (t: unknown): UnsupportedTemplateError => {
  try {
    compileTemplate(t)
  } catch (e) {
    if (e instanceof UnsupportedTemplateError) return e
    throw e
  }
  throw new Error('compileTemplate deveria ter recusado o template')
}

describe('compileTemplate: os fixtures', () => {
  for (const [system, t] of Object.entries(templates)) {
    it(`compila ${system}`, () => {
      const model = compileTemplate(t)
      expect(model.system).toBe(system)
      expect(model.fields.size).toBe(Object.keys(fieldsOf(t)).length)
    })
  }
})

describe('compileTemplate: o modelo do Vampiro', () => {
  const model = compileTemplate(vtm())

  it('identifica o template', () => {
    expect(model.key).toBe('vtm-v20@1.3.0')
    expect(model.version).toBe('1.3.0')
    expect(model.skin).toBe('wod')
  })

  it('tem as 5 zonas na ordem fixa do app, com as seções na ordem do template', () => {
    expect(model.zones.map(z => z.id)).toEqual([...REGISTRY.zones])
    const sections = Object.fromEntries(
      model.zones.map(z => [z.id, z.sections.map(s => s.id)])
    )
    expect(sections).toEqual({
      identity: ['about-facts'],
      play: ['play'],
      build: ['attributes', 'abilities'],
      powers: ['advantages', 'merits-flaws', 'experience'],
      lore: ['about', 'storyteller'],
    })
  })

  it('a Fraqueza fica em Vantagens, ao lado da Trilha, como na ficha de papel', () => {
    const groups = model.sections.get('advantages')?.groups ?? []
    expect(groups.map(g => g.id).slice(-2)).toEqual(['morality', 'weakness'])
  })

  it('a Experiência disponível é derivada: total menos gasta', () => {
    const r = resolve(model, { values: { xpTotal: 12, xpSpent: 9 } })
    expect(r.number('xpAvailable')).toBe(3)
    expect(model.fields.get('xpAvailable')?.readOnly).toBe(true)
  })

  it('Qualidades e Defeitos ficam fora da parada de dados', () => {
    const from = model.roll.slots.flatMap(s => s.from)
    expect(from).not.toContain('merits-flaws')
    expect(from).not.toContain('experience')
  })

  it('rotula as abas com zoneLabels ou o padrão', () => {
    const labels = Object.fromEntries(model.zones.map(z => [z.id, z.label]))
    expect(labels).toEqual({
      identity: null,
      play: null,
      build: DEFAULT_ZONE_LABELS.build,
      powers: 'Vantagens',
      lore: DEFAULT_ZONE_LABELS.lore,
    })
  })

  it('indexa cada campo com seção, zona e editableIn efetivo', () => {
    const strength = model.fields.get('strength')
    expect(strength?.sectionIds).toEqual(['attributes'])
    expect(strength?.zone).toBe('build')
    expect(strength?.editableIn).toEqual(['edit'])

    expect(model.fields.get('blood')?.editableIn).toEqual(['play'])
    expect(model.fields.get('notes')?.editableIn).toEqual(['play', 'edit'])
    expect(model.fields.get('storytellerNotes')?.zone).toBe('lore')
  })

  it('campo fora de seção não tem zona (clã e geração só aparecem na identidade)', () => {
    expect(model.fields.get('clan')?.sectionIds).toEqual([])
    expect(model.fields.get('clan')?.zone).toBeNull()
  })

  it('achata os grupos de uma seção, mantendo os grupos', () => {
    const attributes = model.sections.get('attributes')
    expect(attributes?.groups?.map(g => g.fieldIds.length)).toEqual([3, 3, 3])
    expect(attributes?.fieldIds.slice(0, 3)).toEqual([
      'strength',
      'dexterity',
      'stamina',
    ])
  })

  it('marca a seção do narrador como restrita', () => {
    expect(model.sections.get('storyteller')?.restricted).toBe(true)
    expect(model.sections.get('about')?.restricted).toBe(false)
  })

  it('identityFields são os campos da criação de ficha', () => {
    // Na ordem das colunas da ficha impressa; a Geração é derivada do
    // antecedente e não entra na criação
    expect(model.identityFields).toEqual([
      'name',
      'nature',
      'demeanor',
      'concept',
      'clan',
      'sire',
    ])
  })

  it('dock e rolagem vêm do template', () => {
    expect(model.dock).toEqual(['health', 'blood', 'willpower'])
    expect(model.roll.model).toBe('pool-success')
  })
})

describe('compileTemplate: o Mago (M20, v1)', () => {
  const model = compileTemplate(mta())

  it('identityFields seguem as colunas da ficha impressa', () => {
    expect(model.identityFields).toEqual([
      'name',
      'nature',
      'demeanor',
      'concept',
      'tradition',
      'essence',
      'house',
    ])
  })

  it('Atributos e Habilidades viram abas no celular, como no Vampiro', () => {
    expect(model.sections.get('attributes')?.def.groupTabs).toBe(true)
    expect(model.sections.get('abilities')?.def.groupTabs).toBe(true)
  })

  it('as rotinas são uma lista em Vantagens', () => {
    expect(model.fields.get('rotes')?.def.type).toBe('list')
    expect(model.fields.get('rotes')?.zone).toBe('powers')
  })

  it('dock com a roda entre a Vitalidade e a FdV', () => {
    expect(model.dock).toEqual(['health', 'wheel', 'willpower'])
  })

  it('Vantagens na ordem da ficha: Esferas, Ressonância e o resto', () => {
    const powers = model.zones.find(z => z.id === 'powers')?.sections ?? []
    expect(powers.map(s => s.id)).toEqual([
      'spheres',
      'resonance',
      'backgrounds',
      'rotes',
      'wonders',
      'merits-flaws',
      'experience',
    ])
  })

  it('a Ressonância tem as três linhas fixas, com pontos e descritor', () => {
    const r = resolve(model, {
      values: { resonance: [{ id: 'entropic', text: 'Frio', value: 2 }] },
    }).get('resonance')
    expect(r).toMatchObject({
      items: [
        { id: 'dynamic', name: 'Dinâmica', text: '' },
        { id: 'entropic', name: 'Entrópica', text: 'Frio', value: 2 },
        { id: 'static', name: 'Estática', text: '' },
      ],
    })
  })
})

describe('compileTemplate: o Lobisomem (W20, v2)', () => {
  const model = compileTemplate(wta())

  it('identityFields seguem as colunas da ficha impressa', () => {
    // O Posto vem do resumo; é um rating e não entra no formulário de criação
    expect(model.identityFields).toEqual([
      'name',
      'deedName',
      'concept',
      'sept',
      'breed',
      'auspice',
      'camp',
      'tribe',
      'packName',
      'totem',
      'rank',
    ])
  })

  it('Atributos e Habilidades viram abas no celular, como no Vampiro', () => {
    expect(model.sections.get('attributes')?.def.groupTabs).toBe(true)
    expect(model.sections.get('abilities')?.def.groupTabs).toBe(true)
  })

  it('Ritos e Fetiches são listas em Vantagens, depois dos Dons', () => {
    for (const id of ['rites', 'fetishes']) {
      expect(model.fields.get(id)?.def.type).toBe('list')
      expect(model.fields.get(id)?.zone).toBe('powers')
    }
    const powers = [...model.sections.values()]
      .filter(s => s.zone === 'powers')
      .map(s => s.id)
    expect(powers.indexOf('rites')).toBe(powers.indexOf('gifts') + 1)
  })

  it('dock com a Forma ao lado da Vitalidade e da Fúria', () => {
    expect(model.dock).toEqual(['health', 'rage', 'form'])
  })
})

describe('os campos da ficha de papel nos três sistemas', () => {
  it.each([
    ['vtm-v20', '1.3.0'],
    ['mta-m20', '1.2.0'],
    ['wta-w20', '1.2.0'],
  ])('%s %s: Qualidades e Defeitos com custo de 1 a 10', (system, version) => {
    const t = templates[system] as Json
    expect(t.templateVersion).toBe(version)
    const ok = {
      merits: [{ id: 'm1', name: 'Q', meta: { kind: 'Social', cost: 2 } }],
      flaws: [{ id: 'f1', name: 'D', meta: { bonus: 3 }, notes: 'n' }],
    }
    expect(validateSheet(t, { values: ok })).toEqual([])
    const over = { merits: [{ id: 'm1', name: 'Q', meta: { cost: 11 } }] }
    expect(validateSheet(t, { values: over })).toEqual([
      { path: 'values.merits.0.meta.cost', message: 'acima do máximo 10' },
    ])
  })

  it('Lobisomem: Deformidade em Sobre e Cicatrizes numa seção própria', () => {
    const model = compileTemplate(wta())
    const lore = model.zones.find(z => z.id === 'lore')?.sections ?? []
    expect(lore.map(s => s.id)).toEqual([
      'about',
      'battle-scars',
      'storyteller',
    ])
    expect(model.sections.get('about')?.fieldIds).toContain('metisDeformity')
  })
})

describe('compileTemplate: o fixture de D&D (outra família)', () => {
  const model = compileTemplate(dnd())

  it('ordena os derivados depois das suas fontes', () => {
    const order = model.derivedOrder
    expect(order).toContain('proficiencyBonus')
    expect(order).toContain('initiative')
  })

  it('identityFields não inclui campo derivado e respeita o template', () => {
    expect(model.identityFields[0]).toBe('name')
    for (const id of model.identityFields)
      expect(model.fields.get(id)?.readOnly).toBe(false)
  })

  it('o campo derivado é readOnly', () => {
    expect(model.fields.get('initiative')?.readOnly).toBe(true)
    expect(model.fields.get('dex')?.readOnly).toBe(false)
  })
})

describe('withValueDeps', () => {
  it('inclui a cadeia de derivados e preserva ids desconhecidos', () => {
    const template = compileTemplate(vtm()).template

    expect(withValueDeps(template, ['blood', 'name', 'missing'])).toEqual(
      new Set(['blood', 'generation', 'backgrounds', 'name', 'missing'])
    )
  })

  it('inclui dependências de máximo por campo e de número derivado', () => {
    const template = compileTemplate(dnd()).template

    expect(withValueDeps(template, ['hitDice', 'initiative'])).toEqual(
      new Set(['hitDice', 'level', 'initiative', 'dex'])
    )
  })
})

describe('compileTemplate: fail secure', () => {
  it.each([[null], [undefined], [42], ['vtm-v20'], [[]]])(
    'recusa o que não é objeto (%p)',
    json => {
      expect(unsupported(json).issues).toEqual([
        { path: '', message: 'template malformado' },
      ])
    }
  )

  it('recusa schema desconhecido (template mais novo que o app)', () => {
    const t = vtm()
    t.schema = 2
    expect(unsupported(t).issues).toContainEqual({
      path: 'schema',
      message: 'versão de schema desconhecida',
    })
  })

  it('recusa type, layout e derivação fora das listas fechadas', () => {
    const t = vtm()
    fieldsOf(t).name = { type: 'formula', label: 'Nome' }
    ;(t.sections as Json[])[0] = {
      ...((t.sections as Json[])[0] as Json),
      layout: 'html',
    }
    fieldsOf(t).hack = {
      type: 'number',
      label: 'X',
      readOnly: true,
      derive: 'eval',
      from: 'generation',
    }
    const paths = unsupported(t).issues.map(i => i.path)
    expect(paths).toContain('fields.name.type')
    expect(paths).toContain('sections.about-facts.layout')
    expect(paths).toContain('fields.hack.derive')
  })

  it('recusa ciclo de derivados', () => {
    const t = dnd()
    fieldsOf(t).a = {
      type: 'number',
      label: 'A',
      readOnly: true,
      derive: 'half',
      from: 'b',
    }
    fieldsOf(t).b = {
      type: 'number',
      label: 'B',
      readOnly: true,
      derive: 'half',
      from: 'a',
    }
    const error = unsupported(t)
    expect(error.issues[0]?.message).toMatch(/^dependência circular/)
  })

  it('recusa teto circular entre ratings (o validador não pega)', () => {
    const t = vtm()
    const strength = fieldsOf(t).strength as Json
    const dexterity = fieldsOf(t).dexterity as Json
    strength.cap = { field: 'dexterity', label: 'máx. pela Destreza' }
    dexterity.cap = { field: 'strength', label: 'máx. pela Força' }
    expect(unsupported(t).issues[0]?.message).toContain(
      'strength → dexterity → strength'
    )
  })

  it('recusa objeto que não serializa (ciclo de referências)', () => {
    const t: Json = vtm()
    t.self = t
    expect(unsupported(t).issues[0]?.message).toBe('template malformado')
  })
})

describe('compileTemplate: memo e imutabilidade', () => {
  it('o mesmo conteúdo devolve a mesma instância', () => {
    expect(compileTemplate(vtm())).toBe(compileTemplate(vtm()))
  })

  it('mesma versão com conteúdo diferente é recompilada', () => {
    const a = compileTemplate(vtm())
    const t = vtm()
    ;(fieldsOf(t).name as Json).label = 'Nome completo'
    const b = compileTemplate(t)
    expect(b).not.toBe(a)
    expect(b.fields.get('name')?.def.label).toBe('Nome completo')
  })

  it('mudar o objeto de entrada depois não muda o modelo', () => {
    const t = clone(templates['vtm-v20'] as Json)
    const model: SheetModel = compileTemplate(t)
    ;(fieldsOf(t).name as Json).label = 'Outro'
    expect(model.fields.get('name')?.def.label).toBe('Nome')
  })

  it('o modelo é imutável, inclusive os Maps', () => {
    const model = compileTemplate(vtm())
    const name = model.fields.get('name')
    expect(() => {
      ;(name?.def as { label: string }).label = 'x'
    }).toThrow()
    expect(() => {
      ;(model as { system: string }).system = 'x'
    }).toThrow()
    const fields = model.fields as Map<string, unknown>
    expect(() => fields.set('x', {})).toThrow('imutável')
    expect(() => fields.delete('name')).toThrow('imutável')
    expect(() => fields.clear()).toThrow('imutável')
    expect(model.fields.size).toBeGreaterThan(0)
  })
})
