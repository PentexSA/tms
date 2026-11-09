import {
  compileTemplate,
  effectiveCreationConfig,
  type SheetData,
} from '@tms/sheet-core'
import { modelOf } from '../../../test/fixtures'
import { createSheetStore } from '../../store/sheetStore'

const template = require('../../../../../design/templates/testes/acct-teste.json')
const model = compileTemplate(template)
const ID = '00000000-0000-4000-8000-00000000c101'
const sheet: SheetData = { values: {}, specialties: {} }

describe('conta da criação no store', () => {
  it('mostra a conta no rascunho, mas não enfileira excesso parcial', () => {
    const enqueue = jest.fn()
    const store = createSheetStore({
      characterId: ID,
      model,
      sheet,
      sheetVersion: 0,
      roles: ['owner'],
      sync: { enqueue },
      creation: {
        config: effectiveCreationConfig(model),
        choices: {},
      },
    })
    const state = store.getState()
    state.startDraft()
    expect(state.setDraftValue('values.str', 5)).toMatchObject({ ok: true })
    expect(store.getState().check).not.toBeNull()

    const result = store.getState().saveDraft('Força 5')
    expect(result).toMatchObject({ ok: false, kind: 'creation' })
    expect(store.getState().creationRefusal?.code).toBe(
      'CREATION_PRIORITIES_REQUIRED'
    )
    expect(store.getState().pending).toEqual([])
    expect(enqueue).not.toHaveBeenCalled()
    // A intenção local permanece para a pessoa corrigir prioridades/valores.
    expect(store.getState().draft?.size).toBe(1)
  })

  it('trocar a configuração recalcula e limpar a criação remove a conta', () => {
    const store = createSheetStore({
      characterId: ID,
      model,
      sheet,
      sheetVersion: 0,
      roles: ['owner'],
      creation: {
        config: effectiveCreationConfig(model),
        choices: {},
      },
    })
    expect(store.getState().check).not.toBeNull()
    store.getState().setCreation(null)
    expect(store.getState().check).toBeNull()
    expect(store.getState().creationRefusal).toBeNull()
  })
})

describe('trava da criação a cada toque', () => {
  const creating = (priorities = true) => {
    const store = createSheetStore({
      characterId: ID,
      model,
      sheet,
      sheetVersion: 0,
      roles: ['owner'],
      mode: 'create',
      creation: {
        config: effectiveCreationConfig(model),
        choices: priorities
          ? {
              priorities: {
                attributes: ['phys', 'soc', 'men'],
                abilities: ['talents', 'knowledges'],
              },
            }
          : {},
      },
    })
    store.getState().startDraft()
    return store
  }
  const set = (store: ReturnType<typeof creating>, id: string, n: number) =>
    store.getState().setDraftValue(`values.${id}`, n)

  it('sem prioridade, o primeiro ponto já pede a escolha', () => {
    const store = creating(false)
    expect(set(store, 'str', 2)).toMatchObject({
      ok: false,
      kind: 'creation',
      issues: [
        {
          path: 'values.str',
          message:
            'Físicos: escolha a prioridade antes de distribuir os pontos.',
        },
      ],
    })
    expect(store.getState().draft?.size).toBe(0)
  })

  it('em Básicos, o grupo cheio trava o próximo ponto', () => {
    const store = creating()
    expect(store.getState().creationPhase).toBe('basics')
    // Físicos é a primária (5): 2 + 2 + 1 acima do mínimo
    expect(set(store, 'str', 3)).toMatchObject({ ok: true })
    expect(set(store, 'dex', 3)).toMatchObject({ ok: true })
    expect(set(store, 'sta', 2)).toMatchObject({ ok: true })
    expect(set(store, 'dex', 4)).toMatchObject({
      ok: false,
      kind: 'creation',
      issues: [
        {
          path: 'values.dex',
          message:
            'Físicos: os 5 pontos básicos já foram usados. Para passar disso, use os pontos de bônus (5 por ponto).',
        },
      ],
    })
    // Tirar de um e pôr em outro continua valendo
    expect(set(store, 'str', 2)).toMatchObject({ ok: true })
    expect(set(store, 'dex', 4)).toMatchObject({ ok: true })
  })

  it('em Bônus, passa do grupo até o saldo acabar', () => {
    const store = creating()
    set(store, 'str', 3)
    set(store, 'dex', 3)
    set(store, 'sta', 2)
    store.getState().setCreationPhase('freebies')
    // 10 de bônus, 5 por ponto de atributo
    expect(set(store, 'dex', 4)).toMatchObject({ ok: true })
    expect(set(store, 'sta', 3)).toMatchObject({ ok: true })
    expect(store.getState().check?.freebies?.remaining).toBe(0)
    expect(set(store, 'str', 4)).toMatchObject({
      ok: false,
      issues: [
        {
          path: 'values.str',
          message: 'Faltariam 5 de bônus: custa 5, restam 0.',
        },
      ],
    })
  })

  it('fora do modo Criação, o rascunho não trava', () => {
    const store = creating()
    store.getState().setMode('evolve')
    store.getState().startDraft()
    set(store, 'str', 3)
    set(store, 'dex', 3)
    set(store, 'sta', 2)
    expect(set(store, 'dex', 4)).toMatchObject({ ok: true })
  })
})

