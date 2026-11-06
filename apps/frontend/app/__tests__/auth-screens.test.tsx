import { act, fireEvent, screen, waitFor } from '@testing-library/react-native'
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router'

import { clearPendingInvite, setPendingInvite } from '../../lib/invite/pending'
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

  // T-73 (P12): a frase pela situação, não o texto cru da API
  it('401: a frase do 401, sem navegar', async () => {
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
      'E-mail ou senha incorretos. Confira e tente de novo.'
    )
    expect(router.replace).not.toHaveBeenCalled()
  })

  it.each([
    [429, 'Muitas tentativas. Espere alguns minutos e tente de novo.'],
    [
      500,
      'Algo deu errado do nosso lado. Tente de novo. (código do erro: 123e4567)',
    ],
  ])('%i: %s', async (status, text) => {
    const { session } = testSession(() =>
      json(status, {
        error: 'texto da api',
        requestId: '123e4567-e89b-42d3-a456-426614174000',
      })
    )
    renderWithSession(<LoginScreen />, session)
    fireEvent.changeText(screen.getByTestId('login-email'), 'ana@example.test')
    fireEvent.changeText(screen.getByTestId('login-password'), 'errada')
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Entrar' }))
    })
    expect(screen.getByRole('alert')).toHaveTextContent(text)
    expect(screen.queryByText(/texto da api/)).toBeNull()
  })

  it('o e-mail sem "@" é conferido antes, com o erro no campo', async () => {
    const { session, fetch } = testSession(() => json(200, tokens()))
    renderWithSession(<LoginScreen />, session)
    fireEvent.changeText(screen.getByTestId('login-email'), 'nome')
    fireEvent.changeText(screen.getByTestId('login-password'), 'qualquer')
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Entrar' }))
    })
    expect(fetch).not.toHaveBeenCalled()
    // O erro é do campo (o TextField o anuncia), não uma faixa no topo
    expect(screen.getByText('Informe um e-mail válido.')).toBeTruthy()
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    // Corrigir tira o erro sem novo envio
    fireEvent.changeText(screen.getByTestId('login-email'), 'nome@example.test')
    expect(screen.queryByText('Informe um e-mail válido.')).toBeNull()
  })

  it('campos vazios não chamam a API', async () => {
    const { session, fetch } = testSession(() => json(200, tokens()))
    renderWithSession(<LoginScreen />, session)
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Entrar' }))
    })
    expect(fetch).not.toHaveBeenCalled()
    expect(screen.getByText('Informe um e-mail válido.')).toBeTruthy()
    expect(screen.getByText('Informe a senha.')).toBeTruthy()
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
    expect(screen.getByText('Informe um e-mail válido.')).toBeTruthy()
    expect(screen.getByText('Use só letras minúsculas.')).toBeTruthy()
    expect(screen.getByText('Pelo menos 15 caracteres.')).toBeTruthy()
  })

  // T-73 (P12): o erro some ao corrigir e diz o problema
  it('depois do envio, cada erro acompanha a digitação', async () => {
    const { session, fetch } = testSession(() => json(201, tokens()))
    renderWithSession(<RegisterScreen />, session)
    // Antes do primeiro envio, nada aparece enquanto se digita
    fireEvent.changeText(
      screen.getByTestId('register-username'),
      'Lucas Novato'
    )
    expect(screen.queryByText('Use só letras minúsculas.')).toBeNull()
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Criar conta' }))
    })
    expect(fetch).not.toHaveBeenCalled()
    expect(screen.getByText('Use só letras minúsculas.')).toBeTruthy()
    fireEvent.changeText(
      screen.getByTestId('register-username'),
      'lucas novato'
    )
    expect(screen.getByText('Sem espaços: use _ no lugar.')).toBeTruthy()
    fireEvent.changeText(screen.getByTestId('register-username'), 'lucás')
    expect(screen.getByText('Use letras sem acento, números e _.')).toBeTruthy()
    fireEvent.changeText(screen.getByTestId('register-username'), 'lu')
    expect(screen.getByText('De 3 a 24 caracteres.')).toBeTruthy()
    fireEvent.changeText(
      screen.getByTestId('register-username'),
      'lucas_novato'
    )
    expect(screen.queryByText('De 3 a 24 caracteres.')).toBeNull()
    // O e-mail corrigido também tira o erro, sem novo envio
    expect(screen.getByText('Informe um e-mail válido.')).toBeTruthy()
    fireEvent.changeText(
      screen.getByTestId('register-email'),
      'lucas@example.test'
    )
    expect(screen.queryByText('Informe um e-mail válido.')).toBeNull()
  })

  // O preenchimento automático muda dois campos no mesmo lote
  it('dois campos no mesmo lote: os dois valores chegam à API', async () => {
    const { session, fetch } = testSession(() => json(201, tokens()))
    renderWithSession(<RegisterScreen />, session)
    act(() => {
      screen
        .getByTestId('register-email')
        .props.onChangeText('ana@example.test')
      screen.getByTestId('register-username').props.onChangeText('ana')
      screen
        .getByTestId('register-password')
        .props.onChangeText('correct horse battery staple')
    })
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Criar conta' }))
    })
    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toEqual({
      email: 'ana@example.test',
      username: 'ana',
      password: 'correct horse battery staple',
    })
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

  // Integração da onda 2: o "Ir" da senha pode chegar antes do último
  // onChangeText; a conta não pode nascer com a senha cortada
  it('o Enter da senha cria a conta com a senha que chega com ele', async () => {
    const { session, fetch } = testSession(() => json(201, tokens()))
    renderWithSession(<RegisterScreen />, session)
    fireEvent.changeText(
      screen.getByTestId('register-email'),
      'ana@example.test'
    )
    fireEvent.changeText(screen.getByTestId('register-username'), 'ana')
    fireEvent.changeText(
      screen.getByTestId('register-password'),
      'correct horse'
    )
    await act(async () => {
      fireEvent(screen.getByTestId('register-password'), 'submitEditing', {
        nativeEvent: { text: 'correct horse battery staple' },
      })
    })
    const body = JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))
    expect(body.password).toBe('correct horse battery staple')
    expect(session.getState().status).toBe('signedIn')
  })

  it('409: a frase genérica com o próximo passo', async () => {
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
    // A mesma para e-mail ou nome já usados: não diz qual existe
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Não foi possível criar a conta com esses dados. Se você já tem conta, entre com ela; se não, tente outro nome de usuário.'
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

// P12, D-14: o link chega sem sessão; login ou cadastro, depois o convite
describe('convite pendente sem sessão', () => {
  const CODE = 'ABCD2345EFGH6789JKMN0PQRST'
  const BANNER =
    'Você recebeu um convite para uma crônica. Entre ou crie sua conta para continuar.'
  beforeEach(() => setPendingInvite(CODE))
  afterEach(() => clearPendingInvite())

  it('o login avisa, sem mostrar o código, e leva ao convite', async () => {
    const { session } = testSession(() => json(200, tokens()))
    renderWithSession(<LoginScreen />, session)
    expect(screen.getByText(BANNER)).toBeTruthy()
    expect(screen.queryByText(CODE, { exact: false })).toBeNull()
    fireEvent.changeText(screen.getByTestId('login-email'), 'ana@example.test')
    fireEvent.changeText(
      screen.getByTestId('login-password'),
      'senha longa demais'
    )
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Entrar' }))
    })
    expect(router.replace).toHaveBeenCalledWith('/join')
  })

  it('o cadastro avisa e leva ao convite', async () => {
    const { session } = testSession(() => json(201, tokens()))
    renderWithSession(<RegisterScreen />, session)
    expect(screen.getByText(BANNER)).toBeTruthy()
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
    expect(router.replace).toHaveBeenCalledWith('/join')
  })

  it('com sessão, o layout de autenticação redireciona ao convite', async () => {
    const { session } = testSession(
      () => json(200, tokens()),
      memoryStore(true, 'refresh-0')
    )
    await session.restore()
    renderWithSession(<AuthLayout />, session)
    const hrefs = jest
      .mocked(Redirect)
      .mock.calls.map(c => (c[0] as { href: string }).href)
    expect(hrefs.at(-1)).toBe('/join')
  })

  it('sem convite, nenhum aviso', () => {
    clearPendingInvite()
    const { session } = testSession(() => json(200, tokens()))
    renderWithSession(<LoginScreen />, session)
    expect(screen.queryByText(BANNER)).toBeNull()
  })
})
