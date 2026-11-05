/// <reference types="bun-types" />
import { describe, expect, it } from 'bun:test'
import { compileTemplate } from '../compile'
import { validateTemplate } from '../validate'
import { fmt, type Json, mta, palette, reference, vtm, wta } from './fixtures'

// As quatro chaves do P07-D no contrato do template (recommend,
// catalogDefaults, default por opção em texto e creation.advice): a forma
// certa passa, cada desvio é recusado, e a porta em TS dá os mesmos erros
// que a referência (design/scripts/validate.mjs). Os nomes de Dom são
// fictícios, para os desvios não dependerem do catálogo do produto (que tem
// o próprio teste em onda-4-content.test.ts).

type Fields = Record<string, Json>
const fieldsOf = (t: Json) => t.fields as Fields
const BIDI = String.fromCodePoint(0x202e)

// Um catálogo de Dons fictício, com Posto e recomendação por Raça e Tribo
const GIFTS = ['Faro do Asfalto', 'Passo de Neblina', 'Voz da Matilha']
function withGifts(t: Json): Json {
  const gifts = fieldsOf(t).gifts as Json
  gifts.catalog = GIFTS
  // As frases do catálogo do produto citam nomes que este catálogo não tem
  delete gifts.catalogHelp
  gifts.catalogDefaults = [
    { meta: 'rank', value: 1, items: ['Faro do Asfalto', 'Voz da Matilha'] },
    { meta: 'rank', value: 2, items: ['Passo de Neblina'] },
  ]
  gifts.recommend = {
    outside: 'fora da Raça e da Tribo',
    by: [
      { from: 'breed', label: 'da Raça', map: { lupino: ['Faro do Asfalto'] } },
      {
        from: 'tribe',
        label: 'da Tribo',
        map: { fianna: ['Voz da Matilha', 'Faro do Asfalto'] },
      },
    ],
  }
  ;(t.creation as Json).advice = [
    { rule: 'item-meta-max', targets: ['gifts'], meta: 'rank', max: 1 },
  ]
  return t
}

function withClan(t: Json): Json {
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
    map: { brujah: 'Resumo fictício de teste, uma linha.' },
  }
  return t
}

function withTradition(t: Json): Json {
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
  return t
}

const both = (system: string, t: Json) => {
  const issues = validateTemplate(t, palette)
  expect(fmt(system, issues)).toEqual(reference.validateTemplate(t, palette))
  return issues
}

describe('as chaves novas, na forma certa', () => {
  it.each([
    ['wta-w20', () => withGifts(wta())],
    ['vtm-v20', () => withClan(vtm())],
    ['mta-m20', () => withTradition(mta())],
    // O conteúdo da onda 4 (catálogo de Dons, Fraqueza e frases de poderes)
    ['wta-w20 do produto', () => wta()],
    ['vtm-v20 do produto', () => vtm()],
    ['mta-m20 do produto', () => mta()],
  ] as const)('%s valida e compila', (system, make) => {
    const t = make()
    expect(both(system, t)).toEqual([])
    expect(() => compileTemplate(t)).not.toThrow()
  })

  it('o app antigo, que não conhece as chaves, recusa o template (falha segura)', () => {
    // O validador de antes não tinha as chaves na allowlist: simulamos com
    // uma chave que nenhum validador conhece, no mesmo lugar.
    const t = vtm()
    ;(fieldsOf(t).disciplines as Json).recommendLater = { outside: 'x' }
    expect(both('vtm-v20', t)).toContainEqual({
      path: 'fields.disciplines.recommendLater',
      message: 'chave desconhecida (rejeitada)',
    })
  })
})

type Mutation = [string, (t: Json) => void, string]
const gifts = (t: Json) => fieldsOf(t).gifts as Json
const recommendOf = (t: Json) => gifts(t).recommend as Json
const firstSource = (t: Json) => (recommendOf(t).by as Json[])[0] as Json

