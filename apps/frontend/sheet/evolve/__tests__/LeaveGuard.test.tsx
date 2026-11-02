import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { compileTemplate, effectiveCreationConfig } from '@tms/sheet-core'
import { ThemeProvider, ToastProvider } from '@tms/ui'
import { usePreventRemove } from 'expo-router'
import { Platform } from 'react-native'
import { modelOf } from '../../../test/fixtures'
import { sheetsDismissed } from '../../../test/queries'
import { REFUSAL_TEXT } from '../../creation/creation'
import { createSheetStore } from '../../store/sheetStore'
import { LeaveGuard } from '../LeaveGuard'

// Etapa 18: sair com rascunho de Evoluir pede confirmação. O usePreventRemove
// do Expo Router segura a navegação e, no web, o beforeunload do navegador.

const model = modelOf('vtm-v20')

function storeWithDraft(changes: number) {
  const store = createSheetStore({
    characterId: 'c1',
    model,
    sheet: { values: { name: 'Nova', strength: 2 }, specialties: {} },
    sheetVersion: 1,
    roles: ['owner'],
    mode: 'evolve',
    sync: { enqueue: jest.fn() },
  })
  store.getState().startDraft()
  if (changes > 0) store.getState().setDraftValue('values.strength', 3)
  if (changes > 1) store.getState().setDraftValue('values.dexterity', 3)
  return store
}

/** O último pedido do guard e a navegação que ele segurou. */
function prevention() {
  const hook = jest.mocked(usePreventRemove)
  const repeat = jest.fn()
  const last = () => hook.mock.calls[hook.mock.calls.length - 1]
  return {
    prevents: () => last()?.[0],
    repeat,
    // A navegação tenta remover a tela com a prevenção ligada
    leave: () =>
      act(() =>
        last()?.[1]?.({ data: { action: { type: 'GO_BACK' } }, repeat })
      ),
  }
}

const renderGuard = (store: ReturnType<typeof storeWithDraft>) =>
  render(
    <ThemeProvider>
      <ToastProvider>
        <LeaveGuard store={store} />
      </ToastProvider>
    </ThemeProvider>
  )

/** Roda com o Platform.OS trocado (o mock do jest é 'ios'). */
async function onPlatform(os: string, run: () => Promise<void>) {
  const before = Platform.OS
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true })
  try {
    await run()
  } finally {
    Object.defineProperty(Platform, 'OS', { value: before, configurable: true })
  }
}

describe('LeaveGuard', () => {
  it('sem alterações, não segura a saída', () => {
    const { prevents } = prevention()
    renderGuard(storeWithDraft(0))
    expect(prevents()).toBe(false)
    expect(screen.queryByText('Sair sem salvar?')).toBeNull()
  })

  it('com rascunho: pergunta; "Continuar editando" fica; "Descartar e sair" sai', async () => {
    const { prevents, leave, repeat } = prevention()
    const store = storeWithDraft(2)
    renderGuard(store)
    expect(prevents()).toBe(true)
    leave()
    expect(screen.getByText('Sair sem salvar?')).toBeTruthy()
    expect(
      screen.getByText(
        '2 alterações da edição ainda não foram salvas e serão descartadas.'
      )
    ).toBeTruthy()
    fireEvent.press(screen.getByRole('button', { name: 'Continuar editando' }))
    expect(screen.queryByText('Sair sem salvar?')).toBeNull()
    expect(repeat).not.toHaveBeenCalled()

    leave()
    fireEvent.press(screen.getByRole('button', { name: 'Descartar e sair' }))
    expect(store.getState().draft).toBeNull()
    // Sai depois que a folha sai da tela (onClosed); até lá, a tela segue
    // segura contra um segundo "voltar"
    expect(repeat).not.toHaveBeenCalled()
    expect(prevents()).toBe(true)
    await sheetsDismissed()
    expect(repeat).toHaveBeenCalledTimes(1)
    expect(prevents()).toBe(false)
  })

  it('uma alteração: a frase no singular', () => {
    const { leave } = prevention()
    renderGuard(storeWithDraft(1))
    leave()
    expect(
      screen.getByText(
        '1 alteração da edição ainda não foi salva e será descartada.'
      )
    ).toBeTruthy()
  })

  it('a prevenção acompanha o rascunho: liga ao editar, desliga ao descartar', () => {
    const { prevents } = prevention()
    const store = storeWithDraft(0)
    renderGuard(store)
    expect(prevents()).toBe(false)
    act(() => store.getState().setDraftValue('values.strength', 3))
    expect(prevents()).toBe(true)
    act(() => store.getState().discardDraft())
    expect(prevents()).toBe(false)
  })
})

