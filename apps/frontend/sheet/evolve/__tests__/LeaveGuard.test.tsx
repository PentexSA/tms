import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { ThemeProvider } from '@tms/ui'
import { usePreventRemove } from 'expo-router'
import { modelOf } from '../../../test/fixtures'
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
      <LeaveGuard store={store} />
    </ThemeProvider>
  )

describe('LeaveGuard', () => {
  it('sem alterações, não segura a saída', () => {
    const { prevents } = prevention()
    renderGuard(storeWithDraft(0))
    expect(prevents()).toBe(false)
    expect(screen.queryByText('Sair sem salvar?')).toBeNull()
  })

  it('com rascunho: pergunta; "Continuar editando" fica; "Descartar e sair" sai', () => {
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
    expect(repeat).toHaveBeenCalled()
    expect(store.getState().draft).toBeNull()
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
