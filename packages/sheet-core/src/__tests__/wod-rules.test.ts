/// <reference types="bun-types" />
import { describe, expect, it } from 'bun:test'
import { compileTemplate, type SheetModel } from '../compile'
import { costOf } from '../costs'
import {
  type CreationChoices,
  checkCreation,
  effectiveCreationConfig,
} from '../creation'
import { creationAdvice } from '../recommend'
import { resolve } from '../resolve'
import { templates } from './fixtures'

// Oráculos das regras de V20, M20 e W20 nos templates publicados
// (doc/regras-wod.md): uma ficha que fecha a criação exata, o gasto dos 15
// pontos de bônus e o preço de XP de cada tipo de traço.

type Values = Record<string, unknown>

const PRIORITIES: CreationChoices = {
  priorities: {
    attributes: ['physical', 'social', 'mental'],
    abilities: ['talents', 'skills', 'knowledges'],
  },
}

// 7/5/3 acima do 1 inicial
const ATTRIBUTES: Values = {
  strength: 4,
  dexterity: 3,
  stamina: 3,
  charisma: 3,
  manipulation: 2,
  appearance: 3,
  perception: 2,
  intelligence: 2,
  wits: 2,
}

const creation = (model: SheetModel, values: Values) =>
  checkCreation(
    model,
    { values },
    { config: effectiveCreationConfig(model), choices: PRIORITIES }
  )

const price = (
  model: SheetModel,
  values: Values,
  target: { field: string; item?: string; name?: string }
) => {
  const r = costOf(model, { values }, target)
  return r.ok ? r.cost : r.code
}