// P03-D (T-04, D-01): "Salvar e sair" grava o rascunho num lote e só então
// sai, depois que a folha sai da tela
describe('LeaveGuard: "Salvar e sair"', () => {
  it('grava um lote, zera o rascunho e sai só no onDismiss (iOS e web)', async () => {
    for (const os of ['ios', 'web']) {
      await onPlatform(os, async () => {
        const { leave, repeat } = prevention()
        const store = storeWithDraft(2)
        const view = renderGuard(store)
        leave()
        fireEvent.press(screen.getByRole('button', { name: 'Salvar e sair' }))
        expect(store.getState().pending).toHaveLength(1)
        expect(store.getState().pending[0]?.events).toHaveLength(2)
        expect(store.getState().draft).toBeNull()
        expect(screen.queryByText('Sair sem salvar?')).toBeNull()
        expect(repeat).not.toHaveBeenCalled()
        await sheetsDismissed()
        expect(repeat).toHaveBeenCalledTimes(1)
        // O toast sem "Desfazer": o store sai com a tela
        expect(screen.getByText(/^Salvo: /)).toBeTruthy()
        expect(screen.queryByRole('button', { name: 'Desfazer' })).toBeNull()
        view.unmount()
      })
    }
  })

  it('no Android, sai assim que a folha fica invisível', async () => {
    await onPlatform('android', async () => {
      const { leave, repeat } = prevention()
      const store = storeWithDraft(1)
      renderGuard(store)
      leave()
      fireEvent.press(screen.getByRole('button', { name: 'Salvar e sair' }))
      expect(store.getState().pending).toHaveLength(1)
      expect(repeat).toHaveBeenCalledTimes(1)
    })
  })

  it('dois toques no mesmo quadro: um lote e uma saída', async () => {
    const { leave, repeat } = prevention()
    const store = storeWithDraft(2)
    renderGuard(store)
    leave()
    const save = screen.getByRole('button', { name: 'Salvar e sair' })
    const saveDraft = jest.spyOn(store.getState(), 'saveDraft')
    act(() => {
      fireEvent.press(save)
      fireEvent.press(save)
    })
    expect(saveDraft).toHaveBeenCalledTimes(1)
    expect(store.getState().pending).toHaveLength(1)
    await sheetsDismissed()
    expect(repeat).toHaveBeenCalledTimes(1)
  })

  it('recusa da conta: a frase aparece como alerta, nada sai e o rascunho fica', async () => {
    const template = require('../../../../../design/templates/testes/acct-teste.json')
    const acct = compileTemplate(template)
    const store = createSheetStore({
      characterId: 'c1',
      model: acct,
      sheet: { values: {}, specialties: {} },
      sheetVersion: 0,
      roles: ['owner'],
      sync: { enqueue: jest.fn() },
      creation: { config: effectiveCreationConfig(acct), choices: {} },
    })
    store.getState().startDraft()
    // Sem as prioridades, a conta recusa o lote (no aparelho e no servidor)
    store.getState().setDraftValue('values.str', 5)
    expect(store.getState().draft?.size).toBe(1)
    const { leave, repeat } = prevention()
    renderGuard(store)
    leave()
    fireEvent.press(screen.getByRole('button', { name: 'Salvar e sair' }))
    expect(screen.getByRole('alert')).toHaveTextContent(
      REFUSAL_TEXT.CREATION_PRIORITIES_REQUIRED
    )
    expect(screen.getByText('Sair sem salvar?')).toBeTruthy()
    expect(store.getState().draft?.size).toBe(1)
    expect(store.getState().pending).toHaveLength(0)
    await sheetsDismissed()
    expect(repeat).not.toHaveBeenCalled()
    // A trava solta: corrigido, o toque de novo grava (aqui, ainda recusa)
    fireEvent.press(screen.getByRole('button', { name: 'Salvar e sair' }))
    expect(screen.getByRole('alert')).toBeTruthy()
    // "Continuar editando" fecha e limpa a frase
    fireEvent.press(screen.getByRole('button', { name: 'Continuar editando' }))
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
