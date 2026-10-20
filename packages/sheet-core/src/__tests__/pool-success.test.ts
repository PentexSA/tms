/// <reference types="bun-types" />
import { describe, expect, it } from 'bun:test'
import fc from 'fast-check'
import { compileTemplate } from '../compile'
import type { SheetData } from '../contract'
import { applyBatch } from '../events'
import type { RandomSource } from '../random'
import { resolve } from '../resolve'
import {
  describePool,
  MAX_POOL_DICE,
  manualResult,
  outcomeText,
  type PoolPlan,
  planPool,
  poolOptions,
  poolPresets,
  poolRollOf,
  rollPool,
  scorePool,
} from '../rollers/pool-success'
import { character, templates } from './fixtures'

// Etapa 21: a parada `pool-success`. Cada regra com um RNG falso de
// sequência fixa; a fonte real só no teste de distribuição (random.test.ts).

const vtm = compileTemplate(templates['vtm-v20'])
const helena = (values: Record<string, unknown> = {}): SheetData => {
  const s = character('helena').sheet as unknown as SheetData
  return { ...s, values: { ...s.values, ...values } } as SheetData
}
const unhurt = { health: { aggravated: 0, lethal: 0, bashing: 0 } }

/** Faces de d10 em ordem: o valor x sorteia 1 + x % 10. */
const faces = (...values: number[]): RandomSource => {
  const queue = [...values]
  return {
    nextUint32() {
      const face = queue.shift()
      if (face === undefined) throw new Error('sequência acabou')
      return face - 1
    },
  }
}

const ok = (plan: PoolPlan) => {
  if (!plan.ok) throw new Error(plan.reason)
  return plan
}
const dexAthletics = {
  slots: { attribute: 'dexterity', ability: 'athletics' },
  difficulty: 6,
}

