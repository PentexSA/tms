/// <reference types="bun-types" />
import { describe, expect, it } from 'bun:test'
import fc from 'fast-check'
import {
  compileTemplate,
  UnsupportedTemplateError,
  withValueDeps,
} from '../compile'
import type { Template } from '../contract'
import { formulaDeps, formulaValue } from '../defaults'
import { DERIVE, isDeriveName } from '../derive'
import { planClock } from '../effects'
import { stored } from '../fields'
import { type ResolvedRating, resolve } from '../resolve'
import { validateSheet, validateTemplate } from '../validate'
import { fmt, type Json, mta, palette, reference, vtm, wta } from './fixtures'

// `default` com fórmula (README §3): o valor de uma ficha nova acompanha as
// fontes até o jogador gravar o campo. Os templates de teste são os do
// produto com a fórmula acrescentada aqui, para o código não depender de
// nenhum sistema.

type Fields = Record<string, Json>
const fieldsOf = (t: Json) => t.fields as Fields
const field = (t: Json, id: string): Json => {
  const f = fieldsOf(t)[id]
  if (!f) throw new Error(`campo ausente: ${id}`)
  return f
}

const reader = (numbers: Record<string, number>, choices: Json = {}) => ({
  derive: (name: unknown, from: unknown) =>
    isDeriveName(name)
      ? DERIVE[name](
          ...(Array.isArray(from) ? from : [from]).map(x =>
            typeof x === 'string' ? (numbers[x] ?? 0) : 0
          )
        )
      : 0,
  choice: (id: string) => choices[id],
})

describe('formulaValue', () => {
  const map = { from: 'clan', map: { brujah: 3, ventrue: 9 } }
  it.each([
    ['sem fórmula: o mínimo', undefined, {}, {}, 1],
    ['inteiro', 4, {}, {}, 4],
    ['inteiro acima do máximo', 12, {}, {}, 10],
    ['inteiro quebrado: o mínimo', 2.5, {}, {}, 1],
    ['soma', { derive: 'sum', from: ['a', 'b'] }, { a: 3, b: 4 }, {}, 7],
    [
      'soma acima do máximo',
      { derive: 'sum', from: ['a', 'b'] },
      { a: 8, b: 8 },
      {},
      10,
    ],
    [
      'diferença abaixo do mínimo',
      { derive: 'difference', from: ['a', 'b'] },
      { a: 1, b: 5 },
      {},
      1,
    ],
    ['mapa', map, {}, { clan: 'brujah' }, 3],
    ['mapa acima do máximo', map, {}, { clan: 'ventrue' }, 9],
    ['opção sem entrada no mapa: o mínimo', map, {}, { clan: 'caitiff' }, 1],
    ['choice vazio: o mínimo', map, {}, {}, 1],
    ['choice com valor estranho: o mínimo', map, {}, { clan: ['brujah'] }, 1],
    ['forma desconhecida: o mínimo', { x: 1 }, {}, {}, 1],
  ])('%s', (_, formula, numbers, choices, expected) => {
    expect(formulaValue(formula, reader(numbers, choices), 1, 10)).toBe(
      expected
    )
  })

  it('o mapa só lê propriedade própria (sem cadeia de protótipos)', () => {
    const f = { from: 'clan', map: { brujah: 3 } }
    expect(formulaValue(f, reader({}, { clan: 'toString' }), 0, 10)).toBe(0)
  })

  it('formulaDeps: as fontes da derivação (a lista, para um item) e o choice', () => {
    expect(
      formulaDeps({
        derive: 'sum',
        from: ['a', { list: 'backgrounds', item: 'Avatar' }],
      })
    ).toEqual(['a', 'backgrounds'])
    expect(formulaDeps({ from: 'auspice', map: { ahroun: 5 } })).toEqual([
      'auspice',
    ])
    expect(formulaDeps(3)).toEqual([])
    expect(formulaDeps(undefined)).toEqual([])
  })
})

