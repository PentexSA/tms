/// <reference types="bun-types" />
import { expect, describe as group, it } from 'bun:test'
import { compileTemplate } from '../compile'
import { describe, FIELD_TYPES, plain, short, stored } from '../fields'
import { identityOf, UNNAMED } from '../identity'
import { REGISTRY } from '../registry'
import { resolve } from '../resolve'
import { validateSheet } from '../validate'
import { character, type Json, templates } from './fixtures'

// Frases da gramática de anúncio do design system (§9.2), com as fichas de
// exemplo de cada sistema. A ficha é ajustada só quando o exemplo pede.
function sheetOf(id: string, values: Json = {}) {
  const c = character(id)
  Object.assign(c.sheet.values, values)
  const model = compileTemplate(templates[c.system])
  return resolve(model, c.sheet)
}

function text(id: string, field: string, values: Json = {}) {
  const sheet = sheetOf(id, values)
  const r = sheet.get(field)
  if (!r) throw new Error(`campo ausente: ${field}`)
  return { short: short(r, sheet), describe: describe(r, sheet) }
}

group('FIELD_TYPES', () => {
  it('tem um comportamento para cada tipo da lista fechada', () => {
    expect(Object.keys(FIELD_TYPES).sort()).toEqual(
      [...REGISTRY.fieldTypes].sort()
    )
  })
})

group('todos os tipos, em todas as fichas de exemplo', () => {
  it('short, describe e plain devolvem texto; describe cita o rótulo', () => {
    for (const id of ['helena', 'tomas', 'iara', 'lia', 'joana', 'dandara']) {
      const sheet = sheetOf(id)
      for (const r of sheet.fields) {
        for (const fn of [short, describe, plain])
          expect(typeof fn(r, sheet)).toBe('string')
        // A roda (clock) se anuncia pelos preenchimentos, sem o rótulo (§9.2)
        const labels =
          r.type === 'clock' ? r.fills.map(x => x.label) : [r.field.def.label]
        for (const label of labels)
          expect(describe(r, sheet).includes(label)).toBe(true)
      }
    }
  })
})

