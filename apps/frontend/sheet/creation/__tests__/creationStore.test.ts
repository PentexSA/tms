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
