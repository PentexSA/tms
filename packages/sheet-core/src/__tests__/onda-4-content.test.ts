/// <reference types="bun-types" />
import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { compileTemplate } from '../compile'
import { creationAdvice, recommendedFor } from '../recommend'
import { type ResolvedText, resolve } from '../resolve'
import { isSafeText } from '../validate/safe-text'
import { type Json, templates } from './fixtures'

// Onda 4: o conteúdo que esperava o time (catálogo de Dons do W20, resumo da
// Fraqueza do clã no V20 e frases de poderes), de
// doc/planos-pacotes/onda-4-conteudo.json, conferido contra os templates.
// Cada entrada está no caminho que a lista diz, com o mesmo texto, até 200
// caracteres (400 no resumo da Fraqueza), em uma linha, sem link nem marcação.
// Decisão do usuário (05/11/2026): nomes de traços e frases curtas de ficha
// podem entrar; o texto é do time, com palavras próprias, nunca do livro.

type Phrases = Record<string, string>
interface Content {
  readonly status: string
  readonly 'vtm-v20': {
    readonly weakness: {
      readonly default: { readonly from: string; readonly map: Phrases }
      readonly help: string
    }
    readonly disciplines: { readonly catalogHelp: Phrases }
  }
  readonly 'wta-w20': {
    readonly gifts: {
      readonly catalog: readonly string[]
      readonly catalogDefaults: readonly Json[]
      readonly recommend: {
        readonly outside: string
        readonly by: readonly {
          readonly from: string
          readonly label: string
          readonly map: Record<string, readonly string[]>
        }[]
      }
      readonly catalogHelp: Phrases
    }
  }
  readonly 'mta-m20': {
    readonly spheres: {
      readonly fieldHelp: Phrases
      readonly affinityOptionHelp: Phrases
    }
  }
}

const CONTENT = JSON.parse(
  readFileSync(
    join(
      import.meta.dir,
      '../../../../doc/planos-pacotes/onda-4-conteudo.json'
    ),
    'utf8'
  )
) as Content

const LINK = /:\/\/|www\./i
const textOk = (text: unknown, max: number) =>
  typeof text === 'string' &&
  text.trim().length > 0 &&
  text.length <= max &&
  isSafeText(text) &&
  !/[\t\n\r]/.test(text) &&
  !LINK.test(text)

type Fields = Record<string, Json>
const fieldsOf = (system: string) => templates[system]?.fields as Fields

describe('onda-4-conteudo.json', () => {
  it('é rascunho do time, para revisão', () => {
    expect(CONTENT.status).toBe('rascunho do time, para revisão')
  })
})

describe('V20: a Fraqueza do clã e as Disciplinas', () => {
  const fields = fieldsOf('vtm-v20')
  const c = CONTENT['vtm-v20']

  it('o default da Fraqueza é o da lista, um resumo por clã', () => {
    const weakness = fields.weakness as Json
    expect(weakness.default).toEqual(c.weakness.default)
    const clans = ((fields.clan as Json).options as Json[]).map(
      o => o.id as string
    )
    expect(Object.keys(c.weakness.default.map).sort()).toEqual(
      [...clans].sort()
    )
    const max = Math.min(400, weakness.maxLength as number)
    for (const [clan, text] of Object.entries(c.weakness.default.map))
      expect({ clan, ok: textOk(text, max) }).toEqual({ clan, ok: true })
  })

  it('a frase do campo é a nova, e cabe na frase curta', () => {
    expect((fields.weakness as Json).help).toBe(c.weakness.help)
    expect(textOk(c.weakness.help, 200)).toBe(true)
  })

  it('cada Disciplina do catálogo tem a frase da lista', () => {
    const disciplines = fields.disciplines as Json
    expect(disciplines.catalogHelp).toEqual(c.disciplines.catalogHelp)
    expect(Object.keys(c.disciplines.catalogHelp).sort()).toEqual(
      [...(disciplines.catalog as string[])].sort()
    )
    for (const [name, text] of Object.entries(c.disciplines.catalogHelp))
      expect({ name, ok: textOk(text, 200) }).toEqual({ name, ok: true })
  })
})