group('describe: gramática de anúncio (design system §9.2)', () => {
  it.each([
    ['helena', 'dexterity', {}, 'Destreza, 2 de 5'],
    ['iara', 'rank', {}, 'Posto, 2 de 5, Fostern'],
    [
      'tomas',
      'forces',
      { forces: 4 },
      'Forças, 3 de 5, 1 inativo, máx. pelo Arete 3',
    ],
    [
      'helena',
      'intelligence',
      {},
      'Inteligência, 4 de 5, especialização Memória eidética',
    ],
    [
      'iara',
      'strength',
      { form: 'crinos' },
      'Força, 7, base 3 mais 4 da forma Crinos',
    ],
    ['lia', 'str', {}, 'Força, 8, modificador menos 1'],
    ['lia', 'initiative', {}, 'Iniciativa, mais 2'],
    ['dandara', 'athletics', { athletics: 4 }, 'Atletismo, Ótimo, mais 4'],
    ['joana', 'str', {}, 'Força, 45 por cento; difícil 22; extremo 9'],
    ['helena', 'blood', {}, 'Pontos de Sangue, 9 de 15'],
    ['lia', 'hp', {}, 'Pontos de Vida, 27 de 27, mais 5 temporários'],
    ['helena', 'willpower', {}, 'Força de Vontade, 5 de 7, permanente 7'],
    [
      'helena',
      'health',
      {},
      'Vitalidade: Machucado, penalidade menos 1; 1 letal, 1 contusivo',
    ],
    ['marta', 'health', {}, 'Vitalidade: Sem ferimentos; sem dano'],
    [
      'tomas',
      'wheel',
      {},
      'Quintessência e Paradoxo: Quintessência 6, Paradoxo 2, de 20 casas',
    ],
    ['iara', 'form', { form: 'crinos' }, 'Forma: Crinos'],
    ['lia', 'conditions', {}, 'Condições: nenhuma'],
    ['helena', 'disciplines', {}, 'Disciplinas: 3 itens'],
    ['helena', 'clan', {}, 'Clã: Tremere'],
    ['helena', 'generation', {}, 'Geração, 8ª geração'],
    ['iara', 'notes', {}, 'Notas: vazio'],
  ])('%s.%s → %p', (id, field, values, expected) => {
    expect(text(id, field, values).describe).toBe(expected)
  })

  it('valor acima do máximo não vira "7 de 5"', () => {
    expect(text('iara', 'strength', { form: 'crinos' }).describe).not.toContain(
      'de 5'
    )
  })

  it('set fixa o valor e diz a base', () => {
    expect(text('iara', 'appearance', { form: 'crinos' }).describe).toMatch(
      /^Aparência, 0 de 5, 0 na forma Crinos, base \d$/
    )
  })

  it('Vitalidade cheia anuncia incapacitado', () => {
    expect(
      text('helena', 'health', { health: { aggravated: 7 } }).describe
    ).toBe('Vitalidade: Incapacitado, penalidade incapacitado; 7 agravado')
  })

  it('caixas, espaços, tags e lista fixa', () => {
    expect(text('lia', 'deathSaves', {}).describe).toBe(
      'Testes contra a morte: Sucessos 0 de 3 marcadas; Falhas 0 de 3 marcadas'
    )
    expect(
      text('lia', 'spellSlots', { spellSlots: { '1': { max: 4, used: 1 } } })
        .describe
    ).toBe('Espaços de magia: 1º nível, 3 de 4 disponíveis')
    expect(text('lia', 'spellSlots', { spellSlots: {} }).describe).toBe(
      'Espaços de magia: nenhum'
    )
    expect(
      text('lia', 'conditions', { conditions: ['envenenado'] }).describe
    ).toBe('Condições: Envenenado')
    expect(text('dandara', 'consequences', {}).describe).toMatch(
      /^Consequências: \d de 3 preenchidas$/
    )
  })

  it('aspecto do Fate se anuncia como aspecto', () => {
    expect(text('dandara', 'highConcept', {}).describe).toBe(
      'Aspecto, Conceito: Ex-detetive endividado com a pessoa errada'
    )
  })

  it('resource com temporário sem teto (Glória do Lobisomem)', () => {
    expect(
      text('iara', 'glory', { glory: { current: 4, permanent: 3 } })
    ).toEqual({
      short: 'Permanente 3 · Temporário 4',
      describe: 'Glória: permanente 3, temporário 4',
    })
  })
})

group('short: texto do dock e da mesa', () => {
  it.each([
    ['helena', 'blood', {}, '9/15'],
    ['helena', 'willpower', {}, '5/7'],
    ['helena', 'health', {}, 'Machucado −1'],
    ['marta', 'health', {}, 'Sem ferimentos'],
    ['tomas', 'health', {}, 'Escoriado sem penalidade'],
    ['lia', 'hp', {}, '27/27 +5'],
    ['lia', 'deathSaves', {}, '0/6'],
    ['lia', 'spellSlots', {}, '1º 4/4'],
    ['lia', 'spellSlots', { spellSlots: {} }, '—'],
    ['lia', 'saveStr', {}, '−1'],
    ['lia', 'conditions', {}, 'nenhuma'],
    ['lia', 'conditions', { conditions: ['envenenado'] }, '1'],
    ['tomas', 'wheel', {}, 'Quintessência 6 · Paradoxo 2'],
    ['iara', 'form', {}, 'Hominídeo'],
    ['helena', 'strength', {}, '2'],
    ['helena', 'disciplines', {}, '3'],
    ['joana', 'str', {}, '45'],
  ])('%s.%s → %p', (id, field, values, expected) => {
    expect(text(id, field, values).short).toBe(expected)
  })
})

