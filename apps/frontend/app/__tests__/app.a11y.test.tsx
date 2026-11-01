import { screen, waitFor } from '@testing-library/react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'

import { json, renderWithSession, testSession } from '../../test/session'
import AppLayout from '../(app)/_layout'
import LoginScreen from '../(auth)/login'
import RegisterScreen from '../(auth)/register'

// Acessibilidade das telas do app (P06 da onda 1): um teste de regressão
// por bug.

beforeEach(() => {
  jest.mocked(useRouter).mockReturnValue({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  } as never)
  jest.mocked(useLocalSearchParams).mockReturnValue({})
})

const noKeyboardHelp = (testID: string) => {
  const input = screen.getByTestId(testID)
  expect(input.props.autoCorrect).toBe(false)
  expect(input.props.spellCheck).toBe(false)
  expect(input.props.autoCapitalize).toBe('none')
}

describe('E-mail e usuário sem corretor (T-38)', () => {
  it('login: o e-mail não passa pelo corretor', () => {
    const { session } = testSession(() => new Response(null, { status: 401 }))
    renderWithSession(<LoginScreen />, session)
    noKeyboardHelp('login-email')
  })

  it('cadastro: o e-mail e o nome de usuário também não', () => {
    const { session } = testSession(() => new Response(null, { status: 401 }))
    renderWithSession(<RegisterScreen />, session)
    noKeyboardHelp('register-email')
    noKeyboardHelp('register-username')
  })
})

describe('Restauração da sessão (T-72)', () => {
  it('app bar "TMS" e carregamento anunciado, sem dado do usuário', async () => {
    const { session } = testSession(() => json(401, {}))
    renderWithSession(<AppLayout />, session)
    expect(session.getState().status).toBe('loading')
    expect(screen.getByRole('header', { name: 'TMS' })).toBeTruthy()
    expect(screen.getByLabelText('Carregando')).toBeBusy()
    // Deixa a restauração terminar (vai para o login) antes de desmontar
    await waitFor(() => expect(session.getState().status).toBe('signedOut'))
  })
})