// T-20, T-55: o aviso do toque recusado mora no store, um por ficha, e some
// quando a causa some, sem esperar o próximo toque da mesma linha.
describe('aviso da recusa no store', () => {
  const PRIORITIES = {
    priorities: {
      attributes: ['phys', 'soc', 'men'],
      abilities: ['talents', 'knowledges'],
    },
  }
  const creating = (
    choices: Record<string, unknown> = PRIORITIES,
    values: Record<string, unknown> = {}
  ) => {
    const store = createSheetStore({
      characterId: ID,
      model,
      sheet: { values, specialties: {} } as SheetData,
      sheetVersion: 0,
      roles: ['owner'],
      mode: 'create',
      sync: { enqueue: jest.fn() },
      creation: { config: effectiveCreationConfig(model), choices },
    })
    store.getState().startDraft()
    return store
  }
  const set = (store: ReturnType<typeof creating>, id: string, n: unknown) =>
    store.getState().setDraftValue(`values.${id}`, n)

  it('a recusa vira o aviso, e o próximo aviso substitui o anterior', () => {
    const store = creating({})
    set(store, 'str', 2)
    const first = store.getState().notice
    expect(first).toMatchObject({
      paths: ['values.str'],
      cause: 'priorities',
      text: 'Físicos: escolha a prioridade antes de distribuir os pontos.',
    })
    set(store, 'per', 2)
    const second = store.getState().notice
    expect(second).toMatchObject({
      paths: ['values.per'],
      text: 'Mentais: escolha a prioridade antes de distribuir os pontos.',
    })
    expect(second?.id).toBeGreaterThan(first?.id ?? 0)
  })

  it('a prioridade escolhida apaga o aviso de "escolha a prioridade"', () => {
    const store = creating({})
    set(store, 'str', 2)
    expect(store.getState().notice?.cause).toBe('priorities')
    store.getState().setCreation({
      config: effectiveCreationConfig(model),
      choices: PRIORITIES,
    })
    expect(store.getState().notice).toBeNull()
    // O ponto não entra sozinho: só o aviso sai
    expect(store.getState().draft?.size).toBe(0)
  })

  it('trocar para Bônus apaga o aviso dos Básicos', () => {
    const store = creating()
    set(store, 'str', 3)
    set(store, 'dex', 3)
    set(store, 'sta', 2)
    set(store, 'dex', 4)
    expect(store.getState().notice?.cause).toBe('budget')
    store.getState().setCreationPhase('freebies')
    expect(store.getState().notice).toBeNull()
  })

  it('o limite que sobe pelo servidor apaga o aviso do teto', () => {
    const store = creating()
    set(store, 'sphereA', 1)
    set(store, 'sphereA', 2)
    expect(store.getState().notice).toMatchObject({
      cause: 'ceiling',
      text: 'Esfera A: na criação, vai até 1.',
    })
    // Outra pessoa sobe o Arete: a Esfera 2 passaria agora
    store.getState().received({ values: { arete: 2 }, specialties: {} }, 1)
    expect(store.getState().notice).toBeNull()
  })

  it('com a causa mudando para outro motivo, o texto acompanha', () => {
    const store = creating(PRIORITIES, { str: 3, dex: 3, sta: 2 })
    set(store, 'str', 4)
    const before = store.getState().notice
    expect(before?.cause).toBe('budget')
    // Físicos passa a secundária (3): já gasta 10 de bônus, e o ponto a
    // mais custaria 5 que não há
    store.getState().setCreation({
      config: effectiveCreationConfig(model),
      choices: {
        priorities: {
          attributes: ['soc', 'phys', 'men'],
          abilities: ['talents', 'knowledges'],
        },
      },
    })
    const after = store.getState().notice
    expect(after).toMatchObject({
      paths: ['values.str'],
      cause: 'freebies',
      text: 'Faltariam 5 de bônus: custa 5, restam 0.',
    })
    expect(after?.id).toBeGreaterThan(before?.id ?? 0)
  })

  it('qualquer toque aceito apaga o aviso e a faixa do "Salvar" recusado', () => {
    const store = creating({})
    set(store, 'name', 'Isadora')
    set(store, 'str', 2)
    expect(store.getState().notice).not.toBeNull()
    store.getState().saveDraft('Força')
    expect(store.getState().creationRefusal).toBeNull()
    set(store, 'name', 'Isadora Vex')
    expect(store.getState().notice).toBeNull()

    const refused = creating({})
    refused.getState().setMode('evolve')
    refused.getState().startDraft()
    set(refused, 'str', 2)
    refused.getState().setMode('create')
    refused.getState().saveDraft('Força')
    expect(refused.getState().creationRefusal?.code).toBe(
      'CREATION_PRIORITIES_REQUIRED'
    )
    refused.getState().startDraft()
    set(refused, 'name', 'Outra')
    expect(refused.getState().creationRefusal).toBeNull()
  })

  it('sair do modo, descartar ou limpar some com o aviso', () => {
    const store = creating({})
    set(store, 'str', 2)
    store.getState().clearNotice()
    expect(store.getState().notice).toBeNull()
    store.getState().clearNotice()
    set(store, 'str', 2)
    store.getState().discardDraft()
    expect(store.getState().notice).toBeNull()
    store.getState().startDraft()
    set(store, 'str', 2)
    store.getState().setMode('play')
    expect(store.getState().notice).toBeNull()
    store.getState().setMode('create')
    store.getState().startDraft()
    set(store, 'str', 2)
    store.getState().setCreation(null)
    expect(store.getState().notice).toBeNull()
  })

  it('valor recusado pelo core e rascunho grande demais também viram aviso', () => {
    const store = creating()
    expect(set(store, 'str', 9)).toMatchObject({ ok: false })
    expect(store.getState().notice?.cause).toBe('invalid')
  })
})