group('stored: o valor no formato de sheet_data', () => {
  it('todo campo guardável das fichas de exemplo volta igual e válido', () => {
    for (const id of [
      'helena',
      'caio',
      'marta',
      'beto',
      'tomas',
      'iara',
      'lia',
      'joana',
      'dandara',
    ]) {
      const c = character(id)
      const sheet = resolve(compileTemplate(templates[c.system]), c.sheet)
      const values: Json = {}
      for (const r of sheet.fields) {
        const v = stored(r, sheet)
        if (v !== undefined) values[r.id] = v
      }
      // Materializar os padrões nunca gera uma ficha que o servidor recusa.
      expect(
        validateSheet(templates[c.system], {
          values,
          specialties: c.sheet.specialties,
        })
      ).toEqual([])
      // E o que estava guardado continua igual.
      for (const [k, v] of Object.entries(c.sheet.values))
        expect({ [k]: values[k] }).toEqual({ [k]: v })
    }
  })

  it('ficha nova: os padrões preenchidos passam no validador', () => {
    for (const [system, t] of Object.entries(templates)) {
      const sheet = resolve(compileTemplate(t), { values: {} })
      const values: Json = {}
      for (const r of sheet.fields) {
        const v = stored(r, sheet)
        // Texto vazio e escolha sem opção ficam de fora (campo ausente).
        if (v !== undefined && v !== '') values[r.id] = v
      }
      expect({ system, issues: validateSheet(t, { values }) }).toEqual({
        system,
        issues: [],
      })
    }
  })

  it('tags guardam os ids das opções escolhidas', () => {
    const sheet = sheetOf('lia', { conditions: ['envenenado', 'cego'] })
    const r = sheet.get('conditions')
    expect(r && stored(r, sheet)).toEqual(['cego', 'envenenado'])
  })

  it('derivado nunca é guardado', () => {
    const sheet = sheetOf('lia')
    const r = sheet.get('initiative')
    expect(r && stored(r, sheet)).toBeUndefined()
  })

  it('resource com permanente leva o permanente (o validador exige)', () => {
    const sheet = resolve(compileTemplate(templates['vtm-v20']), { values: {} })
    const r = sheet.get('willpower')
    expect(r && stored(r, sheet)).toEqual({ current: 1, permanent: 1 })
  })
})

group('plain e identidade', () => {
  it('identidade do Vampiro', () => {
    expect(identityOf(sheetOf('helena'))).toEqual({
      name: 'Helena Varga',
      chip: 'Tremere',
      summary: 'Arquivista da Capela · 8ª geração',
      voice: 'Todo segredo tem um preço. Eu apenas anoto quem pagou.',
      subtitle: null,
      accent: 'accent-1',
    })
  })

  it('chipFormat monta o selo com campos (D&D)', () => {
    expect(identityOf(sheetOf('lia')).chip).toBe('Mago nv 5')
  })

  it('rating com rótulo de valor e subtítulo (Lobisomem)', () => {
    const id = identityOf(sheetOf('iara'))
    expect(id.summary).toBe('Posto 2 · Fostern · Galliard')
    expect(id.subtitle).toBe('Canta-Tempestade')
  })

  it('sem accent no template, accent-neutral (CoC)', () => {
    expect(identityOf(sheetOf('joana')).accent).toBe('accent-neutral')
  })

  it('opção sem mapa usa o fallback; nome vazio vira "Sem nome"', () => {
    const id = identityOf(sheetOf('helena', { clan: 'caitiff', name: '' }))
    expect(id.name).toBe(UNNAMED)
    expect(id.accent).toBe(
      compileTemplate(templates['vtm-v20']).template.accent.fallback
    )
  })

  it('plain de lista e de tags', () => {
    const sheet = sheetOf('lia', { conditions: ['envenenado'] })
    const conditions = sheet.get('conditions')
    expect(conditions && plain(conditions, sheet)).toBe('Envenenado')
    const helena = sheetOf('helena')
    const disciplines = helena.get('disciplines')
    expect(disciplines && plain(disciplines, helena)).toContain('Taumaturgia')
  })
})