const w20: Mutation[] = [
  [
    'from que não é choice',
    t => {
      firstSource(t).from = 'rage'
    },
    "campo 'rage' não é um choice",
  ],
  [
    'opção que não existe no from',
    t => {
      firstSource(t).map = { naoExiste: ['Faro do Asfalto'] }
    },
    "opção 'naoExiste' não existe em 'breed'",
  ],
  [
    'nome fora do catálogo',
    t => {
      firstSource(t).map = { lupino: ['Dom Inventado'] }
    },
    "'Dom Inventado' não está no catálogo",
  ],
  [
    'nome repetido numa entrada',
    t => {
      firstSource(t).map = { lupino: ['Faro do Asfalto', 'Faro do Asfalto'] }
    },
    'entrada repetida',
  ],
  [
    'entrada vazia',
    t => {
      firstSource(t).map = { lupino: [] }
    },
    'lista de 1 a 200 entradas',
  ],
  [
    'mapa vazio',
    t => {
      firstSource(t).map = {}
    },
    'de 1 a 100 opções',
  ],
  [
    'mais de 4 fontes',
    t => {
      const by = recommendOf(t).by as Json[]
      recommendOf(t).by = [...by, ...by, ...by]
    },
    'de 1 a 4 fontes',
  ],
  [
    'selo longo demais',
    t => {
      firstSource(t).label = 'x'.repeat(25)
    },
    'texto acima de 24 caracteres',
  ],
  [
    'outside com HTML',
    t => {
      recommendOf(t).outside = '<b>fora</b>'
    },
    'texto com caracteres proibidos (< >, controle ou bidi): rótulo é texto, nunca HTML',
  ],
  [
    'selo com controle bidi',
    t => {
      firstSource(t).label = `da${BIDI}Raça`
    },
    'texto com caracteres proibidos (< >, controle ou bidi): rótulo é texto, nunca HTML',
  ],
  [
    '__proto__ no mapa',
    t => {
      firstSource(t).map = JSON.parse('{"__proto__": ["Faro do Asfalto"]}')
    },
    'chave proibida',
  ],
  [
    'chave desconhecida na fonte',
    t => {
      firstSource(t).onclick = 'x'
    },
    'chave desconhecida (rejeitada)',
  ],
  [
    'catalogDefaults com meta que não existe',
    t => {
      ;(gifts(t).catalogDefaults as Json[])[0] = {
        meta: 'level',
        value: 1,
        items: ['Faro do Asfalto'],
      }
    },
    "meta numérico 'level' não existe no item",
  ],
  [
    'catalogDefaults com meta de texto',
    t => {
      ;(gifts(t).catalogDefaults as Json[])[0] = {
        meta: 'source',
        value: 1,
        items: ['Faro do Asfalto'],
      }
    },
    "meta numérico 'source' não existe no item",
  ],
  [
    'catalogDefaults fora da faixa do meta',
    t => {
      ;(gifts(t).catalogDefaults as Json[])[0] = {
        meta: 'rank',
        value: 6,
        items: ['Faro do Asfalto'],
      }
    },
    'precisa ser inteiro entre 1 e 5',
  ],
  [
    'catalogDefaults com nome fora do catálogo',
    t => {
      ;(gifts(t).catalogDefaults as Json[])[0] = {
        meta: 'rank',
        value: 1,
        items: ['Dom Inventado'],
      }
    },
    "'Dom Inventado' não está no catálogo",
  ],
  [
    'catalogDefaults com o mesmo nome duas vezes no mesmo meta',
    t => {
      ;(gifts(t).catalogDefaults as Json[])[1] = {
        meta: 'rank',
        value: 2,
        items: ['Faro do Asfalto'],
      }
    },
    "'Faro do Asfalto' já tem valor de 'rank'",
  ],
  [
    'catalogDefaults sem valor',
    t => {
      ;(gifts(t).catalogDefaults as Json[])[0] = {
        meta: 'rank',
        items: ['Faro do Asfalto'],
      }
    },
    'obrigatório',
  ],
  [
    'catalogDefaults vazio',
    t => {
      gifts(t).catalogDefaults = []
    },
    'de 1 a 10 entradas',
  ],
  [
    'advice com regra fora da lista',
    t => {
      ;((t.creation as Json).advice as Json[])[0] = {
        rule: 'item-meta-min',
        targets: ['gifts'],
        meta: 'rank',
        max: 1,
      }
    },
    "regra 'item-meta-min' fora da lista fechada",
  ],
  [
    'advice num campo que não é lista',
    t => {
      ;((t.creation as Json).advice as Json[])[0] = {
        rule: 'item-meta-max',
        targets: ['rage'],
        meta: 'rank',
        max: 1,
      }
    },
    "campo 'rage' não entra nesta conta",
  ],
  [
    'advice com meta que a lista não tem',
    t => {
      ;((t.creation as Json).advice as Json[])[0] = {
        rule: 'item-meta-max',
        targets: ['gifts'],
        meta: 'level',
        max: 1,
      }
    },
    "'gifts' não tem meta numérico 'level'",
  ],
  [
    'advice com max fora da faixa do meta',
    t => {
      ;((t.creation as Json).advice as Json[])[0] = {
        rule: 'item-meta-max',
        targets: ['gifts'],
        meta: 'rank',
        max: 9,
      }
    },
    'precisa ser inteiro entre 1 e 5',
  ],
  [
    'advice vazio',
    t => {
      ;(t.creation as Json).advice = []
    },
    'de 1 a 20 itens',
  ],
]