// Vampiro com Humanidade e FdV pelo livro, e um campo por opção de choice.
function vampire(): Json {
  const t = vtm()
  const f = fieldsOf(t)
  f.humanity = {
    ...f.humanity,
    default: { derive: 'sum', from: ['conscience', 'selfControl'] },
  }
  f.willpower = {
    ...f.willpower,
    permanent: {
      min: 1,
      max: 10,
      default: { derive: 'sum', from: ['courage'] },
    },
  }
  f.clanBonus = {
    type: 'rating',
    label: 'Bônus',
    min: 0,
    max: 5,
    default: { from: 'clan', map: { brujah: 3 } },
  }
  return t
}

describe('resolve: o valor inicial acompanha as fontes', () => {
  const model = compileTemplate(vampire())

  it('Humanidade = Consciência + Autocontrole, até ser gravada', () => {
    const fresh = resolve(model, { values: { name: 'Nova' } })
    // Virtudes no mínimo (1 + 1)
    expect((fresh.get('humanity') as ResolvedRating).base).toBe(2)
    const edited = resolve(model, {
      values: { conscience: 3, selfControl: 4 },
    })
    expect((edited.get('humanity') as ResolvedRating).value).toBe(7)
    // Gravada, para de acompanhar
    const own = resolve(model, {
      values: { conscience: 5, selfControl: 5, humanity: 6 },
    })
    expect((own.get('humanity') as ResolvedRating).value).toBe(6)
  })

  it('o permanente da FdV acompanha a Coragem, e o atual nasce cheio', () => {
    const r = resolve(model, { values: { courage: 3 } })
    expect(r.get('willpower')).toMatchObject({ permanent: 3, current: 3 })
    // Gravado (o primeiro gasto grava os dois), para de acompanhar
    const spent = resolve(model, {
      values: { courage: 5, willpower: { current: 2, permanent: 3 } },
    })
    expect(spent.get('willpower')).toMatchObject({ permanent: 3, current: 2 })
  })

  it('valor por opção de um choice; opção fora do mapa, o mínimo', () => {
    const brujah = resolve(model, { values: { clan: 'brujah' } })
    expect((brujah.get('clanBonus') as ResolvedRating).value).toBe(3)
    const toreador = resolve(model, { values: { clan: 'toreador' } })
    expect((toreador.get('clanBonus') as ResolvedRating).value).toBe(0)
  })

  it('stored materializa o valor calculado e a ficha continua válida', () => {
    const t = vampire()
    const r = resolve(compileTemplate(t), {
      values: { conscience: 3, selfControl: 4, courage: 2, clan: 'brujah' },
    })
    const values: Json = {}
    for (const f of r.fields) {
      const v = stored(f, r)
      if (v !== undefined && v !== '') values[f.id] = v
    }
    expect(values.humanity).toBe(7)
    expect(values.willpower).toEqual({ current: 2, permanent: 2 })
    expect(validateSheet(t, { values })).toEqual([])
  })

  it('a roda: cada preenchimento vale o padrão, sem passar das casas', () => {
    const t = mta()
    const wheel = fieldsOf(t).wheel as Json & { fills: Json[] }
    wheel.fills = wheel.fills.map(x =>
      x.id === 'quintessence'
        ? {
            ...x,
            default: {
              derive: 'sum',
              from: [{ list: 'backgrounds', item: 'Avatar' }],
            },
          }
        : { ...x, default: 18 }
    )
    const m = compileTemplate(t)
    const avatar = [{ id: 'b1', name: 'Avatar', value: 3 }]
    const r = resolve(m, { values: { backgrounds: avatar } }).get('wheel')
    // 3 de Quintessência; o Paradoxo pedia 18, mas só sobram 17 casas
    expect(r).toMatchObject({
      fills: [
        { id: 'quintessence', n: 3 },
        { id: 'paradox', n: 17 },
      ],
    })
    // Roda gravada: o que está gravado, sem padrão
    const saved = resolve(m, {
      values: { backgrounds: avatar, wheel: { quintessence: 1 } },
    }).get('wheel')
    expect(saved).toMatchObject({
      fills: [
        { id: 'quintessence', n: 1 },
        { id: 'paradox', n: 0 },
      ],
    })
  })

  it('planClock numa roda nunca gravada parte do padrão, não de zero', () => {
    const t = mta()
    const wheel = fieldsOf(t).wheel as Json & { fills: Json[] }
    wheel.fills = wheel.fills.map(x =>
      x.id === 'quintessence'
        ? {
            ...x,
            default: {
              derive: 'sum',
              from: [{ list: 'backgrounds', item: 'Avatar' }],
            },
          }
        : x
    )
    const m = compileTemplate(t)
    const sheet = {
      values: { backgrounds: [{ id: 'b1', name: 'Avatar', value: 3 }] },
    }
    const plan = planClock(m, sheet, 'wheel', 'paradox', 1)
    expect(plan).toMatchObject({
      events: [
        {
          // O `from` é o gravado (nada), que o servidor confere no conflito
          path: 'values.wheel',
          from: null,
          to: { quintessence: 3, paradox: 1 },
        },
      ],
    })
  })
})