describe('V20', () => {
  const vtm = compileTemplate(templates['vtm-v20'])
  // 13/9/5 em Habilidades (máx. 3), 3 em Disciplinas, 5 em Antecedentes e 7
  // nas Virtudes acima do 1 inicial
  const BRUJAH: Values = {
    ...ATTRIBUTES,
    name: 'Teste',
    clan: 'brujah',
    alertness: 3,
    athletics: 3,
    brawl: 3,
    intimidation: 2,
    streetwise: 2,
    drive: 3,
    firearms: 3,
    melee: 3,
    academics: 2,
    computer: 2,
    investigation: 1,
    disciplines: [
      { id: 'd1', name: 'Potência', value: 2 },
      { id: 'd2', name: 'Rapidez', value: 1 },
    ],
    backgrounds: [
      { id: 'b1', name: 'Recursos', value: 3 },
      { id: 'b2', name: 'Contatos', value: 2 },
    ],
    conscience: 3,
    selfControl: 3,
    courage: 4,
  }

  it('a criação fecha exata com os básicos e sobram 15 de bônus', () => {
    const r = creation(vtm, BRUJAH)
    expect(r.problems).toEqual([])
    expect(r.freebies).toEqual({
      available: 15,
      credit: 0,
      spent: 0,
      remaining: 15,
    })
  })

  it('bônus: Humanidade 2, Força de Vontade 1, Disciplina 7, Habilidade 2', () => {
    const r = creation(vtm, {
      ...BRUJAH,
      humanity: 7,
      willpower: { permanent: 6 },
      disciplines: [
        { id: 'd1', name: 'Potência', value: 3 },
        { id: 'd2', name: 'Rapidez', value: 1 },
      ],
      subterfuge: 2,
    })
    expect(r.problems).toEqual([])
    expect(r.freebies?.spent).toBe(2 + 2 + 7 + 4)
  })

  // P07-D: a tela avisa "fora do clã" e mostra o custo da Qualidade, mas a
  // conta da criação continua a mesma (o servidor repete esta função).
  it('Disciplina fora do clã fecha a criação como uma do clã', () => {
    const outside = creation(vtm, {
      ...BRUJAH,
      disciplines: [
        { id: 'd1', name: 'Dominação', value: 2 },
        { id: 'd2', name: 'Auspícios', value: 1 },
      ],
    })
    expect(outside).toEqual(creation(vtm, BRUJAH))
  })

  it('Qualidade: o Custo sai dos bônus, item a item', () => {
    const r = creation(vtm, {
      ...BRUJAH,
      merits: [
        { id: 'm1', name: 'Um', meta: { kind: 'Físico', cost: 2 } },
        { id: 'm2', name: 'Dois', meta: { kind: 'Social', cost: 3 } },
      ],
    })
    expect(r.problems).toEqual([])
    expect(r.freebies?.spent).toBe(5)
  })

  // P07-D (R-26): o "do clã" da tela é o mesmo mapa do desconto de XP
  it('o recommend das Disciplinas é igual, clã a clã, ao itemIn do XP', () => {
    const def = vtm.fields.get('disciplines')?.def
    const by = def?.type === 'list' ? def.recommend?.by : undefined
    const xp = vtm.template.costs?.xp?.rules?.find(r => r.id === 'discipline')
    const fromXp = Object.fromEntries(
      (xp?.when ?? []).flatMap(w =>
        w.if.itemIn && w.if.in?.[0] ? [[w.if.in[0], [...w.if.itemIn]]] : []
      )
    )
    expect(by).toHaveLength(1)
    expect(by?.[0]?.from).toBe('clan')
    expect(by?.[0]?.map).toEqual(fromXp)
    // 13 clãs; o Caitiff fica sem recomendação
    expect(Object.keys(fromXp)).toHaveLength(13)
    expect(Object.hasOwn(by?.[0]?.map ?? {}, 'caitiff')).toBe(false)
  })

  it('Habilidade acima de 3 só com bônus', () => {
    const r = creation(vtm, { ...BRUJAH, alertness: 4 })
    expect(r.problems).toEqual([])
    expect(r.freebies?.spent).toBe(2)
  })

  it('Nosferatu: Aparência começa em 0 e não sobe', () => {
    const nosferatu = {
      ...BRUJAH,
      clan: 'nosferatu',
      appearance: 0,
      charisma: 4,
      manipulation: 3,
    }
    expect(creation(vtm, nosferatu).problems).toEqual([])
    expect(
      creation(vtm, { ...nosferatu, appearance: 1 }).problems.map(p => p.code)
    ).toContain('CREATION_LOCKED')
    expect(price(vtm, nosferatu, { field: 'appearance' })).toBe(
      'XP_COST_UNAVAILABLE'
    )
  })

  it('XP: Atributo ×4, Habilidade ×2 (nova 3), Virtude e Humanidade ×2, FdV ×1', () => {
    expect(price(vtm, BRUJAH, { field: 'dexterity' })).toBe(12)
    expect(price(vtm, BRUJAH, { field: 'athletics' })).toBe(6)
    expect(price(vtm, BRUJAH, { field: 'occult' })).toBe(3)
    expect(price(vtm, BRUJAH, { field: 'conscience' })).toBe(6)
    expect(price(vtm, BRUJAH, { field: 'humanity' })).toBe(12)
    expect(price(vtm, BRUJAH, { field: 'willpower' })).toBe(4)
  })

  it('XP de Disciplina: do clã ×5, de fora ×7, Caitiff ×6, nova 10', () => {
    expect(price(vtm, BRUJAH, { field: 'disciplines', item: 'd1' })).toBe(10)
    const other = {
      ...BRUJAH,
      disciplines: [{ id: 'd3', name: 'Dominação', value: 2 }],
    }
    expect(price(vtm, other, { field: 'disciplines', item: 'd3' })).toBe(14)
    expect(
      price(
        vtm,
        { ...BRUJAH, clan: 'caitiff' },
        { field: 'disciplines', item: 'd1' }
      )
    ).toBe(12)
    expect(
      price(vtm, BRUJAH, { field: 'disciplines', name: 'Dominação' })
    ).toBe(10)
  })

  it('Antecedente não tem preço em XP: o narrador decide', () => {
    expect(price(vtm, BRUJAH, { field: 'backgrounds', item: 'b1' })).toBe(
      'XP_COST_UNAVAILABLE'
    )
  })
})

