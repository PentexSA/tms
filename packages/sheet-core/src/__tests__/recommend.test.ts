/// <reference types="bun-types" />
import { describe, expect, it } from 'bun:test'
import { compileTemplate } from '../compile'
import { checkCreation, effectiveCreationConfig } from '../creation'
import { creationAdvice, recommendedFor, recommendOf } from '../recommend'
import { type ResolvedText, resolve } from '../resolve'
import { type Json, mta, vtm, wta } from './fixtures'

// recommendedFor e creationAdvice (D-07, D-09): o que a identidade recomenda
// e o que a criação só avisa. Nomes de Dom e resumos fictícios: o catálogo e
// os textos do produto são do time.

type Fields = Record<string, Json>
const fieldsOf = (t: Json) => t.fields as Fields

const w20 = () => {
  const t = wta()
  const gifts = fieldsOf(t).gifts as Json
  gifts.catalog = ['Faro do Asfalto', 'Passo de Neblina', 'Voz da Matilha']
  gifts.catalogDefaults = [
    { meta: 'rank', value: 2, items: ['Passo de Neblina'] },
  ]
  gifts.recommend = {
    outside: 'fora da Raça e da Tribo',
    by: [
      { from: 'breed', label: 'da Raça', map: { lupino: ['Faro do Asfalto'] } },
      {
        from: 'tribe',
        label: 'da Tribo',
        map: { fianna: ['Faro do Asfalto', 'Voz da Matilha'] },
      },
    ],
  }
  ;(t.creation as Json).advice = [
    { rule: 'item-meta-max', targets: ['gifts'], meta: 'rank', max: 1 },
  ]
  return compileTemplate(t)
}

const v20 = () => {
  const t = vtm()
  const f = fieldsOf(t)
  ;(f.disciplines as Json).recommend = {
    outside: 'fora do clã',
    by: [
      {
        from: 'clan',
        label: 'do clã',
        map: { brujah: ['Rapidez', 'Potência', 'Presença'] },
      },
    ],
  }
  ;(f.weakness as Json).default = {
    from: 'clan',
    map: {
      brujah: 'Resumo fictício A.',
      toreador: 'Resumo fictício B.',
    },
  }
  return compileTemplate(t)
}

const m20 = () => {
  const t = mta()
  ;(fieldsOf(t).affinity as Json).recommend = {
    outside: 'fora da Tradição',
    by: [
      {
        from: 'tradition',
        label: 'da Tradição',
        map: { verbena: ['life', 'forces'] },
      },
    ],
  }
  return compileTemplate(t)
}

describe('recommendedFor', () => {
  it('os selos de cada fonte; o mesmo nome em duas fontes leva os dois', () => {
    const model = w20()
    const sheet = resolve(model, {
      values: { breed: 'lupino', tribe: 'fianna' },
    })
    expect([...recommendedFor(model, sheet, 'gifts')]).toEqual([
      ['Faro do Asfalto', ['da Raça', 'da Tribo']],
      ['Voz da Matilha', ['da Tribo']],
    ])
  })

  it('sem escolha na fonte, opção sem entrada ou campo sem recommend: nada', () => {
    const model = v20()
    expect(
      recommendedFor(model, resolve(model, { values: {} }), 'disciplines').size
    ).toBe(0)
    const caitiff = resolve(model, { values: { clan: 'caitiff' } })
    expect(recommendedFor(model, caitiff, 'disciplines').size).toBe(0)
    expect(recommendedFor(model, caitiff, 'backgrounds').size).toBe(0)
    expect(recommendedFor(model, caitiff, 'naoExiste').size).toBe(0)
    expect(recommendOf(model, 'humanity')).toBeUndefined()
  })

  it('valor de choice que não é opção não recomenda nada', () => {
    const model = v20()
    const sheet = resolve(model, { values: { clan: '__proto__' } })
    expect(recommendedFor(model, sheet, 'disciplines').size).toBe(0)
  })

  it('no choice, recomenda ids de opção (a Esfera da Tradição)', () => {
    const model = m20()
    const sheet = resolve(model, { values: { tradition: 'verbena' } })
    expect([...recommendedFor(model, sheet, 'affinity').keys()]).toEqual([
      'life',
      'forces',
    ])
  })
})