describe('a parada sai da ficha', () => {
  it('Destreza + Esportes: soma dos valores resolvidos, com a penalidade', () => {
    // Helena: Destreza 2, Esportes 1, Machucado (−1)
    const plan = ok(planPool(vtm, helena(), dexAthletics, ['owner']))
    expect(plan).toMatchObject({
      label: 'Destreza + Esportes',
      dice: 2,
      penalty: -1,
      difficulty: 6,
      die: 10,
      auto: 0,
      events: [],
    })
    expect(plan.modifiers).toEqual([
      { label: 'Ferimento (Machucado)', change: '−1 dado' },
    ])
    expect(
      ok(planPool(vtm, helena(unhurt), dexAthletics, ['owner'])).dice
    ).toBe(3)
  })

  it('o slot opcional pode ficar vazio; o obrigatório não', () => {
    expect(
      ok(
        planPool(
          vtm,
          helena(unhurt),
          { slots: { attribute: 'wits' }, difficulty: 6 },
          ['owner']
        )
      ).dice
    ).toBe(3)
    expect(
      planPool(vtm, helena(), { slots: { ability: 'occult' }, difficulty: 6 }, [
        'owner',
      ])
    ).toMatchObject({
      ok: false,
      kind: 'incomplete',
      reason: 'escolha atributo',
    })
  })

  it('item de lista (Disciplina) entra pela chave campo:item', () => {
    const plan = ok(
      planPool(
        vtm,
        helena(unhurt),
        {
          slots: { attribute: 'intelligence', ability: 'disciplines:d1' },
          difficulty: 7,
        },
        ['owner']
      )
    )
    expect(plan.label).toBe('Inteligência + Taumaturgia')
    expect(plan.dice).toBe(7)
  })

  it('as opções de cada slot vêm das seções do template', () => {
    const roll = poolRollOf(vtm)
    const resolved = resolve(vtm, helena())
    const [attribute, ability] = roll?.slots ?? []
    if (!attribute || !ability) throw new Error('slots')
    const attrs = poolOptions(vtm, resolved, attribute, ['owner'])
    expect(attrs.map(o => o.key)).toEqual([
      'strength',
      'dexterity',
      'stamina',
      'charisma',
      'manipulation',
      'appearance',
      'perception',
      'intelligence',
      'wits',
    ])
    expect(attrs.find(o => o.key === 'intelligence')).toMatchObject({
      label: 'Inteligência',
      value: 4,
      specialty: 'Memória eidética',
      group: 'Atributos',
    })
    const abilities = poolOptions(vtm, resolved, ability, ['owner'])
    expect(abilities.find(o => o.key === 'disciplines:d1')).toMatchObject({
      label: 'Taumaturgia',
      value: 3,
      specialty: 'Trilha do Sangue',
      group: 'Disciplinas',
    })
    // Atributo não é opção de Habilidade
    expect(abilities.some(o => o.key === 'dexterity')).toBe(false)
  })

  it('os atalhos de Fúria e Gnose do Lobisomem ficam disponíveis, pelo permanente', () => {
    const wta = compileTemplate(templates['wta-w20'])
    const c = character('iara')
    c.sheet.values.rage = { current: 0, permanent: 4 }
    const presets = poolPresets(
      wta,
      resolve(wta, c.sheet as unknown as SheetData),
      ['owner']
    )
    expect(
      presets.map(p => [p.id, p.available, p.slots.attribute?.value])
    ).toEqual([
      ['rage', true, 4],
      ['gnosis', true, 4],
    ])
  })

  it('modificador de estado aparece com a origem (Lobisomem em Crinos)', () => {
    const c = character('iara')
    const wta = compileTemplate(templates['wta-w20'])
    const sheet = {
      ...c.sheet,
      values: { ...c.sheet.values, form: 'crinos' },
    } as unknown as SheetData
    const resolved = resolve(wta, sheet)
    const slot = poolRollOf(wta)?.slots[0]
    if (!slot) throw new Error('slot')
    const options = poolOptions(wta, resolved, slot, ['owner'])
    expect(options.find(o => o.key === 'strength')?.modifiers).toEqual([
      'Crinos +4',
    ])
    expect(options.find(o => o.key === 'appearance')?.modifiers).toEqual([
      'Crinos: 0',
    ])
    const plan = ok(
      planPool(
        wta,
        sheet,
        { slots: { attribute: 'strength' }, difficulty: 6 },
        ['owner']
      )
    )
    expect(plan.modifiers[0]).toEqual({ label: 'Força', change: 'Crinos +4' })
  })

  it('seção que o papel não lê não oferece opção', () => {
    const t = structuredClone(templates['vtm-v20']) as {
      sections: { id: string; permissions?: unknown }[]
      templateVersion: string
    }
    t.templateVersion = '9.9.1'
    const abilities = t.sections.find(s => s.id === 'abilities')
    if (abilities) abilities.permissions = { read: ['storyteller'] }
    const restricted = compileTemplate(t)
    const req = {
      slots: { attribute: 'dexterity', ability: 'athletics' },
      difficulty: 6,
    }
    expect(planPool(restricted, helena(), req, ['player'])).toMatchObject({
      ok: false,
      kind: 'invalid',
    })
    expect(planPool(restricted, helena(), req, ['storyteller']).ok).toBe(true)
  })
})

