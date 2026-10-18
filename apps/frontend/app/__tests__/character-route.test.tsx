import { render } from '@testing-library/react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'

import CharacterRoute from '../(app)/characters/[id]'

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

it('entra em Evoluir e tira o parâmetro da URL', () => {
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