describe('M20', () => {
  const mta = compileTemplate(templates['mta-m20'])

  it('a Esfera de afinidade recomenda por Tradição; o Órfão fica sem', () => {
    const def = mta.fields.get('affinity')?.def
    const source = def?.type === 'choice' ? def.recommend?.by[0] : undefined
    expect(source?.from).toBe('tradition')
    const tradition = mta.fields.get('tradition')?.def
    const ids =
      tradition?.type === 'choice' ? tradition.options.map(o => o.id) : []
    expect(Object.keys(source?.map ?? {}).sort()).toEqual(
      ids.filter(id => id !== 'orfao').sort()
    )
  })
  // 7 em Antecedentes e 6 em Esferas, nenhuma acima do Arete 1
  const HERMETIC: Values = {
    ...ATTRIBUTES,
    name: 'Teste',
    affinity: 'forces',
    alertness: 3,
    awareness: 3,
    brawl: 3,
    empathy: 2,
    expression: 2,
    drive: 3,
    research: 3,
    technology: 3,
    academics: 2,
    occult: 2,
    cosmology: 1,
    backgrounds: [
      { id: 'b1', name: 'Avatar', value: 3 },
      { id: 'b2', name: 'Recursos', value: 4 },
    ],
    forces: 1,
    prime: 1,
    matter: 1,
    life: 1,
    mind: 1,
    spirit: 1,
  }

  it('a criação fecha exata com os básicos e sobram 15 de bônus', () => {
    const r = creation(mta, HERMETIC)
    expect(r.problems).toEqual([])
    expect(r.freebies?.remaining).toBe(15)
  })

  it('bônus: Arete 4, Esfera 7, Força de Vontade 1', () => {
    const r = creation(mta, {
      ...HERMETIC,
      arete: 2,
      forces: 2,
      willpower: { permanent: 6 },
    })
    expect(r.problems).toEqual([])
    expect(r.freebies?.spent).toBe(4 + 7 + 1)
  })

  it('Arete no máximo 3 e Esfera no máximo o Arete', () => {
    expect(
      creation(mta, { ...HERMETIC, arete: 4 }).problems.map(p => p.code)
    ).toContain('CREATION_HARD_CAP')
    expect(
      creation(mta, { ...HERMETIC, forces: 2, prime: 0 }).problems.map(
        p => p.code
      )
    ).toContain('CREATION_HARD_CAP')
  })

  // U-05: a roda segue o Avatar sem nada gravado nela, com outros recursos
  // já gravados (o rascunho da criação resolve a ficha inteira).
  it('a Quintessência acompanha o Avatar enquanto a roda não é gravada', () => {
    const at = (avatar: number) =>
      resolve(mta, {
        values: {
          ...HERMETIC,
          willpower: { permanent: 6, current: 6 },
          backgrounds: [
            { id: 'b1', name: 'Avatar', value: avatar },
            { id: 'b2', name: 'Recursos', value: 4 },
          ],
        },
      }).get('wheel')
    const paradox = { id: 'paradox', n: 0 }
    expect(at(3)).toMatchObject({
      fills: [{ id: 'quintessence', n: 3 }, paradox],
    })
    expect(at(5)).toMatchObject({
      fills: [{ id: 'quintessence', n: 5 }, paradox],
    })
  })

  it('XP: Esfera de afinidade ×7, outra ×8, nova 10, Arete ×8, Antecedente ×3', () => {
    const v = { ...HERMETIC, arete: 3, forces: 2, matter: 2 }
    expect(price(mta, v, { field: 'forces' })).toBe(14)
    expect(price(mta, v, { field: 'matter' })).toBe(16)
    expect(price(mta, v, { field: 'time' })).toBe(10)
    expect(price(mta, v, { field: 'arete' })).toBe(24)
    expect(price(mta, v, { field: 'backgrounds', item: 'b2' })).toBe(12)
    expect(price(mta, v, { field: 'backgrounds', name: 'Biblioteca' })).toBe(3)
  })
})