describe('pedido hostil', () => {
  it.each([
    ['sem slots', { difficulty: 6 }],
    ['não é objeto', 'Destreza'],
    [
      'slot desconhecido',
      { slots: { attribute: 'dexterity', x: 'y' }, difficulty: 6 },
    ],
    ['chave que não é texto', { slots: { attribute: 3 }, difficulty: 6 }],
    [
      'opção de outro slot',
      { slots: { attribute: 'athletics' }, difficulty: 6 },
    ],
    [
      'campo que não existe',
      { slots: { attribute: '__proto__' }, difficulty: 6 },
    ],
    [
      'item que não existe',
      {
        slots: { attribute: 'dexterity', ability: 'disciplines:zz' },
        difficulty: 6,
      },
    ],
    ['dificuldade abaixo', { ...dexAthletics, difficulty: 1 }],
    ['dificuldade acima', { ...dexAthletics, difficulty: 11 }],
    ['dificuldade fracionária', { ...dexAthletics, difficulty: 6.5 }],
    ['dificuldade texto', { ...dexAthletics, difficulty: '6' }],
    ['boost desconhecido', { ...dexAthletics, boosts: ['sangue'] }],
    ['boost que não é lista', { ...dexAthletics, boosts: 'willpower' }],
    ['boost que não é texto', { ...dexAthletics, boosts: [1] }],
  ])('%s: inválido', (_, request) => {
    expect(planPool(vtm, helena(), request, ['owner'])).toMatchObject({
      ok: false,
      kind: 'invalid',
    })
  })

  it('pedido vazio de slots: escolha o que rolar', () => {
    const t = structuredClone(templates['vtm-v20']) as {
      roll: { slots: { optional?: boolean }[] }
      templateVersion: string
    }
    t.templateVersion = '9.9.2'
    for (const s of t.roll.slots) s.optional = true
    const loose = compileTemplate(t)
    expect(
      planPool(loose, helena(), { slots: {}, difficulty: 6 }, ['owner'])
    ).toMatchObject({
      ok: false,
      kind: 'incomplete',
      reason: 'escolha o que rolar',
    })
  })
})

