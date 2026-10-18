import { act, fireEvent, screen } from '@testing-library/react-native'

import {
  json,
  memoryStore,
  renderWithSession,
  testSession,
  tokens,
} from '../../test/session'
import HomeScreen from '../(app)/index'

/**
 * Tela inicial (placeholder até a tela de Crônicas, Etapa 11).
 * O cliente da API (lib/api) é mockado para controlar as respostas do Eden.
 */
const mockHealth = jest.fn()
jest.mock('../../lib/api', () => ({
  ...jest.requireActual('../../lib/api'),
  api: { health: { get: (...args: unknown[]) => mockHealth(...args) } },
}))

async function signedIn() {
  const { session, fetch } = testSession(
    () => json(200, tokens()),
    memoryStore(true, 'refresh-0')
  )
  await session.restore()
  return { session, fetch }
}

describe('HomeScreen', () => {
  it('cumprimenta o usuário e mostra a API online', async () => {
    mockHealth.mockResolvedValue({ data: { ok: true }, error: null })
    const { session } = await signedIn()
    renderWithSession(<HomeScreen />, session)
    expect(screen.getByRole('header', { name: 'TMS' })).toBeTruthy()
    expect(screen.getByText('Olá, ana')).toBeTruthy()
    expect(await screen.findByText('API online')).toBeTruthy()
  })

  it('API fora do ar', async () => {
    mockHealth.mockResolvedValue({ data: null, error: { status: 500 } })
    const { session } = await signedIn()
    renderWithSession(<HomeScreen />, session)
    expect(await screen.findByText('API indisponível')).toBeTruthy()
  })

  it('sair encerra a sessão e limpa o cache', async () => {
    mockHealth.mockResolvedValue({ data: { ok: true }, error: null })
    const { session } = await signedIn()
    const { queryClient } = renderWithSession(<HomeScreen />, session)
    const clear = jest.spyOn(queryClient, 'clear')
    await screen.findByText('API online')
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Sair' }))
    })
    expect(session.getState().status).toBe('signedOut')
    // O cache do usuário some (a guarda de rota leva ao login)
    expect(clear).toHaveBeenCalledTimes(1)
  })
})