describe('W20', () => {
  const wta = compileTemplate(templates['wta-w20'])
  // 5 em Antecedentes e 3 Dons de nível 1
  const AHROUN: Values = {
    ...ATTRIBUTES,
    name: 'Teste',
    breed: 'hominideo',
    auspice: 'ahroun',
    tribe: 'fianna',
    alertness: 3,
    athletics: 3,
    brawl: 3,
    empathy: 2,
    primalUrge: 2,
    drive: 3,
    melee: 3,
    survival: 3,
    enigmas: 2,
    occult: 2,
    rituals: 1,
    backgrounds: [
      { id: 'b1', name: 'Raça Pura', value: 3 },
      { id: 'b2', name: 'Fetiche', value: 2 },
    ],
    gifts: [
      { id: 'g1', name: 'Cheiro do Homem' },
      { id: 'g2', name: 'Inspiração' },
      { id: 'g3', name: 'Persuasão' },
    ],
  }

  it('a criação fecha exata com os básicos e sobram 15 de bônus', () => {
    const r = creation(wta, AHROUN)
    expect(r.problems).toEqual([])
    expect(r.freebies?.remaining).toBe(15)
  })

  // P07-D (D-07, A2 do roteiro): o template avisa o Dom acima do Posto 1.
  // O Dom é da Raça (Hominídeo), para o "fora" não entrar no aviso.
  it('Dom de Posto 2 dá ADVICE_ABOVE_LEVEL; o de Posto 1, não; a conta não muda', () => {
    const at = (rank: number) => ({
      ...AHROUN,
      gifts: [
        { id: 'g1', name: 'Mestre do Fogo', meta: { rank } },
        ...(AHROUN.gifts as Values[]).slice(1),
      ],
    })
    const sheet = (rank: number) => resolve(wta, { values: at(rank) })
    expect(creationAdvice(wta, sheet(2))).toEqual([
      {
        code: 'ADVICE_ABOVE_LEVEL',
        field: 'gifts',
        paths: ['values.gifts#g1'],
        amount: 1,
        rule: 0,
      },
    ])
    expect(creationAdvice(wta, sheet(1))).toEqual([])
    // Só avisa: a conta fecha igual com o Posto 2
    expect(creation(wta, at(2))).toEqual(creation(wta, at(1)))
  })

  it('bônus: Dom 7, Gnose 2, Fúria 1; o Posto não entra na conta', () => {
    const r = creation(wta, {
      ...AHROUN,
      rank: 1,
      gifts: [
        ...(AHROUN.gifts as Values[]),
        { id: 'g4', name: 'Pele de Ferro' },
      ],
      gnosis: { permanent: 3 },
      rage: { permanent: 6 },
    })
    expect(r.problems).toEqual([])
    expect(r.freebies?.spent).toBe(7 + 4 + 1)
  })

  // T-85: a regra do servidor que o "−" do app passa a prever. Abaixo do
  // valor do Augúrio, salvar passa e concluir não; o limite não muda.
  it('Fúria abaixo do Augúrio: incompleta, salva e não conclui', () => {
    const r = creation(wta, { ...AHROUN, rage: { permanent: 4, current: 4 } })
    const below = r.problems.filter(p => p.code === 'CREATION_BELOW_INITIAL')
    expect(below).toEqual([
      expect.objectContaining({
        severity: 'incomplete',
        paths: ['values.rage'],
        amount: 1,
      }),
    ])
    expect(r.savable).toBe(true)
    expect(r.complete).toBe(false)
  })

  it('Renome não se compra na criação', () => {
    expect(
      creation(wta, { ...AHROUN, glory: { permanent: 3 } }).problems.map(
        p => p.code
      )
    ).toContain('CREATION_NOT_PURCHASABLE')
  })

  it('XP: Fúria ×1, Gnose ×2, FdV ×1; Dom depende do nível e fica com o narrador', () => {
    expect(price(wta, AHROUN, { field: 'rage' })).toBe(5)
    expect(price(wta, AHROUN, { field: 'gnosis' })).toBe(2)
    expect(price(wta, AHROUN, { field: 'willpower' })).toBe(3)
    expect(price(wta, AHROUN, { field: 'gifts', name: 'Novo' })).toBe(
      'XP_COST_UNAVAILABLE'
    )
  })
})
