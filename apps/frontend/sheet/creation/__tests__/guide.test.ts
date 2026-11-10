import {
  type CreationCheck,
  type CreationChoices,
  checkCreation,
  effectiveCreationConfig,
  type SheetModel,
} from '@tms/sheet-core'
import { modelOf } from '../../../test/fixtures'
import {
  allText,
  confirmNote,
  fitGuide,
  type GuideItem,
  guideItems,
  guidePrefix,
  LEDGER_TARGET,
  moreText,
  type NextTabInput,
  nextTab,
  nextTabAnnouncement,
  POINTS_TAB,
} from '../guide'

// P05-D (D-05, R-18): os itens do "O que falta" saem dos `problems` do
// `checkCreation`, com o texto curto da barra, a ordem e o alvo na ficha

const OWNER = new Set(['owner'] as const)
const PRIORITIES: CreationChoices = {
  priorities: {
    attributes: ['physical', 'social', 'mental'],
    abilities: ['talents', 'skills', 'knowledges'],
  },
}

const check = (
  model: SheetModel,
  values: Record<string, unknown> = {},
  choices: CreationChoices = {}
): CreationCheck =>
  checkCreation(
    model,
    { values: { name: 'Nova', ...values }, specialties: {} },
    { config: effectiveCreationConfig(model), choices }
  )

const shorts = (items: readonly GuideItem[]) => items.map(i => i.short)

describe('guideItems', () => {
  it('ficha recém-criada: a prioridade sai uma vez por orçamento', () => {
    const vtm = modelOf('vtm-v20')
    expect(shorts(guideItems(vtm, check(vtm), OWNER))).toEqual([
      'Atributos (prioridade)',
      'Habilidades (prioridade)',
      'Disciplinas 3',
      'Antecedentes 5',
      'Virtudes 7',
    ])
    const wta = modelOf('wta-w20')
    expect(guideItems(wta, check(wta), OWNER)).toHaveLength(4)
    const mta = modelOf('mta-m20')
    expect(shorts(guideItems(mta, check(mta), OWNER))).toEqual([
      'Atributos (prioridade)',
      'Habilidades (prioridade)',
      'Esferas 6',
      'Antecedentes 7',
    ])
  })

  it('a prioridade tem a frase inteira e leva ao primeiro grupo', () => {
    const vtm = modelOf('vtm-v20')
    const [first] = guideItems(vtm, check(vtm), OWNER)
    expect(first).toMatchObject({
      kind: 'missing',
      text: 'Atributos: escolha a prioridade.',
      target: {
        tab: 'build',
        section: 'attributes',
        group: 'physical',
        path: null,
      },
    })
  })

  it('com as prioridades: um item por grupo, na ordem da ficha', () => {
    const vtm = modelOf('vtm-v20')
    const items = guideItems(vtm, check(vtm, {}, PRIORITIES), OWNER)
    expect(shorts(items)).toEqual([
      'Físicos 7',
      'Sociais 5',
      'Mentais 3',
      'Talentos 13',
      'Perícias 9',
      'Conhecimentos 5',
      'Disciplinas 3',
      'Antecedentes 5',
      'Virtudes 7',
    ])
    const virtues = items.find(i => i.short === 'Virtudes 7')
    expect(virtues).toMatchObject({
      kind: 'missing',
      text: 'Virtudes: faltam 7 pontos básicos.',
      target: { tab: 'powers', section: 'advantages', group: 'virtues' },
    })
    // A chave é estável e única
    expect(new Set(items.map(i => i.key)).size).toBe(items.length)
  })

  it('o que impede salvar vem antes do que falta, e o bônus vai à aba', () => {
    const vtm = modelOf('vtm-v20')
    const base = check(vtm, {}, PRIORITIES)
    const exceeded: CreationCheck = {
      ...base,
      problems: [
        ...base.problems,
        {
          code: 'CREATION_FREEBIES_EXCEEDED',
          severity: 'blocking',
          paths: [],
          amount: 3,
        },
        {
          code: 'CREATION_HARD_CAP',
          severity: 'blocking',
          paths: ['values.disciplines#d1'],
          amount: 1,
        },
      ],
    }
    const items = guideItems(vtm, exceeded, OWNER)
    expect(items.slice(0, 2).map(i => [i.short, i.kind])).toEqual([
      ['Disciplinas', 'blocking'],
      ['Bônus: 3 acima', 'blocking'],
    ])
    expect(items[0]?.target).toMatchObject({
      section: 'advantages',
      group: 'disciplines',
      path: 'values.disciplines#d1',
    })
    expect(items[1]).toMatchObject({
      text: 'Bônus: 3 acima do saldo.',
      target: LEDGER_TARGET,
    })
  })

  it('a prioridade com pontos já postos impede salvar', () => {
    const vtm = modelOf('vtm-v20')
    const items = guideItems(vtm, check(vtm, { strength: 3 }), OWNER)
    expect(items[0]).toMatchObject({
      short: 'Atributos (prioridade)',
      kind: 'blocking',
    })
    expect(
      items.filter(i => i.short === 'Atributos (prioridade)')
    ).toHaveLength(1)
  })

  it('point-buy (sem sistema WoD): falta e acima do orçamento', () => {
    const vtm = modelOf('vtm-v20')
    const base = check(vtm, {}, PRIORITIES)
    const items = guideItems(
      vtm,
      {
        ...base,
        problems: [
          {
            code: 'CREATION_POINTBUY_EXCEEDED',
            severity: 'blocking',
            budget: 'attributes',
            group: 'physical',
            paths: [],
            amount: 2,
          },
          {
            code: 'CREATION_POINTBUY_UNSPENT',
            severity: 'incomplete',
            budget: 'attributes',
            group: 'social',
            paths: [],
            amount: 1,
          },
        ],
      },
      OWNER
    )
    expect(shorts(items)).toEqual(['Físicos: 2 acima', 'Sociais 1'])
  })

  it('seção que o papel não lê não tem alvo', () => {
    const vtm = modelOf('vtm-v20')
    const items = guideItems(vtm, check(vtm, {}, PRIORITIES), new Set())
    expect(items.length).toBeGreaterThan(0)
    for (const i of items) expect(i.target).toBeNull()
  })

  it('conta fechada, criação livre ou sem conta: nenhum item', () => {
    const vtm = modelOf('vtm-v20')
    expect(guideItems(vtm, null, OWNER)).toEqual([])
    const free = checkCreation(
      vtm,
      { values: { name: 'Nova' }, specialties: {} },
      { config: { ...effectiveCreationConfig(vtm), mode: 'free' }, choices: {} }
    )
    expect(guideItems(vtm, free, OWNER)).toEqual([])
    expect(
      guideItems(vtm, { ...free, mode: 'points', complete: true }, OWNER)
    ).toEqual([])
  })
})