describe('creationAdvice', () => {
  it('Dom acima do Posto 1: um aviso com os caminhos, não um problema', () => {
    const model = w20()
    const values = {
      breed: 'lupino',
      tribe: 'fianna',
      gifts: [
        { id: 'g1', name: 'Faro do Asfalto', meta: { rank: 1 } },
        { id: 'g2', name: 'Voz da Matilha', meta: { rank: 2 } },
        { id: 'g3', name: 'Faro do Asfalto', meta: { rank: 3 } },
      ],
    }
    expect(creationAdvice(model, resolve(model, { values }))).toEqual([
      {
        code: 'ADVICE_ABOVE_LEVEL',
        field: 'gifts',
        paths: ['values.gifts#g2', 'values.gifts#g3'],
        amount: 2,
      },
    ])
  })

  it('no máximo, sem o meta ou com o meta em texto: sem aviso', () => {
    const model = w20()
    const values = {
      breed: 'lupino',
      gifts: [
        { id: 'g1', name: 'Faro do Asfalto', meta: { rank: 1 } },
        { id: 'g2', name: 'Faro do Asfalto' },
        { id: 'g3', name: 'Faro do Asfalto', meta: { rank: 'dois' } },
      ],
    }
    expect(creationAdvice(model, resolve(model, { values }))).toEqual([])
  })

  it('lista fora de creation.advice não avisa o Posto', () => {
    const model = v20()
    const values = {
      clan: 'brujah',
      disciplines: [{ id: 'd1', name: 'Potência', value: 5 }],
    }
    expect(creationAdvice(model, resolve(model, { values }))).toEqual([])
  })

  it('Disciplina fora do clã: o caminho do item, também para texto livre', () => {
    const model = v20()
    const values = {
      clan: 'brujah',
      disciplines: [
        { id: 'd1', name: 'Potência', value: 1 },
        { id: 'd2', name: 'Dominação', value: 1 },
        { id: 'd3', name: 'Inventada', value: 1 },
      ],
    }
    expect(creationAdvice(model, resolve(model, { values }))).toEqual([
      {
        code: 'ADVICE_OUTSIDE',
        field: 'disciplines',
        paths: ['values.disciplines#d2', 'values.disciplines#d3'],
        amount: 2,
      },
    ])
  })

  it('sem Clã ou Caitiff, nada fica "fora"', () => {
    const model = v20()
    const disciplines = [{ id: 'd1', name: 'Dominação', value: 1 }]
    for (const clan of [undefined, 'caitiff'])
      expect(
        creationAdvice(model, resolve(model, { values: { clan, disciplines } }))
      ).toEqual([])
  })

  it('Esfera de afinidade fora da Tradição; dentro, nada', () => {
    const model = m20()
    const outside = resolve(model, {
      values: { tradition: 'verbena', affinity: 'time' },
    })
    expect(creationAdvice(model, outside)).toEqual([
      {
        code: 'ADVICE_OUTSIDE',
        field: 'affinity',
        paths: ['values.affinity'],
        amount: 1,
      },
    ])
    const inside = resolve(model, {
      values: { tradition: 'verbena', affinity: 'life' },
    })
    expect(creationAdvice(model, inside)).toEqual([])
    const none = resolve(model, { values: { tradition: 'verbena' } })
    expect(creationAdvice(model, none)).toEqual([])
  })

  it('o aviso não muda a conta: o mesmo checkCreation com e sem as chaves', () => {
    const t = wta()
    const plain = compileTemplate(t)
    const model = w20()
    const values = {
      breed: 'lupino',
      gifts: [{ id: 'g1', name: 'Faro do Asfalto', meta: { rank: 3 } }],
    }
    const input = (m: typeof model) => ({
      config: effectiveCreationConfig(m),
    })
    expect(checkCreation(model, { values }, input(model))).toEqual(
      checkCreation(plain, { values }, input(plain))
    )
  })
})

describe('resolve: o texto por opção (a Fraqueza do Clã)', () => {
  const text = (values: Json) =>
    resolve(v20(), { values }).get('weakness') as ResolvedText

  it('sem valor gravado, o texto da opção escolhida', () => {
    expect(text({ clan: 'brujah' })).toMatchObject({
      value: 'Resumo fictício A.',
      defaulted: true,
    })
    expect(text({ clan: 'toreador' }).value).toBe('Resumo fictício B.')
  })

  it('o valor gravado vence, inclusive vazio', () => {
    expect(text({ clan: 'brujah', weakness: 'Meu texto' })).toMatchObject({
      value: 'Meu texto',
      defaulted: false,
    })
    expect(text({ clan: 'brujah', weakness: '' })).toMatchObject({
      value: '',
      defaulted: false,
    })
  })

  it('opção sem entrada, sem Clã ou valor estranho: vazio', () => {
    for (const clan of ['caitiff', undefined, '__proto__', 42])
      expect(text({ clan })).toMatchObject({ value: '', defaulted: false })
  })

  it('campo de texto sem default continua igual', () => {
    const r = resolve(v20(), { values: { clan: 'brujah' } }).get('name')
    expect(r).toMatchObject({ value: '', defaulted: false })
  })
})
