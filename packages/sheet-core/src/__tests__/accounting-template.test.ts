/// <reference types="bun-types" />
import { describe, expect, it } from 'bun:test'
import { compileTemplate, UnsupportedTemplateError } from '../compile'
import { validateTemplate } from '../validate'
import { acct } from './accounting-fixture'
import { dnd, fmt, type Json, palette, reference } from './fixtures'

// `creation` e `costs` no template (design/templates/README.md §14): a porta
// em TS dá os mesmos erros que a referência (design/scripts/validate.mjs),
// e o compile recusa o que deixaria a conta ambígua.

type T = Json & {
  fields: Record<string, Json>
  creation: Json & { budgets: Json[]; caps: Json[]; baselines: Json[] }
  costs: Json & { freebie: Json[]; xp: Json & { rules: Json[] } }
}
const budget = (t: T, i: number) =>
  t.creation.budgets[i] as Json & { groups: Json[] }
const freebie = (t: T, id: string) =>
  t.costs.freebie.find(e => e.id === id) as Json
const xpRule = (t: T, id: string) =>
  t.costs.xp.rules.find(e => e.id === id) as Json

// [rótulo, mutação, trecho esperado numa das mensagens]
const mutations: [string, (t: T) => void, string][] = [
  [
    'chave desconhecida em creation',
    t => {
      t.creation.extra = 1
    },
    'creation.extra: chave desconhecida',
  ],
  [
    'chave desconhecida em costs',
    t => {
      t.costs.extra = 1
    },
    'costs.extra: chave desconhecida',
  ],
  [
    'regra de orçamento fora da lista',
    t => {
      budget(t, 2).rule = 'eval'
    },
    "regra 'eval' fora da lista fechada",
  ],
  [
    'orçamentos não é lista',
    t => {
      t.creation.budgets = {} as never
    },
    'creation.budgets: de 1 a 20 itens',
  ],
  [
    'id de orçamento repetido',
    t => {
      budget(t, 1).id = 'attributes'
    },
    'creation.budgets.1.id: id inválido ou repetido',
  ],
  [
    'grupo repetido',
    t => {
      ;(budget(t, 0).groups[1] as Json).id = 'phys'
    },
    'groups.1.id: id inválido ou repetido',
  ],
  [
    'um orçamento por grupo',
    t => {
      budget(t, 0).budgets = [5, 3]
    },
    'um orçamento por grupo',
  ],
  [
    'orçamento fixo ausente',
    t => {
      delete budget(t, 2).budget
    },
    'creation.budgets.2.budget: obrigatório',
  ],
  [
    'campo em dois grupos',
    t => {
      ;((budget(t, 0).groups[1] as Json).targets as string[]).push('str')
    },
    "campo 'str' já está em",
  ],
  [
    'campo inexistente',
    t => {
      ;((budget(t, 0).groups[0] as Json).targets as string[]).push('nope')
    },
    "campo 'nope' não existe",
  ],
  [
    'campo repetido',
    t => {
      ;((budget(t, 0).groups[0] as Json).targets as string[]).push('str')
    },
    "campo 'str' repetido",
  ],
  [
    'texto não entra na conta',
    t => {
      ;((budget(t, 0).groups[0] as Json).targets as string[]).push('name')
    },
    "campo 'name' não entra nesta conta",
  ],
  [
    'preço de bônus diferente no grupo',
    t => {
      freebie(t, 'ability').targets = ['alert', 'lore', 'occult']
      t.costs.freebie.push({
        id: 'brawl',
        rule: 'flat',
        cost: 3,
        targets: ['brawl'],
      })
    },
    'preço de bônus diferente dentro do grupo',
  ],
  [
    'grupo com e sem preço',
    t => {
      freebie(t, 'ability').targets = ['alert', 'lore', 'occult']
    },
    'preço de bônus diferente dentro do grupo',
  ],
  [
    'lista sem pontos em orçamento de pontos',
    t => {
      budget(t, 3).rule = 'fixed-budget'
    },
    "lista 'gifts' sem pontos no item",
  ],
  [
    'preço por item dentro de orçamento',
    t => {
      t.creation.budgets.push({
        id: 'm',
        label: 'M',
        rule: 'item-count',
        budget: 1,
        targets: ['merits'],
      })
    },
    "campo 'merits' com preço por item não entra em orçamento",
  ],
  [
    'campo do extrato em orçamento',
    t => {
      t.creation.budgets.push({
        id: 'x',
        label: 'X',
        rule: 'fixed-budget',
        budget: 1,
        targets: ['xpTotal'],
      })
    },
    "campo 'xpTotal' é do extrato de XP",
  ],
  [
    'regra de bônus fora da lista',
    t => {
      freebie(t, 'will').rule = 'free'
    },
    "regra 'free' fora da lista fechada",
  ],
  [
    'id de bônus repetido',
    t => {
      freebie(t, 'will').id = 'morality'
    },
    'id inválido ou repetido',
  ],
  [
    'campo com dois preços de bônus',
    t => {
      ;(freebie(t, 'will').targets as string[]).push('morality')
    },
    "campo 'morality' já tem preço de bônus",
  ],
  [
    'flat sem custo',
    t => {
      delete freebie(t, 'will').cost
    },
    'costs.freebie.6.cost: obrigatório',
  ],
  [
    'flat com meta',
    t => {
      freebie(t, 'will').meta = 'cost'
    },
    'costs.freebie.6.meta: não se aplica à regra',
  ],
  [
    'item-meta com custo',
    t => {
      freebie(t, 'merits').cost = 1
    },
    'costs.freebie.9.cost: não se aplica à regra',
  ],
  [
    'item-meta com teto',
    t => {
      freebie(t, 'merits').max = 1
    },
    'costs.freebie.9.max: não se aplica à regra',
  ],
  [
    'meta que o item não tem',
    t => {
      freebie(t, 'merits').meta = 'price'
    },
    "'merits' não tem meta numérico 'price'",
  ],
  [
    'credit sem teto',
    t => {
      delete freebie(t, 'flaws').max
    },
    'costs.freebie.10.max: obrigatório',
  ],
  [
    'item-meta em campo que não é lista',
    t => {
      t.costs.freebie.push({
        id: 'z',
        rule: 'item-meta',
        meta: 'cost',
        targets: ['str'],
      })
    },
    "campo 'str' não entra nesta conta",
  ],
  [
    'bônus no campo do extrato',
    t => {
      t.costs.freebie.push({
        id: 'z',
        rule: 'flat',
        cost: 1,
        targets: ['xpSpent'],
      })
    },
    "campo 'xpSpent' é do extrato de XP",
  ],
  [
    'extrato derivado',
    t => {
      t.costs.xp.total = 'xpAvailable'
    },
    "campo 'xpAvailable' precisa ser number gravável",
  ],
  [
    'total igual ao gasto',
    t => {
      t.costs.xp.spent = 'xpTotal'
    },
    'total e gasto são campos diferentes',
  ],
  [
    'chave desconhecida no XP',
    t => {
      t.costs.xp.extra = 1
    },
    'costs.xp.extra: chave desconhecida',
  ],
  [
    'regra de XP fora da lista',
    t => {
      xpRule(t, 'will').rule = 'free'
    },
    "regra 'free' fora da lista fechada",
  ],
  [
    'id de XP repetido',
    t => {
      xpRule(t, 'will').id = 'arete'
    },
    'id inválido ou repetido',
  ],
  [
    'campo em duas regras de XP',
    t => {
      ;(xpRule(t, 'will').targets as string[]).push('arete')
    },
    "campo 'arete' já está em",
  ],
  [
    'XP no campo do extrato',
    t => {
      ;(xpRule(t, 'will').targets as string[]).push('xpTotal')
    },
    "campo 'xpTotal' é do extrato de XP",
  ],
  [
    'XP em lista sem pontos',
    t => {
      t.costs.xp.rules.push({
        id: 'g',
        rule: 'flat',
        cost: 5,
        targets: ['gifts'],
      })
    },
    "lista 'gifts' sem pontos no item",
  ],
  [
    'per-current sem fator',
    t => {
      delete xpRule(t, 'will').factor
    },
    'costs.xp.rules.6.factor: obrigatório',
  ],
  [
    'per-current com custo',
    t => {
      xpRule(t, 'will').cost = 3
    },
    'costs.xp.rules.6.cost: não se aplica à regra',
  ],
  [
    'flat com fator',
    t => {
      xpRule(t, 'will').rule = 'flat'
      xpRule(t, 'will').cost = 2
    },
    'costs.xp.rules.6.factor: não se aplica à regra',
  ],
  [
    'novo fora da faixa',
    t => {
      xpRule(t, 'will').new = 0
    },
    'costs.xp.rules.6.new: precisa ser inteiro entre 1 e 1000',
  ],
  [
    'exceção que não muda nada',
    t => {
      xpRule(t, 'will').when = [{ if: { field: 'lineage', in: ['a'] } }]
    },
    'a exceção não muda nada',
  ],
  [
    'exceção com chave desconhecida',
    t => {
      xpRule(t, 'will').when = [
        { if: { field: 'lineage', in: ['a'] }, factor: 2, hack: 1 },
      ]
    },
    'when.0.hack: chave desconhecida',
  ],
  [
    'unavailable diferente de true',
    t => {
      xpRule(t, 'will').when = [
        { if: { field: 'lineage', in: ['a'] }, unavailable: false },
      ]
    },
    'when.0.unavailable: só aceita true',
  ],
  [
    'condição sobre campo que não é choice',
    t => {
      xpRule(t, 'will').when = [{ if: { field: 'str', in: ['a'] }, factor: 2 }]
    },
    "campo 'str' não é um choice",
  ],
  [
    'condição sem comparação',
    t => {
      xpRule(t, 'will').when = [{ if: { field: 'lineage' }, factor: 2 }]
    },
    'declare in ou equalsTarget',
  ],
  [
    'opção que não existe',
    t => {
      xpRule(t, 'will').when = [
        { if: { field: 'lineage', in: ['z'] }, factor: 2 },
      ]
    },
    "opção 'z' não existe em 'lineage'",
  ],
  [
    'equalsTarget falso',
    t => {
      xpRule(t, 'will').when = [
        { if: { field: 'lineage', equalsTarget: false }, factor: 2 },
      ]
    },
    'equalsTarget: só aceita true',
  ],
  [
    'itemIn em campo que não é lista',
    t => {
      xpRule(t, 'will').when = [
        { if: { field: 'lineage', in: ['a'], itemIn: ['X'] }, factor: 2 },
      ]
    },
    'itemIn: só vale para listas',
  ],
  [
    'itemIn fora do catálogo',
    t => {
      ;(xpRule(t, 'power').when as Json[])[0] = {
        if: { field: 'lineage', in: ['a'], itemIn: ['Inventado'] },
        factor: 5,
      }
    },
    "'Inventado' não está no catálogo das listas",
  ],
  [
    'teto fora da lista',
    t => {
      ;(t.creation.caps[0] as Json).rule = 'soft'
    },
    "regra 'soft' fora da lista fechada",
  ],
  [
    'teto dos básicos por campo',
    t => {
      ;(t.creation.caps[0] as Json).max = { field: 'arete' }
    },
    'o teto dos básicos é um número',
  ],
  [
    'teto por campo que não é número',
    t => {
      ;(t.creation.caps[2] as Json).max = { field: 'lineage' }
    },
    'o teto precisa ser rating ou number',
  ],
  [
    'teto sem máximo',
    t => {
      delete (t.creation.caps[1] as Json).max
    },
    'creation.caps.1.max: obrigatório',
  ],
  [
    'teto em campo fora da conta',
    t => {
      ;(t.creation.caps[1] as Json).targets = ['xpTotal']
    },
    "campo 'xpTotal' fora da conta da criação",
  ],
  [
    'inicial fora da faixa',
    t => {
      ;(t.creation.baselines[0] as Json).value = 9
    },
    "precisa caber na faixa de 'app'",
  ],
  [
    'inicial travado falso',
    t => {
      ;(t.creation.baselines[0] as Json).locked = false
    },
    'locked: só aceita true',
  ],
  [
    'inicial com itemIn',
    t => {
      ;(t.creation.baselines[0] as Json).when = {
        field: 'lineage',
        in: ['c'],
        itemIn: ['X'],
      }
    },
    'when.itemIn: só vale para listas',
  ],
  [
    'inicial em lista',
    t => {
      ;(t.creation.baselines[0] as Json).targets = ['powers']
    },
    "campo 'powers' não entra nesta conta",
  ],
  [
    'fora da conta repetindo campo contado',
    t => {
      t.creation.untracked = ['str']
    },
    "campo 'str' já está na conta da criação",
  ],
  [
    'fora da conta inexistente',
    t => {
      t.creation.untracked = ['nope']
    },
    "campo 'nope' não existe",
  ],
  [
    'saldo de bônus fora da faixa',
    t => {
      t.creation.freebies = -1
    },
    'creation.freebies: precisa ser inteiro entre 0 e 1000',
  ],
]

