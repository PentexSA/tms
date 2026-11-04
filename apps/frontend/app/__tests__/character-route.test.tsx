import { fireEvent, render, screen } from '@testing-library/react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Try } from 'expo-router/build/views/Try'

import { captureError } from '../../lib/telemetry'
import CharacterRoute, { ErrorBoundary } from '../(app)/characters/[id]'

jest.mock('../../lib/telemetry', () => ({ captureError: jest.fn() }))

// O ?mode=evolve da criação vale só na chegada: recarregar ou voltar para a
// ficha abre no modo padrão do papel (dono em Jogo), não num Evoluir vazio.

const mockScreenProps = jest.fn()
jest.mock('../../sheet/SheetScreen', () => ({
  SheetScreen: (props: unknown) => {
    mockScreenProps(props)
    return null
  },
}))

const ID = '00000000-0000-4000-8000-00000000c001'

it('entra em Editar e tira o parâmetro da URL', () => {
  const setParams = jest.fn()
  jest.mocked(useRouter).mockReturnValue({ setParams } as never)
  jest.mocked(useLocalSearchParams).mockReturnValue({ id: ID, mode: 'evolve' })
  render(<CharacterRoute />)
  expect(mockScreenProps).toHaveBeenLastCalledWith({
    id: ID,
    initialMode: 'evolve',
  })
  expect(setParams).toHaveBeenCalledWith({ mode: undefined })
})

it('modo desconhecido na URL é ignorado; sem parâmetro, nada a limpar', () => {
  const setParams = jest.fn()
  jest.mocked(useRouter).mockReturnValue({ setParams } as never)
  jest.mocked(useLocalSearchParams).mockReturnValue({ id: ID, mode: 'admin' })
  render(<CharacterRoute />)
  expect(mockScreenProps).toHaveBeenLastCalledWith({
    id: ID,
    initialMode: undefined,
  })
  jest.mocked(useLocalSearchParams).mockReturnValue({ id: ID })
  setParams.mockClear()
  render(<CharacterRoute />)
  expect(setParams).not.toHaveBeenCalled()
})

// L-03: a ficha tem error boundary. Um erro ao desenhar fica na rota, com
// "Tentar de novo", e a mensagem do erro (que pode repetir valores da ficha)
// não aparece.

describe('ErrorBoundary da ficha', () => {
  const router = { push: jest.fn(), replace: jest.fn(), back: jest.fn() }
  beforeEach(() => {
    jest.mocked(useRouter).mockReturnValue(router as never)
  })

  it('título, "Tentar de novo" e nada da mensagem do erro', () => {
    const retry = jest.fn(() => Promise.resolve())
    render(
      <ErrorBoundary
        error={new Error('Helena Varga: força 99 fora do limite')}
        retry={retry}
      />
    )
    expect(
      screen.getByRole('header', {
        name: 'Não foi possível mostrar esta ficha',
      })
    ).toBeTruthy()
    expect(screen.queryByText(/Helena Varga|força 99/)).toBeNull()
    // No app, sem "Recarregar" (só no web)
    expect(screen.queryByRole('button', { name: 'Recarregar' })).toBeNull()
    fireEvent.press(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(retry).toHaveBeenCalled()
  })

  it('avisa o error tracking: este boundary engole o erro antes da raiz', () => {
    const error = new Error('x')
    render(<ErrorBoundary error={error} retry={() => Promise.resolve()} />)
    expect(captureError).toHaveBeenCalledWith(error, { source: 'boundary' })
  })

  it('voltar sem histórico vai para as crônicas', () => {
    render(
      <ErrorBoundary error={new Error('x')} retry={() => Promise.resolve()} />
    )
    fireEvent.press(
      screen.getByRole('button', { name: 'Voltar para Crônicas' })
    )
    expect(router.replace).toHaveBeenCalledWith('/')
  })

  it('o expo-router desenha o boundary no lugar da rota que quebrou', () => {
    let broken = true
    function Sheet() {
      if (broken) throw new Error('valor da ficha')
      return null
    }
    const error = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    try {
      render(
        <Try catch={ErrorBoundary}>
          <Sheet />
        </Try>
      )
      expect(
        screen.getByRole('header', {
          name: 'Não foi possível mostrar esta ficha',
        })
      ).toBeTruthy()
      broken = false
      fireEvent.press(screen.getByRole('button', { name: 'Tentar de novo' }))
      expect(
        screen.queryByRole('header', {
          name: 'Não foi possível mostrar esta ficha',
        })
      ).toBeNull()
    } finally {
      error.mockRestore()
    }
  })
})
