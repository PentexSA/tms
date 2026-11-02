import { compileTemplate, effectiveCreationConfig } from '@tms/sheet-core'
import { modelOf, sheetFor } from '../../../test/fixtures'
import { REFUSAL_TEXT } from '../../creation/creation'
import { planDraftRestore } from '../../store/draftRestore'
import { createSheetStore } from '../../store/sheetStore'
import { CONFLICT_TEXT, saveDraftNow } from '../saveDraft'

// P03-D (D-01): um caminho só para salvar o rascunho, usado pelo "Salvar" do
// resumo da barra e pelo "Salvar e sair" da guarda de saída.

const model = modelOf('vtm-v20')
const ID = '00000000-0000-4000-8000-00000000d301'

function setup() {
  const enqueue = jest.fn()
  const store = createSheetStore({
    characterId: ID,
    model,
    sheet: sheetFor('helena', ['owner']).sheet,
    sheetVersion: 3,
    roles: ['owner'],
    sync: { enqueue },
    uuid: () => '00000000-0000-4000-8000-000000000301',
  })
  return { store, enqueue }
}

describe('saveDraftNow', () => {
  it('um lote com o rótulo do resumo', () => {
    const { store, enqueue } = setup()
    const from = Number(store.getState().values.values.strength)
    store.getState().startDraft()
    store.getState().setDraftValue('values.strength', from + 1)
    const out = saveDraftNow(store)
    expect(out).toEqual({
      ok: true,
      label: `Força ${from} → ${from + 1}`,
      batchId: '00000000-0000-4000-8000-000000000301',
    })
    expect(store.getState().draft).toBeNull()
    expect(store.getState().pending).toHaveLength(1)
    expect(store.getState().pending[0]?.label).toBe(out.ok ? out.label : '')
    expect(enqueue).toHaveBeenCalledTimes(1)
  })

  it('rascunho vazio: ok, sem lote', () => {
    const { store, enqueue } = setup()
    store.getState().startDraft()
    expect(saveDraftNow(store)).toMatchObject({
      ok: true,
      batchId: null,
    })
    expect(enqueue).not.toHaveBeenCalled()
  })

  it('conflito: a frase do resumo, e o rascunho fica', () => {
    const { store, enqueue } = setup()
    const s = () => store.getState()
    const occult = Number(s().values.values.occult ?? 0)
    // O rascunho recuperado tem o "de" de antes: alguém mudou o Ocultismo
    s().restoreDraft(
      planDraftRestore(model, s().values, s().roles, {
        v: 1,
        characterId: ID,
        templateVersion: model.version,
        baseVersion: 2,
        mode: 'evolve',
        savedAt: Date.now(),
        edits: [{ path: 'values.occult', from: occult - 1, to: occult + 1 }],
      })
    )
    expect(s().conflict?.draft?.paths).toEqual(['values.occult'])
    expect(saveDraftNow(store)).toEqual({
      ok: false,
      message: CONFLICT_TEXT,
    })
    expect(s().draft?.size).toBe(1)
    expect(enqueue).not.toHaveBeenCalled()
  })

  it('recusa da conta: a frase da recusa, sem lote, e o rascunho fica', () => {
    const template = require('../../../../../design/templates/testes/acct-teste.json')
    const acct = compileTemplate(template)
    const enqueue = jest.fn()
    const store = createSheetStore({
      characterId: ID,
      model: acct,
      sheet: { values: {}, specialties: {} },
      sheetVersion: 0,
      roles: ['owner'],
      sync: { enqueue },
      creation: { config: effectiveCreationConfig(acct), choices: {} },
    })
    store.getState().startDraft()
    store.getState().setDraftValue('values.str', 5)
    expect(saveDraftNow(store)).toEqual({
      ok: false,
      message: REFUSAL_TEXT.CREATION_PRIORITIES_REQUIRED,
    })
    expect(enqueue).not.toHaveBeenCalled()
    expect(store.getState().draft?.size).toBe(1)
  })

  it('outra recusa: a primeira issue, ou a frase genérica', () => {
    const { store } = setup()
    store.getState().startDraft()
    store.getState().setDraftValue('values.strength', 3)
    const saveDraft = jest
      .spyOn(store.getState(), 'saveDraft')
      .mockReturnValueOnce({
        ok: false,
        kind: 'invalid',
        issues: [{ path: 'values.strength', message: 'Fora do limite' }],
      })
      .mockReturnValueOnce({ ok: false, kind: 'invalid', issues: [] })
    expect(saveDraftNow(store)).toEqual({
      ok: false,
      message: 'Fora do limite',
    })
    expect(saveDraftNow(store)).toEqual({
      ok: false,
      message: 'Não foi possível salvar.',
    })
    saveDraft.mockRestore()
  })
})
