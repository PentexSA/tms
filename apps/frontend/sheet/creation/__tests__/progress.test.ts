import {
  type CreationCheck,
  type CreationChoices,
  checkCreation,
  effectiveCreationConfig,
  type SheetModel,
} from '@tms/sheet-core'
import { modelOf } from '../../../test/fixtures'
import { freebiesBalance } from '../creation'
import { guideItems } from '../guide'
import {
  type CreationProgress,
  creationProgress,
  fitProgress,
  progressSpoken,
} from '../progress'

// P09-D (D-10, R-15): o progresso do cartão da Mesa sai da mesma conta da
// barra do jogador, com as mesmas peças do guia, nos três sistemas

const OWNER = new Set(['owner'] as const)
const PRIORITIES: CreationChoices = {
  priorities: {
    attributes: ['physical', 'social', 'mental'],
    abilities: ['talents', 'skills', 'knowledges'],
  },
}
// Os Atributos do V20 fechados com as prioridades acima: 7/5/3 acima do 1
const ATTRIBUTES = {
  strength: 4,
  dexterity: 3,
  stamina: 3,
  charisma: 3,
  manipulation: 3,
  appearance: 2,
  perception: 2,
  intelligence: 2,
  wits: 2,
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

const textOf = (p: CreationProgress | null) =>
  p?.parts.map(x => x.text).join(' · ')

describe('creationProgress', () => {
  it('recém-criada, nos três sistemas: prioridade, o que falta e o bônus', () => {
    const vtm = modelOf('vtm-v20')
    expect(textOf(creationProgress(check(vtm)))).toBe(
      'Atributos (prioridade) · Habilidades (prioridade) · Disciplinas: faltam 3 · Antecedentes: faltam 5 · Virtudes: faltam 7 · Bônus: restam 15 de 15'
    )
    const mta = modelOf('mta-m20')
    expect(textOf(creationProgress(check(mta)))).toBe(
      'Atributos (prioridade) · Habilidades (prioridade) · Antecedentes: faltam 7 · Esferas: faltam 6 · Bônus: restam 15 de 15'
    )
    const wta = modelOf('wta-w20')
    const w = creationProgress(check(wta))
    expect(w?.parts.map(x => x.key)).toEqual([
      'attributes',
      'abilities',
      'backgrounds',
      'gifts',
      'freebies',
    ])
    expect(textOf(w)).toContain('Dons: faltam 3')
  })

  it('o "(prioridade)" e o bônus são os mesmos do guia e da barra', () => {
    for (const system of ['vtm-v20', 'mta-m20', 'wta-w20']) {
      const model = modelOf(system)
      const c = check(model)
      const parts = creationProgress(c)?.parts.map(p => p.text) ?? []
      for (const item of guideItems(model, c, OWNER))
        if (item.short.endsWith('(prioridade)'))
          expect(parts).toContain(item.short)
      expect(parts.at(-1)).toBe(freebiesBalance(c))
    }
  })

  it('o orçamento completo ganha o ✓; o resto soma os grupos', () => {
    const vtm = modelOf('vtm-v20')
    const p = creationProgress(check(vtm, ATTRIBUTES, PRIORITIES))
    expect(p?.closed).toBe(false)
    expect(p?.parts[0]).toEqual({
      key: 'attributes',
      kind: 'done',
      text: 'Atributos ✓',
      spoken: 'Atributos completos',
    })
    // Habilidades 13 + 9 + 5, somadas por orçamento (o formato da D-10)
    expect(p?.parts[1]).toMatchObject({
      key: 'abilities',
      kind: 'missing',
      text: 'Habilidades: faltam 27',
    })
  })

  it('a prioridade com pontos já postos impede salvar', () => {
    const vtm = modelOf('vtm-v20')
    const p = creationProgress(check(vtm, { strength: 3 }))
    expect(p?.parts[0]).toEqual({
      key: 'attributes',
      kind: 'blocking',
      text: 'Atributos (prioridade)',
      spoken: 'Atributos: falta escolher a prioridade',
    })
  })

  it('singular, point-buy acima, traços para corrigir e bônus acima do saldo', () => {
    const vtm = modelOf('vtm-v20')
    const base = check(vtm, ATTRIBUTES, PRIORITIES)
    const p = creationProgress({
      ...base,
      freebies: base.freebies && { ...base.freebies, remaining: -3 },
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
          code: 'CREATION_BASICS_UNSPENT',
          severity: 'incomplete',
          budget: 'virtues',
          group: 'virtues',
          paths: [],
          amount: 1,
        },
        {
          code: 'CREATION_HARD_CAP',
          severity: 'blocking',
          paths: ['values.disciplines#d1'],
          amount: 1,
        },
        {
          code: 'CREATION_BELOW_INITIAL',
          severity: 'incomplete',
          paths: ['values.strength'],
        },
        {
          code: 'CREATION_FREEBIES_EXCEEDED',
          severity: 'blocking',
          paths: [],
          amount: 3,
        },
      ],
    })
    expect(p?.parts.map(x => [x.text, x.kind])).toEqual([
      ['Atributos: 2 acima', 'blocking'],
      ['Habilidades ✓', 'done'],
      ['Disciplinas ✓', 'done'],
      ['Antecedentes ✓', 'done'],
      ['Virtudes: falta 1', 'missing'],
      ['2 traços para corrigir', 'blocking'],
      ['Bônus: 3 acima do saldo', 'blocking'],
    ])
  })

  it('conta fechada: "A conta fechou", e o bônus só se sobrou', () => {
    const vtm = modelOf('vtm-v20')
    const base = check(vtm, ATTRIBUTES, PRIORITIES)
    const closed = (remaining: number): CreationCheck => ({
      ...base,
      complete: true,
      savable: true,
      problems: [],
      freebies: base.freebies && { ...base.freebies, remaining },
    })
    expect(creationProgress(closed(0))).toEqual({
      closed: true,
      parts: [
        {
          key: 'closed',
          kind: 'closed',
          text: 'A conta fechou',
          spoken: 'A conta fechou',
        },
      ],
    })
    expect(textOf(creationProgress(closed(2)))).toBe(
      'A conta fechou · Bônus: restam 2 de 15'
    )
  })

  it('criação livre ou sem conta: null', () => {
    const vtm = modelOf('vtm-v20')
    expect(creationProgress(null)).toBeNull()
    const free = checkCreation(
      vtm,
      { values: { name: 'Nova' }, specialties: {} },
      { config: { ...effectiveCreationConfig(vtm), mode: 'free' }, choices: {} }
    )
    expect(creationProgress(free)).toBeNull()
  })

  it('o nome acessível tem tudo, com as palavras', () => {
    const vtm = modelOf('vtm-v20')
    const c = check(vtm, ATTRIBUTES, PRIORITIES)
    const p = creationProgress(c)
    if (!p) throw new Error('sem progresso')
    expect(progressSpoken(p)).toBe(
      `Atributos completos, Habilidades: faltam 27, Disciplinas: faltam 3, Antecedentes: faltam 5, Virtudes: faltam 7, ${freebiesBalance(c)}`
    )
  })
})