describe('as regras da rolagem', () => {
  const plan = (extra: Record<string, unknown> = {}, values = unhurt) =>
    ok(planPool(vtm, helena(values), { ...dexAthletics, ...extra }, ['owner']))

  it('sucesso é face ≥ dificuldade', () => {
    const result = rollPool(plan(), faces(6, 5, 10))
    expect(result).toMatchObject({
      faces: [6, 5, 10],
      hits: 2,
      ones: 0,
      total: 2,
      outcome: 'success',
      text: '2 sucessos',
    })
  })

  it('cada 1 anula um sucesso', () => {
    expect(rollPool(plan(), faces(8, 1, 3))).toMatchObject({
      hits: 1,
      ones: 1,
      total: 0,
      outcome: 'failure',
      text: 'Falha',
    })
    expect(rollPool(plan(), faces(8, 9, 1))).toMatchObject({
      total: 1,
      text: '1 sucesso',
    })
  })

  it('falha crítica: nenhum sucesso e algum 1', () => {
    expect(rollPool(plan(), faces(1, 4, 2))).toMatchObject({
      outcome: 'botch',
      text: 'Falha crítica',
    })
    // Com sucesso anulado não é crítica
    expect(rollPool(plan(), faces(1, 7, 2)).outcome).toBe('failure')
  })

  it('especialização: o 10 conta 2 sucessos (só com especialização)', () => {
    const withSpec = ok(
      planPool(
        vtm,
        helena(unhurt),
        {
          slots: { attribute: 'intelligence' },
          difficulty: 6,
          specialty: true,
        },
        ['owner']
      )
    )
    expect(withSpec.specialty).toBe(true)
    expect(withSpec.modifiers).toContainEqual({
      label: 'Especialização',
      change: '10 conta 2 sucessos',
    })
    expect(rollPool(withSpec, faces(10, 10, 3, 1))).toMatchObject({
      hits: 4,
      ones: 1,
      total: 3,
    })
    // Destreza e Esportes da Helena não têm especialização: pedir não muda nada
    const without = plan({ specialty: true })
    expect(without.specialty).toBe(false)
    expect(rollPool(without, faces(10, 10, 3)).total).toBe(2)
  })

  it('FdV: +1 sucesso automático, que o 1 não anula, e o custo vira evento', () => {
    const boosted = plan({ boosts: ['willpower', 'willpower'] })
    expect(boosted.auto).toBe(1)
    expect(boosted.events).toEqual([
      {
        path: 'values.willpower',
        from: { current: 5, permanent: 7 },
        to: { current: 4, permanent: 7 },
      },
    ])
    expect(boosted.modifiers).toContainEqual({
      label: 'Força de Vontade',
      change: '+1 sucesso automático (gasta 1)',
    })
    // Os 1 anulam os dados, não o automático; com automático não há crítica
    expect(rollPool(boosted, faces(1, 1, 7))).toMatchObject({
      total: 1,
      outcome: 'success',
    })
    expect(rollPool(boosted, faces(1, 2, 3))).toMatchObject({
      total: 1,
      outcome: 'success',
    })
    // O lote do custo aplica na ficha como qualquer outro
    expect(applyBatch(vtm, helena(unhurt), boosted, ['owner']).ok).toBe(true)
  })

  it('FdV zerada ou papel sem escrita: não dá para gastar', () => {
    expect(
      planPool(
        vtm,
        helena({ ...unhurt, willpower: { current: 0, permanent: 7 } }),
        { ...dexAthletics, boosts: ['willpower'] },
        ['owner']
      )
    ).toMatchObject({
      ok: false,
      kind: 'cost',
      reason: 'Força de Vontade insuficiente',
    })
    expect(
      planPool(vtm, helena(), { ...dexAthletics, boosts: ['willpower'] }, [
        'player',
      ])
    ).toMatchObject({ ok: false, kind: 'cost' })
  })

  it('penalidade da Vitalidade tira dados; a parada nunca fica negativa', () => {
    // Aleijado: −5
    const hurt = { health: { aggravated: 0, lethal: 6, bashing: 0 } }
    const p = plan({}, hurt)
    expect(p.penalty).toBe(-5)
    expect(p.dice).toBe(0)
    expect(rollPool(p, faces())).toMatchObject({
      faces: [],
      total: 0,
      outcome: 'failure',
    })
  })

  it('incapacitado bloqueia a rolagem', () => {
    const out = { health: { aggravated: 0, lethal: 7, bashing: 0 } }
    expect(planPool(vtm, helena(out), dexAthletics, ['owner'])).toMatchObject({
      ok: false,
      kind: 'incapacitated',
      reason: 'incapacitado: não pode rolar',
    })
  })

  it(`a parada tem teto de ${MAX_POOL_DICE} dados`, () => {
    const t = structuredClone(templates['vtm-v20']) as {
      fields: Record<string, { max?: number }>
      roll: { slots: { id: string; label: string; from: string[] }[] }
      templateVersion: string
    }
    t.templateVersion = '9.9.3'
    const attrs = [
      'strength',
      'dexterity',
      'stamina',
      'charisma',
      'manipulation',
      'appearance',
    ]
    for (const id of attrs) {
      const f = t.fields[id]
      if (f) f.max = 10
    }
    t.roll.slots = attrs.map(id => ({ id, label: id, from: ['attributes'] }))
    const huge = compileTemplate(t)
    const values = Object.fromEntries(attrs.map(id => [id, 10]))
    const p = ok(
      planPool(
        huge,
        helena({ ...unhurt, ...values }),
        { slots: Object.fromEntries(attrs.map(id => [id, id])), difficulty: 6 },
        ['owner']
      )
    )
    expect(p.dice).toBe(MAX_POOL_DICE)
  })

  it('propriedade: total = max(0, sucessos − 1s) + automáticos', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 10 }), { maxLength: 20 }),
        fc.integer({ min: 2, max: 10 }),
        fc.boolean(),
        fc.integer({ min: 0, max: 2 }),
        (dice, difficulty, specialty, auto) => {
          const r = scorePool(dice, { difficulty, specialty, auto })
          const hits =
            dice.filter(x => x >= difficulty).length +
            (specialty ? dice.filter(x => x === 10).length : 0)
          const ones = dice.filter(x => x === 1).length
          return (
            r.total === Math.max(0, hits - ones) + auto &&
            (r.outcome === 'botch') === (hits === 0 && ones > 0 && auto === 0)
          )
        }
      )
    )
  })
})

