import { act, fireEvent, screen, waitFor } from '@testing-library/react-native'
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router'

import {
  json,
  memoryStore,
  renderWithSession,
  testSession,
  tokens,
} from '../../test/session'
import AppLayout from '../(app)/_layout'
import AuthLayout from '../(auth)/_layout'
import LoginScreen from '../(auth)/login'
import RegisterScreen from '../(auth)/register'

const router = { push: jest.fn(), replace: jest.fn(), back: jest.fn() }
beforeEach(() => {
  jest.mocked(useRouter).mockReturnValue(router as never)
  jest.mocked(useLocalSearchParams).mockReturnValue({})
})

describe('LoginScreen', () => {
  it('entra e vai para o app', async () => {
    const { session, fetch } = testSession(() => json(200, tokens()))
    renderWithSession(<LoginScreen />, session)
    fireEvent.changeText(
      screen.getByTestId('login-email'),
      ' ana@example.test '
    )
    fireEvent.changeText(
      screen.getByTestId('login-password'),
      'senha longa demais'
    )
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Entrar' }))
    })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toEqual({
      email: 'ana@example.test',
      password: 'senha longa demais',
    })
    expect(router.replace).toHaveBeenCalledWith('/')
  })

  it('erro da API aparece como alerta, sem navegar', async () => {
    const { session } = testSession(() =>
      json(401, { error: 'e-mail ou senha incorretos' })
    )
    renderWithSession(<LoginScreen />, session)
    fireEvent.changeText(screen.getByTestId('login-email'), 'ana@example.test')
    fireEvent.changeText(screen.getByTestId('login-password'), 'errada')
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Entrar' }))
    })
    expect(screen.getByRole('alert')).toHaveTextContent(
      'e-mail ou senha incorretos'
    )
    expect(router.replace).not.toHaveBeenCalled()
  })

  it('campos vazios não chamam a API', async () => {
    const { session, fetch } = testSession(() => json(200, tokens()))
    renderWithSession(<LoginScreen />, session)
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Entrar' }))
    })
    expect(fetch).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Informe o e-mail e a senha'
    )
  })

  it('leva ao cadastro', () => {
    const { session } = testSession(() => json(200, tokens()))
    renderWithSession(<LoginScreen />, session)
    fireEvent.press(screen.getByRole('button', { name: 'Criar conta' }))
    expect(router.replace).toHaveBeenCalledWith('/register')
  })

  it('vindo da exclusão de conta, avisa que os dados foram apagados', () => {
    jest.mocked(useLocalSearchParams).mockReturnValueOnce({ deleted: '1' })
    const { session } = testSession(() => json(200, tokens()))
    renderWithSession(<LoginScreen />, session)
    expect(screen.getByText('Conta excluída')).toBeTruthy()
    expect(screen.getByText(/inclusive os deste aparelho/)).toBeTruthy()
  })

  it('sem o aviso no login normal', () => {
    const { session } = testSession(() => json(200, tokens()))
    renderWithSession(<LoginScreen />, session)
    expect(screen.queryByText('Conta excluída')).toBeNull()
  })
})

describe('RegisterScreen', () => {
  it('valida antes de chamar a API', async () => {
    const { session, fetch } = testSession(() => json(201, tokens()))
    renderWithSession(<RegisterScreen />, session)
    fireEvent.changeText(screen.getByTestId('register-email'), 'ana')
    fireEvent.changeText(screen.getByTestId('register-username'), 'Ana')
    fireEvent.changeText(screen.getByTestId('register-password'), 'curta')
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Criar conta' }))
    })
    expect(fetch).not.toHaveBeenCalled()
    expect(screen.getByText('Informe um e-mail válido')).toBeTruthy()
    expect(screen.getByText('Pelo menos 15 caracteres')).toBeTruthy()
  })

  it('cria a conta e entra', async () => {
    const { session } = testSession(() => json(201, tokens()))
    renderWithSession(<RegisterScreen />, session)
    fireEvent.changeText(
      screen.getByTestId('register-email'),
      'ana@example.test'
    )
    fireEvent.changeText(screen.getByTestId('register-username'), 'ana')
    fireEvent.changeText(
      screen.getByTestId('register-password'),
      'correct horse battery staple'
    )
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Criar conta' }))
    })
    expect(session.getState().status).toBe('signedIn')
    expect(router.replace).toHaveBeenCalledWith('/')
  })

  it('conta existente: mensagem genérica da API', async () => {
    const { session } = testSession(() =>
      json(409, { error: 'não foi possível criar a conta com esses dados' })
    )
    renderWithSession(<RegisterScreen />, session)
    fireEvent.changeText(
      screen.getByTestId('register-email'),
      'ana@example.test'
    )
    fireEvent.changeText(screen.getByTestId('register-username'), 'ana')
    fireEvent.changeText(
      screen.getByTestId('register-password'),
      'x'.repeat(15)
    )
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Criar conta' }))
    })
    expect(screen.getByRole('alert')).toHaveTextContent(
      'não foi possível criar a conta com esses dados'
    )
  })

  it('volta ao login', () => {
    const { session } = testSession(() => json(201, tokens()))
    renderWithSession(<RegisterScreen />, session)
    fireEvent.press(screen.getByRole('button', { name: 'Já tenho conta' }))
    expect(router.replace).toHaveBeenCalledWith('/login')
  })
})

describe('guardas de rota', () => {
  const redirectedTo = () =>
    jest.mocked(Redirect).mock.calls.map(c => (c[0] as { href: string }).href)

  it('sem sessão, o app manda para o login', async () => {
    const { session } = testSession(() => json(401, {}))
    renderWithSession(<AppLayout />, session)
    expect(screen.getByLabelText('Carregando')).toBeTruthy()
    await waitFor(() => expect(redirectedTo()).toContain('/login'))
  })

  it('com sessão, o app abre e o login redireciona para dentro', async () => {
    const { session } = testSession(
      () => json(200, tokens()),
      memoryStore(true, 'refresh-0')
    )
    renderWithSession(<AppLayout />, session)
    await waitFor(() => expect(session.getState().status).toBe('signedIn'))
    expect(redirectedTo()).not.toContain('/login')
    renderWithSession(<AuthLayout />, session)
    expect(redirectedTo()).toContain('/')
  })

  it('o login sem sessão mostra as telas de autenticação', async () => {
    const { session } = testSession(() => json(401, {}))
    const view = renderWithSession(<AuthLayout />, session)
    await waitFor(() => expect(session.getState().status).toBe('signedOut'))
    expect(view.toJSON()).toBeTruthy()
    expect(redirectedTo()).toEqual([])
  })
})