const item = (short: string): GuideItem => ({
  key: short,
  kind: 'missing',
  short,
  text: `${short}.`,
  target: null,
})

describe('fitGuide', () => {
  const opening = [
    'Atributos (prioridade)',
    'Habilidades (prioridade)',
    'Disciplinas 3',
    'Antecedentes 5',
    'Virtudes 7',
  ].map(item)
  const later = ['Virtudes 7', 'Disciplinas 3', 'Antecedentes 5'].map(item)

  const line = (fit: ReturnType<typeof fitGuide>, total: number) =>
    fit.shown.length
      ? [
          guidePrefix(total),
          fit.shown.map(i => i.short).join(' · '),
          ...(fit.more ? [`· ${moreText(fit.more)}`] : []),
        ].join(' ')
      : allText(fit.more)

  it('a 360 (234 dp): os itens inteiros que cabem e o "e mais N"', () => {
    expect(line(fitGuide(later, 234, 1), 3)).toBe(
      'Faltam: Virtudes 7 · e mais 2'
    )
  })

  it('no começo, nem o primeiro cabe com o "e mais N": um botão só', () => {
    const fit = fitGuide(opening, 234, 1)
    expect(fit).toEqual({ shown: [], more: 5 })
    expect(line(fit, 5)).toBe('Faltam 5 itens')
  })

  it('mais largura, mais itens; nenhum item cortado', () => {
    for (const width of [234, 256, 267, 285, 400, 800]) {
      for (const scale of [1, 1.3]) {
        const fit = fitGuide(later, width, scale)
        expect(fit.shown.length + fit.more).toBe(later.length)
        // Os mostrados são os primeiros, inteiros e na ordem
        expect(fit.shown).toEqual(later.slice(0, fit.shown.length))
      }
    }
    expect(fitGuide(later, 285, 1).shown).toHaveLength(1)
    expect(fitGuide(later, 360, 1).shown).toHaveLength(2)
    expect(fitGuide(later, 800, 1)).toEqual({ shown: later, more: 0 })
  })

  it('com fonte a 130%, cabe menos', () => {
    expect(fitGuide(later, 234, 1.3)).toEqual({ shown: [], more: 3 })
    expect(line(fitGuide(later, 234, 1.3), 3)).toBe('Faltam 3 itens')
  })

  it('um item: "Falta:" e "Falta 1 item"', () => {
    const one = [item('Virtudes 7')]
    expect(line(fitGuide(one, 234, 1), 1)).toBe('Falta: Virtudes 7')
    expect(line(fitGuide(one, 60, 1), 1)).toBe('Falta 1 item')
  })

  it('lista vazia: nada', () => {
    expect(fitGuide([], 234, 1)).toEqual({ shown: [], more: 0 })
  })
})