const v20: Mutation[] = [
  [
    'default de texto que não é objeto',
    t => {
      ;(fieldsOf(t).weakness as Json).default = 'texto solto'
    },
    'precisa ser objeto { from, map }',
  ],
  [
    'default de texto com from que não é choice',
    t => {
      ;(fieldsOf(t).weakness as Json).default = {
        from: 'name',
        map: { brujah: 'x' },
      }
    },
    "campo 'name' não é um choice",
  ],
  [
    'default de texto com opção que não existe',
    t => {
      ;(fieldsOf(t).weakness as Json).default = {
        from: 'clan',
        map: { naoExiste: 'x' },
      }
    },
    "opção 'naoExiste' não existe em 'clan'",
  ],
  [
    'default de texto com quebra de linha',
    t => {
      ;(fieldsOf(t).weakness as Json).default = {
        from: 'clan',
        map: { brujah: 'linha um\nlinha dois' },
      }
    },
    'uma linha só',
  ],
  [
    'default de texto com HTML',
    t => {
      ;(fieldsOf(t).weakness as Json).default = {
        from: 'clan',
        map: { brujah: '<script>x</script>' },
      }
    },
    'texto com caracteres proibidos (< >, controle ou bidi): rótulo é texto, nunca HTML',
  ],
  [
    'default de texto acima de 400',
    t => {
      ;(fieldsOf(t).weakness as Json).default = {
        from: 'clan',
        map: { brujah: 'x'.repeat(401) },
      }
    },
    'texto acima de 400 caracteres',
  ],
  [
    'default de texto acima do maxLength do campo',
    t => {
      ;(fieldsOf(t).name as Json).default = {
        from: 'clan',
        map: { brujah: 'x'.repeat(81) },
      }
    },
    'texto acima de 80 caracteres',
  ],
  [
    'default numérico num texto',
    t => {
      ;(fieldsOf(t).weakness as Json).default = 3
    },
    'precisa ser objeto { from, map }',
  ],
  [
    'recommend numa lista sem catálogo',
    t => {
      ;(fieldsOf(t).merits as Json).recommend = {
        outside: 'fora',
        by: [
          { from: 'clan', label: 'do clã', map: { brujah: ['Ambidestro'] } },
        ],
      }
    },
    "'Ambidestro' não está no catálogo",
  ],
  [
    'recommend num campo que não aceita',
    t => {
      ;(fieldsOf(t).humanity as Json).recommend = { outside: 'x', by: [] }
    },
    'chave desconhecida (rejeitada)',
  ],
  [
    'recommend que não é objeto',
    t => {
      ;(fieldsOf(t).disciplines as Json).recommend = ['Potência']
    },
    'precisa ser objeto',
  ],
  [
    'fontes que não são lista',
    t => {
      ;(fieldsOf(t).disciplines as Json).recommend = {
        outside: 'fora',
        by: 'clan',
      }
    },
    'precisa ser lista',
  ],
]

const m20: Mutation[] = [
  [
    'recommend num choice com id de opção que não existe',
    t => {
      ;(fieldsOf(t).affinity as Json).recommend = {
        outside: 'fora da Tradição',
        by: [
          { from: 'tradition', label: 'da Tradição', map: { verbena: ['x'] } },
        ],
      }
    },
    "opção 'x' não existe",
  ],
]

describe('as chaves novas, recusadas nos dois validadores', () => {
  for (const [system, base, cases] of [
    ['wta-w20', () => withGifts(wta()), w20],
    ['vtm-v20', () => withClan(vtm()), v20],
    ['mta-m20', () => withTradition(mta()), m20],
  ] as const) {
    for (const [label, mutate, message] of cases) {
      it(`${system}: ${label}`, () => {
        const t = base()
        mutate(t)
        const issues = both(system, t)
        expect(issues.map(i => i.message)).toContain(message)
      })
    }
  }
})
