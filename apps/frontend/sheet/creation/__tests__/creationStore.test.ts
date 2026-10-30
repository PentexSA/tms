import {
  compileTemplate,
  effectiveCreationConfig,
  type SheetData,
} from '@tms/sheet-core'
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
            'Escolha as prioridades deste grupo antes de distribuir os pontos.',
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
            'Físicos: os 5 pontos básicos já foram usados. Para passar disso, use os pontos de bônus.',
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
      issues: [{ path: 'values.str', message: 'Bônus: 5 acima do saldo.' }],
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
