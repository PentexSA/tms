import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { ThemeProvider } from '@tms/ui'
import { useNavigation } from 'expo-router'
import { Platform } from 'react-native'
import { modelOf } from '../../../test/fixtures'
import { createSheetStore } from '../../store/sheetStore'
import { LeaveGuard } from '../LeaveGuard'

// Etapa 18: sair com rascunho de Evoluir pede confirmação (beforeRemove da
// navegação e beforeunload do web).

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

function withNavigation() {
  let listener: ((e: unknown) => void) | undefined
  const unsubscribe = jest.fn()
  const nav = {
    addListener: jest.fn((_: string, cb: (e: unknown) => void) => {
      listener = cb
      return unsubscribe
    }),
    dispatch: jest.fn(),
  }
  jest.mocked(useNavigation).mockReturnValue(nav as never)
  const leave = () => {
    const e = {
      preventDefault: jest.fn(),
      data: { action: { type: 'GO_BACK' } },
    }
    act(() => listener?.(e))
    return e
  }
  return { nav, leave, unsubscribe }
}

const renderGuard = (store: ReturnType<typeof storeWithDraft>) =>
  render(
    <ThemeProvider>
      <LeaveGuard store={store} />
    </ThemeProvider>
  )

describe('LeaveGuard', () => {
  it('sem alterações, sai sem perguntar', () => {
    const { leave } = withNavigation()
    renderGuard(storeWithDraft(0))
    expect(leave().preventDefault).not.toHaveBeenCalled()
    expect(screen.queryByText('Sair sem salvar?')).toBeNull()
  })

  it('com rascunho: pergunta; "Continuar editando" fica; "Descartar e sair" sai', () => {
    const { nav, leave, unsubscribe } = withNavigation()
    const store = storeWithDraft(2)
    const { unmount } = renderGuard(store)
    expect(leave().preventDefault).toHaveBeenCalled()
    expect(screen.getByText('Sair sem salvar?')).toBeTruthy()
    expect(
      screen.getByText(
        '2 alterações da edição ainda não foram salvas e serão descartadas.'
      )
    ).toBeTruthy()
    fireEvent.press(screen.getByRole('button', { name: 'Continuar editando' }))
    expect(screen.queryByText('Sair sem salvar?')).toBeNull()
    expect(nav.dispatch).not.toHaveBeenCalled()

    leave()
    fireEvent.press(screen.getByRole('button', { name: 'Descartar e sair' }))
    expect(nav.dispatch).toHaveBeenCalledWith({ type: 'GO_BACK' })
    expect(store.getState().draft).toBeNull()
    unmount()
    expect(unsubscribe).toHaveBeenCalled()
  })

  it('uma alteração: a frase no singular', () => {
    const { leave } = withNavigation()
    renderGuard(storeWithDraft(1))
    leave()
    expect(
      screen.getByText(
        '1 alteração da edição ainda não foi salva e será descartada.'
      )
    ).toBeTruthy()
  })

  it('no web, recarregar ou fechar a aba com rascunho avisa o navegador', () => {
    const os = Platform.OS
    const handlers: ((e: unknown) => void)[] = []
    const win = {
      addEventListener: jest.fn((_: string, cb: (e: unknown) => void) =>
        handlers.push(cb)
      ),
      removeEventListener: jest.fn(),
    }
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true })
    ;(globalThis as { window?: unknown }).window = win
    try {
      const store = storeWithDraft(1)
      const { unmount } = renderGuard(store)
      const event = { preventDefault: jest.fn(), returnValue: undefined }
      handlers[0]?.(event)
      expect(event.preventDefault).toHaveBeenCalled()
      expect(event.returnValue).toBe('')
      store.getState().discardDraft()
      const clean = { preventDefault: jest.fn(), returnValue: undefined }
      handlers[0]?.(clean)
      expect(clean.preventDefault).not.toHaveBeenCalled()
      unmount()
      expect(win.removeEventListener).toHaveBeenCalled()
    } finally {
      Object.defineProperty(Platform, 'OS', { value: os, configurable: true })
      delete (globalThis as { window?: unknown }).window
    }
  })
})