describe('compile: dependências da fórmula', () => {
  it('ciclo pelo default é recusado', () => {
    const t = vtm()
    const f = fieldsOf(t)
    f.conscience = {
      ...f.conscience,
      default: { derive: 'sum', from: ['selfControl'] },
    }
    f.selfControl = {
      ...f.selfControl,
      default: { derive: 'sum', from: ['conscience'] },
    }
    let error: unknown
    try {
      compileTemplate(t)
    } catch (e) {
      error = e
    }
    expect(error).toBeInstanceOf(UnsupportedTemplateError)
    expect((error as UnsupportedTemplateError).issues[0]?.message).toMatch(
      /dependência circular/
    )
  })

  it('withValueDeps leva as fontes (a mesa mostra a FdV, que lê a Coragem)', () => {
    const t = vampire() as unknown as Template
    expect(withValueDeps(t, ['willpower', 'clanBonus'])).toEqual(
      new Set(['willpower', 'courage', 'clanBonus', 'clan'])
    )
  })
})

describe('validateTemplate: a fórmula, com paridade com a referência', () => {
  const cases: [string, (t: Json) => void, string][] = [
    [
      'derivação fora da lista fechada',
      t => {
        field(t, 'humanity').default = { derive: 'eval', from: 'courage' }
      },
      'fields.humanity.default.derive',
    ],
    [
      'fonte que não existe',
      t => {
        field(t, 'humanity').default = { derive: 'sum', from: ['nada'] }
      },
      'fields.humanity.default.from',
    ],
    [
      'item fora do catálogo',
      t => {
        field(t, 'humanity').default = {
          derive: 'sum',
          from: [{ list: 'backgrounds', item: 'Inventado' }],
        }
      },
      'fields.humanity.default.from',
    ],
    [
      'mapa em campo que não é choice',
      t => {
        field(t, 'humanity').default = { from: 'courage', map: { a: 1 } }
      },
      'fields.humanity.default.from',
    ],
    [
      'mapa com opção que não existe',
      t => {
        field(t, 'humanity').default = { from: 'clan', map: { lua: 1 } }
      },
      'fields.humanity.default.map.lua',
    ],
    [
      'valor do mapa fora de min..max',
      t => {
        field(t, 'humanity').default = { from: 'clan', map: { brujah: 11 } }
      },
      'fields.humanity.default.map.brujah',
    ],
    [
      'permanente com fonte que não existe',
      t => {
        const wp = field(t, 'willpower')
        wp.permanent = {
          min: 1,
          max: 10,
          default: { derive: 'sum', from: 'x' },
        }
      },
      'fields.willpower.permanent.default.from',
    ],
    [
      'permanente inteiro acima do máximo',
      t => {
        field(t, 'willpower').permanent = { min: 1, max: 10, default: 11 }
      },
      'fields.willpower.permanent.default',
    ],
  ]

  it('as fórmulas válidas passam nos dois validadores', () => {
    const t = vampire()
    expect(validateTemplate(t, palette)).toEqual([])
    expect(reference.validateTemplate(t, palette)).toEqual([])
  })

  for (const [label, mutate, path] of cases)
    it(label, () => {
      const t = vtm()
      mutate(t)
      const issues = validateTemplate(t, palette)
      expect(issues.map(i => i.path)).toContain(path)
      expect(fmt('vtm-v20', issues)).toEqual(
        reference.validateTemplate(t, palette)
      )
    })

  it('a roda: preenchimento com fonte que não existe', () => {
    const t = mta()
    const wheel = fieldsOf(t).wheel as Json & { fills: Json[] }
    wheel.fills = wheel.fills.map(x => ({
      ...x,
      default: { derive: 'sum', from: ['nada'] },
    }))
    const issues = validateTemplate(t, palette)
    expect(issues.map(i => i.path)).toContain(
      'fields.wheel.fills.quintessence.default.from'
    )
    expect(fmt('mta-m20', issues)).toEqual(
      reference.validateTemplate(t, palette)
    )
  })
})