describe('templates que usam outros campos', () => {
  it('slot sobre a seção "Em jogo": recurso entra pelo permanente, trilha não', () => {
    const t = structuredClone(templates['vtm-v20']) as {
      roll: {
        slots: {
          id: string
          label: string
          from: string[]
          optional?: boolean
        }[]
        boosts: {
          id: string
          label: string
          resource: string
          cost: number
          effect: string
        }[]
      }
      templateVersion: string
    }
    t.templateVersion = '9.9.4'
    t.roll.slots.push({
      id: 'virtue',
      label: 'Recurso',
      from: ['play'],
      optional: true,
    })
    // Dois boosts no mesmo recurso: o custo vira um evento só
    t.roll.boosts.push({ ...t.roll.boosts[0], id: 'willpower2' } as never)
    const m = compileTemplate(t)
    const slot = poolRollOf(m)?.slots.find(x => x.id === 'virtue')
    if (!slot) throw new Error('slot')
    const options = poolOptions(m, resolve(m, helena()), slot, ['owner'])
    // Vitalidade (trilha) não entra; Sangue pelo atual e FdV pelo permanente
    expect(options.map(o => [o.key, o.value])).toEqual([
      ['blood', 9],
      ['willpower', 7],
    ])
    const plan = ok(
      planPool(
        m,
        helena(unhurt),
        {
          slots: { attribute: 'dexterity', virtue: 'willpower' },
          difficulty: 6,
          boosts: ['willpower', 'willpower2'],
        },
        ['owner']
      )
    )
    expect(plan.dice).toBe(9)
    expect(plan.auto).toBe(2)
    expect(plan.events).toEqual([
      {
        path: 'values.willpower',
        from: { current: 5, permanent: 7 },
        to: { current: 3, permanent: 7 },
      },
    ])
  })
})

describe('"Rolei na mão" e a frase acessível', () => {
  it('o total informado, sem dados', () => {
    expect(manualResult(3)).toMatchObject({
      faces: [],
      total: 3,
      outcome: 'success',
    })
    expect(manualResult(0)).toMatchObject({ outcome: 'failure', text: 'Falha' })
    expect(manualResult(0, true)).toMatchObject({ outcome: 'botch' })
  })

  it.each([[-1], [1.5], [51], [Number.NaN]])('%p: recusado', n => {
    expect(manualResult(n)).toBeNull()
  })

  it('crítica com sucesso não existe', () => {
    expect(manualResult(2, true)).toBeNull()
  })

  it('os automáticos da FdV somam; com automático não há crítica', () => {
    expect(manualResult(2, false, 1)).toMatchObject({
      total: 3,
      auto: 1,
      hits: 2,
    })
    expect(manualResult(0, true, 1)).toMatchObject({
      total: 1,
      outcome: 'success',
    })
  })

  it('o leitor de tela ouve o resultado e os dados', () => {
    expect(
      describePool(
        scorePool([10, 7, 1], { difficulty: 6, specialty: false, auto: 0 })
      )
    ).toBe('1 sucesso. Dados: 10, 7, 1.')
    expect(describePool(manualResult(2) as never)).toBe('2 sucessos.')
    expect(outcomeText('botch', 0)).toBe('Falha crítica')
  })
})