describe('creation e costs: rejeições com paridade', () => {
  for (const [label, mutate, message] of mutations) {
    it(label, () => {
      const t = acct() as T
      mutate(t)
      const issues = validateTemplate(t, palette)
      const expected = reference.validateTemplate(t, palette)
      expect(fmt('acct-teste', issues)).toEqual(expected)
      expect(expected.join('\n')).toContain(message)
      expect(() => compileTemplate({ ...t, templateVersion: '7.7.7' })).toThrow(
        UnsupportedTemplateError
      )
    })
  }
})

describe('point-buy no template', () => {
  type D = Json & { creation: { budgets: Json[] }; costs?: Json }
  const pointBuy: [string, (b: Json, t: D) => void, string][] = [
    [
      'tabela abaixo do mínimo do campo',
      b => {
        b.base = 0
      },
      "a tabela sai da faixa de 'str'",
    ],
    [
      'tabela acima do máximo do campo',
      b => {
        b.table = Array.from({ length: 25 }, (_, i) => i)
      },
      "a tabela sai da faixa de 'str'",
    ],
    [
      'custo acumulado diminui',
      b => {
        b.table = [0, 2, 1]
      },
      'o custo acumulado não diminui',
    ],
    [
      'o valor base custa 0',
      b => {
        b.table = [1, 2]
      },
      'o valor base custa 0',
    ],
    [
      'tabela curta',
      b => {
        b.table = [0]
      },
      'de 2 a 30 valores',
    ],
    [
      'base ausente',
      b => {
        delete b.base
      },
      'base: obrigatório',
    ],
    [
      'point-buy em recurso',
      b => {
        b.targets = ['hp']
      },
      "campo 'hp' não entra nesta conta",
    ],
    [
      'point-buy com preço de bônus',
      (_, t) => {
        t.costs = {
          freebie: [{ id: 'a', rule: 'flat', cost: 1, targets: ['str'] }],
        }
      },
      "campo 'str' de point-buy não compra com bônus",
    ],
  ]
  for (const [label, mutate, message] of pointBuy) {
    it(label, () => {
      const t = dnd() as D
      mutate(t.creation.budgets[0] as Json, t)
      const expected = reference.validateTemplate(t, palette)
      expect(fmt('dnd5e-2014', validateTemplate(t, palette))).toEqual(expected)
      expect(expected.join('\n')).toContain(message)
    })
  }
})