describe('W20: o catálogo de Dons', () => {
  const fields = fieldsOf('wta-w20')
  const gifts = fields.gifts as Json
  const c = CONTENT['wta-w20'].gifts

  it('catálogo, Posto inicial, recomendação e frases são os da lista', () => {
    expect(gifts.catalog).toEqual(c.catalog)
    expect(gifts.catalogDefaults).toEqual(c.catalogDefaults)
    expect(gifts.recommend).toEqual(c.recommend)
    expect(gifts.catalogHelp).toEqual(c.catalogHelp)
  })

  it('cada nome tem até 80 caracteres e uma frase curta; todos com Posto 1', () => {
    expect(c.catalog.length).toBeLessThanOrEqual(200)
    expect(new Set(c.catalog).size).toBe(c.catalog.length)
    expect(Object.keys(c.catalogHelp).sort()).toEqual([...c.catalog].sort())
    for (const name of c.catalog) {
      expect({ name, ok: textOk(name, 80) }).toEqual({ name, ok: true })
      expect({ name, ok: textOk(c.catalogHelp[name], 200) }).toEqual({
        name,
        ok: true,
      })
    }
    expect(c.catalogDefaults).toEqual([
      { meta: 'rank', value: 1, items: c.catalog },
    ])
  })

  it('o recommend: Raça, Augúrio e Tribo, com as opções do template', () => {
    expect(c.recommend.by.map(b => [b.from, b.label])).toEqual([
      ['breed', 'da Raça'],
      ['auspice', 'do Augúrio'],
      ['tribe', 'da Tribo'],
    ])
    expect(textOk(c.recommend.outside, 60)).toBe(true)
    for (const b of c.recommend.by) {
      const options = ((fields[b.from] as Json).options as Json[]).map(
        o => o.id as string
      )
      expect(Object.keys(b.map).sort()).toEqual([...options].sort())
      for (const names of Object.values(b.map))
        for (const name of names) expect(c.catalog).toContain(name)
    }
  })
})

describe('M20: as Esferas', () => {
  const fields = fieldsOf('mta-m20')
  const c = CONTENT['mta-m20'].spheres

  it('cada campo de Esfera tem a frase da lista', () => {
    for (const [id, text] of Object.entries(c.fieldHelp)) {
      expect({ id, help: fields[id]?.help }).toEqual({ id, help: text })
      expect({ id, ok: textOk(text, 200) }).toEqual({ id, ok: true })
    }
  })

  it('cada opção da Esfera de afinidade tem a frase da lista', () => {
    const options = (fields.affinity as Json).options as Json[]
    expect(options.map(o => o.id).sort()).toEqual(
      Object.keys(c.affinityOptionHelp).sort()
    )
    for (const o of options) {
      const text = c.affinityOptionHelp[o.id as string]
      expect({ id: o.id, help: o.help }).toEqual({ id: o.id, help: text })
      expect({ id: o.id, ok: textOk(text, 200) }).toEqual({
        id: o.id,
        ok: true,
      })
    }
  })
})

describe('o conteúdo no motor', () => {
  it('recommendedFor dá os Dons da Raça, do Augúrio e da Tribo escolhidos', () => {
    const model = compileTemplate(templates['wta-w20'] as Json)
    const sheet = resolve(model, {
      values: { breed: 'hominideo', auspice: 'ahroun', tribe: 'fianna' },
    })
    const by = CONTENT['wta-w20'].gifts.recommend.by
    const expected = new Map<string, string[]>()
    for (const [source, option] of [
      [by[0], 'hominideo'],
      [by[1], 'ahroun'],
      [by[2], 'fianna'],
    ] as const)
      for (const name of source?.map[option] ?? [])
        expected.set(name, [...(expected.get(name) ?? []), source?.label ?? ''])
    const got = recommendedFor(model, sheet, 'gifts')
    expect(new Map(got)).toEqual(expected)
    // Um Dom de duas fontes leva os dois selos
    expect(got.get('Persuasão')).toEqual(['da Raça', 'da Tribo'])
    expect(got.get('Inspiração')).toEqual(['do Augúrio'])
    expect(got.has('Salto da Lebre')).toBe(false)
  })

  it('o Dom fora dos três só avisa; nome livre continua aceito', () => {
    const model = compileTemplate(templates['wta-w20'] as Json)
    const values = {
      breed: 'hominideo',
      auspice: 'ahroun',
      tribe: 'fianna',
      gifts: [
        { id: 'g1', name: 'Persuasão', meta: { rank: 1 } },
        { id: 'g2', name: 'Salto da Lebre', meta: { rank: 1 } },
        { id: 'g3', name: 'Faro Inventado', meta: { rank: 1 } },
      ],
    }
    expect(creationAdvice(model, resolve(model, { values }))).toEqual([
      {
        code: 'ADVICE_OUTSIDE',
        field: 'gifts',
        paths: ['values.gifts#g2', 'values.gifts#g3'],
        amount: 2,
      },
    ])
  })

  describe('a Fraqueza do V20', () => {
    const model = compileTemplate(templates['vtm-v20'] as Json)
    const map = CONTENT['vtm-v20'].weakness.default.map
    const text = (values: Json) =>
      resolve(model, { values }).get('weakness') as ResolvedText

    it('vazia, mostra o resumo do clã escolhido', () => {
      for (const clan of ['brujah', 'toreador', 'caitiff'])
        expect(text({ clan })).toEqual(
          expect.objectContaining({ value: map[clan], defaulted: true })
        )
      expect(text({ clan: 'brujah', weakness: null }).value).toBe(
        map.brujah as string
      )
    })

    it('o texto do jogador vence, e trocar o Clã não o apaga', () => {
      for (const clan of ['brujah', 'ventrue'])
        expect(text({ clan, weakness: 'Texto da mesa.' })).toEqual(
          expect.objectContaining({ value: 'Texto da mesa.', defaulted: false })
        )
    })

    it('sem Clã, vazia', () => {
      expect(text({})).toEqual(
        expect.objectContaining({ value: '', defaulted: false })
      )
    })
  })
})