describe('atalhos (roll.presets)', () => {
  const mta = compileTemplate(templates['mta-m20'])
  // Otto: Arete 2 e Forças 3 (1 inativo), Vitalidade com 2 letais (−1)
  const otto = (values: Record<string, unknown> = {}): SheetData => {
    const s = character('otto').sheet as unknown as SheetData
    return { ...s, values: { ...s.values, ...values, ...unhurt } } as SheetData
  }

  it('Conjurar efeito: parada de Arete, com a Habilidade vazia', () => {
    const plan = planPool(
      mta,
      otto(),
      { slots: {}, preset: 'magick', difficulty: 7 },
      ['owner']
    )
    if (!plan.ok) throw new Error(plan.reason)
    expect(plan.label).toBe('Conjurar efeito: Arete')
    expect(plan.preset).toBe('magick')
    expect(plan.dice).toBe(2)
    expect(plan.chosen.map(c => c.slot)).toEqual(['attribute'])
  })

  it('o atalho fixa o slot dele: o pedido não o sobrepõe', () => {
    const plan = planPool(
      mta,
      otto(),
      {
        slots: { attribute: 'forces', ability: 'technology' },
        preset: 'magick',
        difficulty: 6,
      },
      ['owner']
    )
    if (!plan.ok) throw new Error(plan.reason)
    expect(plan.label).toBe('Conjurar efeito: Arete + Tecnologia')
    expect(plan.dice).toBe(2 + 4)
  })

  it('Esfera inativa entra pelo valor efetivo (o teto)', () => {
    const forces = poolOptions(
      mta,
      resolve(mta, otto()),
      poolRollOf(mta)?.slots[0] as never,
      ['owner']
    ).find(o => o.key === 'forces')
    expect(forces?.value).toBe(2)
    expect(forces?.modifiers).toEqual(['1 inativo, máx. pelo Arete 2'])
  })

  it('atalho desconhecido ou num sistema sem atalhos → inválido', () => {
    for (const [model, sheet] of [
      [mta, otto()],
      [vtm, helena(unhurt)],
    ] as const)
      for (const preset of ['inexistente', '__proto__', 7])
        expect(
          planPool(model, sheet, { slots: {}, preset, difficulty: 6 }, [
            'owner',
          ])
        ).toEqual({ ok: false, kind: 'invalid', reason: 'atalho desconhecido' })
  })

  it('poolPresets: os atalhos com a opção já resolvida', () => {
    expect(poolPresets(mta, resolve(mta, otto()), ['owner'])).toEqual([
      expect.objectContaining({
        id: 'magick',
        label: 'Conjurar efeito',
        available: true,
        slots: {
          attribute: expect.objectContaining({ key: 'arete', value: 2 }),
        },
      }),
    ])
    expect(poolPresets(vtm, resolve(vtm, helena()), ['owner'])).toEqual([])
  })

  it('poolPresets: campo de seção sem leitura deixa o atalho indisponível', () => {
    const t = JSON.parse(JSON.stringify(templates['mta-m20']))
    for (const s of t.sections)
      if (s.id === 'spheres')
        s.permissions = { read: ['storyteller'], write: ['storyteller'] }
    const m = compileTemplate(t)
    const [preset] = poolPresets(m, resolve(m, otto()), ['owner'])
    expect(preset?.available).toBe(false)
    expect(
      planPool(m, otto(), { slots: {}, preset: 'magick', difficulty: 6 }, [
        'owner',
      ]).ok
    ).toBe(false)
  })
})

describe('multi-sistema', () => {
  it('Mago (M20) usa a mesma parada sem código de Mago', () => {
    const c = character('tomas')
    const mta = compileTemplate(templates['mta-m20'])
    const slot = poolRollOf(mta)?.slots[0]
    if (!slot) throw new Error('slot')
    const first = poolOptions(
      mta,
      resolve(mta, c.sheet as unknown as SheetData),
      slot,
      ['owner']
    )[0]
    const plan = planPool(
      mta,
      c.sheet as unknown as SheetData,
      { slots: { [slot.id]: first?.key }, difficulty: 6 },
      ['owner']
    )
    expect(plan.ok).toBe(true)
  })

  it.each(['dnd5e-2014', 'coc7e', 'fate-core'])(
    '%s não usa pool-success: sem parada',
    system => {
      const m = compileTemplate(templates[system])
      expect(poolRollOf(m)).toBeNull()
      expect(
        planPool(m, { values: {} } as SheetData, dexAthletics, ['owner'])
      ).toMatchObject({
        ok: false,
        kind: 'unsupported',
      })
    }
  )
})
