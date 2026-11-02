import {
  act,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react-native'
import { ThemeProvider } from '@tms/ui'
import { usePreventRemove } from 'expo-router'
import { Dimensions, StyleSheet } from 'react-native'
import { sheetsDismissed } from '../../test/queries'
import {
  UnsavedChangesGuard,
  type UnsavedChangesGuardProps,
} from '../UnsavedChangesGuard'

// A guarda genérica de saída (T-56) com o "Salvar e sair" da D-01 (P03-D):
// três ações quando há `onSave`, duas sem ele (Nova ficha, regras da
// crônica), e a saída depois que a folha sai da tela.

const PHONE = { width: 390, height: 844, scale: 3, fontScale: 1 }
const DESKTOP = { width: 1280, height: 800, scale: 1, fontScale: 1 }
const TABLET = { width: 750, height: 1334, scale: 2, fontScale: 1 }
const resize = (size: typeof PHONE) =>
  act(() => Dimensions.set({ window: size, screen: size }))
afterEach(() => resize(TABLET))

function setup(props: Partial<UnsavedChangesGuardProps> = {}) {
  const hook = jest.mocked(usePreventRemove)
  const repeat = jest.fn()
  render(
    <ThemeProvider>
      <UnsavedChangesGuard when message="2 alterações se perdem." {...props} />
    </ThemeProvider>
  )
  const last = () => hook.mock.calls[hook.mock.calls.length - 1]
  return {
    repeat,
    leave: () =>
      act(() =>
        last()?.[1]?.({
          data: { action: { type: 'GO_BACK' } },
          repeat,
        } as never)
      ),
  }
}

const buttons = () =>
  within(screen.getByTestId('leave-actions'))
    .getAllByRole('button')
    .map(b => b.props.accessibilityLabel)

describe('UnsavedChangesGuard', () => {
  it('sem onSave: duas ações, como antes', () => {
    const { leave } = setup()
    leave()
    expect(screen.getByText('Sair sem salvar?')).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Continuar editando' })
    ).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Descartar e sair' })
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Salvar e sair' })).toBeNull()
    expect(screen.queryByTestId('leave-actions')).toBeNull()
  })

  it('com onSave, no celular: três ações em coluna, a principal embaixo', () => {
    resize(PHONE)
    const { leave } = setup({ onSave: () => ({ ok: true }) })
    leave()
    expect(buttons()).toEqual([
      'Descartar e sair',
      'Continuar editando',
      'Salvar e sair',
    ])
    expect(
      StyleSheet.flatten(screen.getByTestId('leave-actions').props.style)
        .flexDirection
    ).toBeUndefined()
  })

  it('com onSave, a 1280: numa linha, "Descartar e sair" à esquerda', () => {
    resize(DESKTOP)
    const { leave } = setup({ onSave: () => ({ ok: true }) })
    leave()
    expect(buttons()).toEqual([
      'Descartar e sair',
      'Continuar editando',
      'Salvar e sair',
    ])
    expect(
      StyleSheet.flatten(screen.getByTestId('leave-actions').props.style)
        .flexDirection
    ).toBe('row')
  })

  it('com fonte de 130%, em coluna também na tela larga', () => {
    resize({ ...DESKTOP, fontScale: 1.3 })
    const { leave } = setup({ onSave: () => ({ ok: true }) })
    leave()
    expect(
      StyleSheet.flatten(screen.getByTestId('leave-actions').props.style)
        .flexDirection
    ).toBeUndefined()
  })

  it('"Descartar e sair" desfaz na hora e sai no onClosed', async () => {
    const onDiscard = jest.fn()
    const { leave, repeat } = setup({ onDiscard })
    leave()
    fireEvent.press(screen.getByRole('button', { name: 'Descartar e sair' }))
    expect(onDiscard).toHaveBeenCalledTimes(1)
    expect(repeat).not.toHaveBeenCalled()
    await sheetsDismissed()
    expect(repeat).toHaveBeenCalledTimes(1)
  })

  it('"Salvar e sair" grava e sai no onClosed, sem descartar', async () => {
    const onDiscard = jest.fn()
    const onSave = jest.fn(() => ({ ok: true }) as const)
    const { leave, repeat } = setup({ onDiscard, onSave })
    leave()
    fireEvent.press(screen.getByRole('button', { name: 'Salvar e sair' }))
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onDiscard).not.toHaveBeenCalled()
    expect(repeat).not.toHaveBeenCalled()
    await sheetsDismissed()
    expect(repeat).toHaveBeenCalledTimes(1)
  })

  it('a gravação recusada fica na folha com a frase, sem descartar nem sair', async () => {
    const onDiscard = jest.fn()
    const onSave = jest.fn(
      () => ({ ok: false, message: 'Não foi possível salvar.' }) as const
    )
    const { leave, repeat } = setup({ onDiscard, onSave })
    leave()
    fireEvent.press(screen.getByRole('button', { name: 'Salvar e sair' }))
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Não foi possível salvar.'
    )
    expect(screen.getByText('Sair sem salvar?')).toBeTruthy()
    await sheetsDismissed()
    expect(onDiscard).not.toHaveBeenCalled()
    expect(repeat).not.toHaveBeenCalled()
    // "Continuar editando" fecha sem sair; a próxima tentativa abre limpa
    fireEvent.press(screen.getByRole('button', { name: 'Continuar editando' }))
    await sheetsDismissed()
    expect(repeat).not.toHaveBeenCalled()
    leave()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('o rótulo do "Salvar e sair" pode mudar', () => {
    const { leave } = setup({
      onSave: () => ({ ok: true }),
      saveLabel: 'Guardar e sair',
    })
    leave()
    expect(screen.getByRole('button', { name: 'Guardar e sair' })).toBeTruthy()
  })

  it('com allowLeave, passa direto, sem folha', () => {
    const { leave, repeat } = setup({ allowLeave: { current: true } })
    leave()
    expect(repeat).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Sair sem salvar?')).toBeNull()
  })
})