describe('confirmNote', () => {
  it('a linha da confirmação de concluir', () => {
    expect(confirmNote(0)).toBeNull()
    expect(confirmNote(1)).toBe(
      '1 item para confirmar com o narrador; veja em Pontos.'
    )
    expect(confirmNote(2)).toBe(
      '2 itens para confirmar com o narrador; veja em Pontos.'
    )
  })
})

// P17 (N-03): o selo "a seguir" na aba seguinte com pendência
describe('nextTab', () => {
  const TABS = [
    { id: 'build', label: 'Ficha' },
    { id: 'powers', label: 'Vantagens' },
    { id: 'lore', label: 'Sobre' },
    { id: POINTS_TAB, label: 'Pontos' },
  ]
  const item = (
    tab: string | null,
    kind: GuideItem['kind'] = 'missing'
  ): GuideItem => ({
    key: `${kind}:${tab}`,
    kind,
    short: 'x',
    text: 'x',
    target:
      tab === null ? null : { tab, section: null, group: null, path: null },
  })
  const input = (over: Partial<NextTabInput>): NextTabInput => ({
    items: [],
    tabs: TABS,
    current: 'build',
    freebies: { remaining: 15 },
    active: true,
    ...over,
  })

  it('a aba Ficha acaba: o selo vai para Vantagens, e o anúncio usa "Ficha"', () => {
    const next = nextTab(input({ items: [item('powers'), item('lore')] }))
    expect(next).toEqual({ id: 'powers', done: 'Ficha' })
    expect(nextTabAnnouncement(next!.done, 'Vantagens')).toBe(
      'Ficha: nada falta. A seguir: Vantagens.'
    )
  })

  it('Vantagens acaba com a Ficha ainda pendente: dá a volta até a Ficha', () => {
    expect(nextTab(input({ current: 'lore', items: [item('build')] }))).toEqual(
      { id: 'build', done: 'Sobre' }
    )
    expect(
      nextTab(input({ current: 'powers', items: [item('build')] }))
    ).toEqual({ id: 'build', done: 'Vantagens' })
  })

  it('a aba à vista com pendência: nenhum selo', () => {
    expect(
      nextTab(input({ items: [item('build'), item('powers')] }))
    ).toBeNull()
    // Também com o que impede salvar
    expect(nextTab(input({ items: [item('build', 'blocking')] }))).toBeNull()
  })

  it('tudo feito: Pontos com bônus sobrando; nenhum com saldo zero ou sem bônus', () => {
    expect(nextTab(input({}))).toEqual({ id: POINTS_TAB, done: 'Ficha' })
    expect(nextTab(input({ freebies: { remaining: 0 } }))).toBeNull()
    expect(nextTab(input({ freebies: null }))).toBeNull()
    // Já em Pontos: nada a destacar
    expect(nextTab(input({ current: POINTS_TAB }))).toBeNull()
    // Sem a aba Pontos: nada
    expect(
      nextTab(input({ tabs: TABS.filter(t => t.id !== POINTS_TAB) }))
    ).toBeNull()
  })

  it('item sem alvo (seção que o papel não lê) conta para Pontos', () => {
    expect(nextTab(input({ items: [item(null)] }))).toEqual({
      id: POINTS_TAB,
      done: 'Ficha',
    })
    expect(
      nextTab(input({ current: POINTS_TAB, items: [item(null)] }))
    ).toBeNull()
  })

  it('item fora das abas ("Em jogo") e nada nas abas: nenhum selo, nem em Pontos', () => {
    expect(nextTab(input({ items: [item('play')] }))).toBeNull()
    // Com uma aba pendente, o selo vai para ela
    expect(nextTab(input({ items: [item('play'), item('lore')] }))).toEqual({
      id: 'lore',
      done: 'Ficha',
    })
  })

  it('só itens para confirmar: tratados como nada pendente', () => {
    expect(nextTab(input({ items: [item('powers', 'confirm')] }))).toEqual({
      id: POINTS_TAB,
      done: 'Ficha',
    })
    expect(
      nextTab(input({ items: [item('powers', 'confirm')], freebies: null }))
    ).toBeNull()
  })

  it('fora da criação (Leitura, criação enviada): null', () => {
    expect(
      nextTab(input({ active: false, items: [item('powers')] }))
    ).toBeNull()
    expect(nextTab(input({ active: false }))).toBeNull()
  })

  it('a aba à vista fora das abas: null', () => {
    expect(
      nextTab(input({ current: 'nenhuma', items: [item('powers')] }))
    ).toBeNull()
  })
})