describe('validateSheet: teto lido de um campo com fórmula', () => {
  // Um recurso cujo máximo é a Humanidade: sem Humanidade gravada, o teto é
  // a soma das Virtudes, igual ao que o resolve mostra.
  const t = vampire()
  fieldsOf(t).resolve = {
    type: 'resource',
    label: 'Determinação',
    max: { field: 'humanity' },
  }

  it.each([
    [
      'dentro do teto calculado',
      { conscience: 3, selfControl: 2, resolve: { current: 5 } },
    ],
    [
      'acima do teto calculado',
      { conscience: 3, selfControl: 2, resolve: { current: 6 } },
    ],
    ['FdV acima do permanente', { willpower: { current: 4, permanent: 3 } }],
  ])('%s (paridade)', (_, values) => {
    const sheet = { values }
    expect(fmt('x', validateSheet(t, sheet))).toEqual(
      reference.validateSheet(t, sheet, 'x')
    )
  })

  it('o teto é a soma, não o mínimo', () => {
    const sheet = {
      values: { conscience: 3, selfControl: 2, resolve: { current: 6 } },
    }
    expect(validateSheet(t, sheet)).toEqual([
      { path: 'values.resolve.current', message: 'acima do máximo (5)' },
    ])
  })
})

describe('propriedade: o valor inicial sempre cabe no campo', () => {
  const t = vampire()
  const model = compileTemplate(t)
  const virtue = fc.integer({ min: 1, max: 5 })
  const clan = fc.constantFrom('brujah', 'toreador', 'ventrue', undefined)

  it('para quaisquer Virtudes e clã, o padrão fica em min..max e a ficha materializada é válida', () => {
    fc.assert(
      fc.property(virtue, virtue, virtue, clan, (c, s, k, cl) => {
        const values: Json = { conscience: c, selfControl: s, courage: k }
        if (cl) values.clan = cl
        const r = resolve(model, { values })
        const humanity = r.get('humanity') as ResolvedRating
        expect(humanity.base).toBe(c + s)
        expect(r.get('willpower')).toMatchObject({ permanent: k, current: k })
        const out: Json = {}
        for (const f of r.fields) {
          const v = stored(f, r)
          if (v !== undefined && v !== '') out[f.id] = v
        }
        expect(validateSheet(t, { values: out })).toEqual([])
      })
    )
  })
})