describe('fitProgress', () => {
  const vtm = modelOf('vtm-v20')
  // "A meio caminho": só as Habilidades e o bônus faltando
  const half = (): CreationProgress => {
    const p = creationProgress(check(vtm, ATTRIBUTES, PRIORITIES))
    if (!p) throw new Error('sem progresso')
    return {
      closed: false,
      parts: p.parts.map(part =>
        part.key === 'abilities' ||
        part.key === 'freebies' ||
        part.kind === 'done'
          ? part
          : { ...part, kind: 'done', text: `${part.key} ✓` }
      ),
    }
  }

  it('cabe inteiro na largura da grade', () => {
    const p = half()
    const fit = fitProgress(p, 1280, 1)
    expect(fit.shown).toEqual(p.parts)
  })

  it('a 358 e 328: os ✓ viram um só, no começo, e o bônus fica no fim', () => {
    const fresh = creationProgress(check(vtm, ATTRIBUTES, PRIORITIES))
    if (!fresh) throw new Error('sem progresso')
    for (const width of [358, 328]) {
      const fit = fitProgress(fresh, width, 1)
      expect(fit.text.startsWith('✓ 1 de 5 · Habilidades: faltam 27')).toBe(
        true
      )
      expect(fit.shown.at(-1)?.key).toBe('freebies')
      expect(fit.shown[0]?.spoken).toBe('1 de 5 orçamentos completos')
    }
  })

  it('com fonte grande: "e mais N", sem cortar nenhuma parte', () => {
    const fresh = creationProgress(check(vtm))
    if (!fresh) throw new Error('sem progresso')
    for (const [width, scale] of [
      [358, 1.3],
      [328, 1.3],
      [389, 1],
    ] as const) {
      const fit = fitProgress(fresh, width, scale)
      // Nenhuma parte cortada: cada texto mostrado é uma parte inteira
      for (const part of fit.shown)
        expect(
          [...fresh.parts.map(x => x.text), part.text].includes(part.text)
        ).toBe(true)
      expect(fit.shown.at(-1)?.key).toBe('freebies')
      expect(fit.text).toBe(fit.shown.map(x => x.text).join(' · '))
    }
    const tight = fitProgress(fresh, 328, 1.3)
    expect(tight.shown.some(x => x.key === 'more')).toBe(true)
    expect(tight.text).toMatch(/e mais \d+ · Bônus: restam 15 de 15$/)
  })

  it('uma linha só: cabe menos', () => {
    const fresh = creationProgress(check(vtm))
    if (!fresh) throw new Error('sem progresso')
    const two = fitProgress(fresh, 358, 1)
    const one = fitProgress(fresh, 358, 1, 1)
    expect(one.text.length).toBeLessThan(two.text.length)
  })

  // /code-review (P09-D): o bônus acima do saldo é `blocking`, mas continua
  // o bônus: no fim, fora do "✓ k de n" e fora do "e mais N"
  it('o bônus acima do saldo fica no fim e não conta como orçamento', () => {
    const base = check(vtm, ATTRIBUTES, PRIORITIES)
    const over = creationProgress({
      ...base,
      freebies: base.freebies && { ...base.freebies, remaining: -4 },
    })
    if (!over) throw new Error('sem progresso')
    for (const [width, scale] of [
      [358, 1],
      [328, 1.3],
      [200, 1],
    ] as const) {
      const fit = fitProgress(over, width, scale)
      expect(fit.shown.at(-1)?.text).toBe('Bônus: 4 acima do saldo')
      expect(fit.text).not.toMatch(/de 6/)
    }
  })

  it('a conta fechada nunca perde o "A conta fechou", nem bem estreita', () => {
    const base = check(vtm, ATTRIBUTES, PRIORITIES)
    const closed = creationProgress({
      ...base,
      complete: true,
      savable: true,
      problems: [],
      freebies: base.freebies && { ...base.freebies, remaining: 2 },
    })
    if (!closed) throw new Error('sem progresso')
    const fit = fitProgress(closed, 120, 2)
    expect(fit.shown[0]?.text).toBe('A conta fechou')
  })
})

describe('traços para corrigir', () => {
  it('dois problemas no mesmo campo são um traço só', () => {
    const vtm = modelOf('vtm-v20')
    const base = check(vtm, ATTRIBUTES, PRIORITIES)
    const p = creationProgress({
      ...base,
      problems: [
        {
          code: 'CREATION_HARD_CAP',
          severity: 'blocking',
          paths: ['values.disciplines#d1'],
        },
        {
          code: 'CREATION_LOCKED',
          severity: 'blocking',
          paths: ['values.disciplines#d1'],
        },
      ],
    })
    expect(p?.parts.find(x => x.key === 'fields')?.text).toBe(
      '1 traço para corrigir'
    )
  })
})
