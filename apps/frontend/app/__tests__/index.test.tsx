import { screen } from '@testing-library/react-native'
import { renderWithQueryClient } from '../../test/utils'
import HomeScreen from '../index'

/**
 * Testes da tela inicial (placeholder até a tela de Crônicas)
 *
 * O cliente da API (lib/api) é mockado para controlar as respostas do Eden.
 */

const mockHealth = jest.fn()

jest.mock('../../lib/api', () => ({
  ...jest.requireActual('../../lib/api'),
  api: { health: { get: (...args: unknown[]) => mockHealth(...args) } },
}))

describe('HomeScreen', () => {
  it('should render the app title', () => {
    mockHealth.mockResolvedValue({ data: { ok: true }, error: null })

    renderWithQueryClient(<HomeScreen />)

    expect(screen.getByRole('header', { name: 'TMS' })).toBeTruthy()
  })

  it('should show when the API is online', async () => {
    mockHealth.mockResolvedValue({ data: { ok: true }, error: null })

    renderWithQueryClient(<HomeScreen />)

    expect(await screen.findByText('API online')).toBeTruthy()
  })

  it('should show when the API is unavailable', async () => {
    mockHealth.mockResolvedValue({ data: null, error: { status: 500 } })

    renderWithQueryClient(<HomeScreen />)

    expect(await screen.findByText('API indisponível')).toBeTruthy()
  })
})