// T-85: no W20, a Fúria do Ahroun não desce abaixo de 5 na criação (só no
// app); o aviso diz o Augúrio, e o rascunho fica vazio
describe('o "−" no valor inicial (T-85)', () => {
  const w20 = modelOf('wta-w20')
  const creating = (phase: 'basics' | 'freebies') => {
    const store = createSheetStore({
      characterId: ID,
      model: w20,
      sheet: {
        values: {
          name: 'L',
          breed: 'lupino',
          auspice: 'ahroun',
          tribe: 'fianna',
        },
        specialties: {},
      },
      sheetVersion: 0,
      roles: ['owner'],
      mode: 'create',
      sync: { enqueue: jest.fn() },
      creation: {
        config: effectiveCreationConfig(w20),
        choices: {
          priorities: {
            attributes: ['physical', 'social', 'mental'],
            abilities: ['talents', 'skills', 'knowledges'],
          },
        },
      },
    })
    store.getState().setCreationPhase(phase)
    store.getState().startDraft()
    return store
  }

  it.each(['basics', 'freebies'] as const)(
    'em %s: o toque é recusado, com o aviso, e nada entra no rascunho',
    phase => {
      const store = creating(phase)
      const r = store
        .getState()
        .setDraftValue('values.rage', { permanent: 4, current: 4 })
      expect(r).toMatchObject({ ok: false, kind: 'creation' })
      expect(store.getState().notice).toMatchObject({
        paths: ['values.rage'],
        cause: 'initial',
        text: 'Fúria: na criação, não fica abaixo de 5 (vem de Augúrio: Ahroun).',
      })
      expect(store.getState().draftEvents()).toEqual([])
    }
  )

  it('acima do inicial, o "−" desfaz a compra e zera o contador', () => {
    const store = creating('freebies')
    const s = () => store.getState()
    expect(
      s().setDraftValue('values.rage', { permanent: 6, current: 6 })
    ).toMatchObject({ ok: true })
    expect(
      s().setDraftValue('values.rage', { permanent: 5, current: 5 })
    ).toMatchObject({ ok: true })
    expect(s().draftEvents()).toEqual([])
    expect(s().notice).toBeNull()
  })
})