describe('os templates do produto: valores iniciais do livro', () => {
  const v20 = compileTemplate(vtm())
  const m20 = compileTemplate(mta())
  const w20 = compileTemplate(wta())

  it('V20: Humanidade = Consciência + Autocontrole; FdV = Coragem', () => {
    const fresh = resolve(v20, { values: { name: 'Nova', clan: 'toreador' } })
    expect((fresh.get('humanity') as ResolvedRating).value).toBe(2)
    expect(fresh.get('willpower')).toMatchObject({ permanent: 1, current: 1 })
    const virtues = resolve(v20, {
      values: { conscience: 3, selfControl: 4, courage: 2 },
    })
    expect((virtues.get('humanity') as ResolvedRating).value).toBe(7)
    expect(virtues.get('willpower')).toMatchObject({
      permanent: 2,
      current: 2,
    })
  })

  it('M20: FdV 5; Quintessência = Avatar', () => {
    const fresh = resolve(m20, { values: { name: 'Novo' } })
    expect(fresh.get('willpower')).toMatchObject({ permanent: 5, current: 5 })
    expect(fresh.get('wheel')).toMatchObject({
      fills: [{ n: 0 }, { n: 0 }],
    })
    const avatar = resolve(m20, {
      values: { backgrounds: [{ id: 'b1', name: 'Avatar', value: 3 }] },
    })
    expect(avatar.get('wheel')).toMatchObject({
      fills: [
        { id: 'quintessence', n: 3 },
        { id: 'paradox', n: 0 },
      ],
    })
  })

  it.each([
    ['ragabash', 1, [0, 0, 0]],
    ['theurge', 2, [0, 0, 3]],
    ['philodox', 3, [0, 3, 0]],
    ['galliard', 4, [2, 0, 1]],
    ['ahroun', 5, [2, 1, 0]],
  ] as const)(
    'W20 %s: Fúria %i e Renome %p (Glória, Honra, Sabedoria)',
    (auspice, rage, [glory, honor, wisdom]) => {
      const r = resolve(w20, { values: { auspice } })
      expect(r.get('rage')).toMatchObject({ permanent: rage, current: rage })
      expect(r.get('glory')).toMatchObject({ permanent: glory, current: 0 })
      expect(r.get('honor')).toMatchObject({ permanent: honor, current: 0 })
      expect(r.get('wisdom')).toMatchObject({ permanent: wisdom, current: 0 })
    }
  )

  it.each([
    ['hominideo', 1],
    ['impuro', 3],
    ['lupino', 5],
  ])('W20 %s: Gnose %i, e a Forma continua Hominídeo', (breed, gnosis) => {
    const r = resolve(w20, { values: { breed } })
    expect(r.get('gnosis')).toMatchObject({ permanent: gnosis })
    expect(r.get('form')).toMatchObject({ option: { id: 'hominideo' } })
  })

  it.each([
    ['furias-negras', 3],
    ['roedores-de-ossos', 4],
    ['filhos-de-gaia', 4],
    ['fianna', 3],
    ['crias-de-fenris', 3],
    ['andarilhos-do-asfalto', 3],
    ['garras-vermelhas', 3],
    ['senhores-das-sombras', 3],
    ['peregrinos-silenciosos', 3],
    ['presas-de-prata', 3],
    ['observadores-das-estrelas', 4],
    ['uktena', 3],
    ['wendigo', 4],
  ])('W20 %s: Força de Vontade %i', (tribe, willpower) => {
    const r = resolve(w20, { values: { tribe } })
    expect(r.get('willpower')).toMatchObject({
      permanent: willpower,
      current: willpower,
    })
  })

  it('W20: toda tribo do template tem a FdV na tabela', () => {
    const tribe = w20.fields.get('tribe')?.def
    const wp = w20.fields.get('willpower')?.def
    if (tribe?.type !== 'choice' || wp?.type !== 'resource')
      throw new Error('fixture')
    const formula = wp.permanent?.default as { map: Record<string, number> }
    expect(Object.keys(formula.map).sort()).toEqual(
      tribe.options.map(o => o.id).sort()
    )
  })

  it('W20 Ahroun Impuro Garras Vermelhas', () => {
    const r = resolve(w20, {
      values: { auspice: 'ahroun', breed: 'impuro', tribe: 'garras-vermelhas' },
    })
    expect(r.get('rage')).toMatchObject({ permanent: 5 })
    expect(r.get('gnosis')).toMatchObject({ permanent: 3 })
    expect(r.get('willpower')).toMatchObject({ permanent: 3 })
    expect(r.get('glory')).toMatchObject({ permanent: 2 })
    expect(r.get('honor')).toMatchObject({ permanent: 1 })
  })
})
