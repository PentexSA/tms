import { act, fireEvent, screen, waitFor } from '@testing-library/react-native'
import { useRouter } from 'expo-router'

import * as apiModule from '../../lib/api'
import { type createFakeApi, fail, ok } from '../../test/fake-api'
import {
  json,
  memoryStore,
  renderWithSession,
  testSession,
  tokens,
} from '../../test/session'
import AccountScreen from '../(app)/account'

// Etapa 22: excluir a conta (LGPD art. 18) pela tela "Conta".

jest.mock('../../lib/api', () => {
  const { createFakeApi } = require('../../test/fake-api')
  const fake = createFakeApi()
  return { ...jest.requireActual('../../lib/api'), api: fake.api, fake }
})
const calls = (
  apiModule as unknown as { fake: ReturnType<typeof createFakeApi> }
).fake.calls
const router = { push: jest.fn(), replace: jest.fn(), back: jest.fn() }

beforeEach(() => {
  jest.mocked(useRouter).mockReturnValue(router as never)
})

async function signedIn(refresh = () => json(200, tokens())) {
  const store = memoryStore(true, 'refresh-0')
  const { session, fetch } = testSession(refresh, store)
  await session.restore()
  return { session, store, fetch }
}

async function confirm(password = 'minha senha longa demais') {
  fireEvent.changeText(screen.getByTestId('account-password'), password)
  await act(async () => {
    fireEvent.press(screen.getByRole('button', { name: 'Excluir conta' }))
  })
}

describe('Conta', () => {
  it('diz o que acontece com os dados antes de excluir', async () => {
    const { session } = await signedIn()
    renderWithSession(<AccountScreen />, session)
    expect(
      screen.getByText(/Sua conta, suas fichas e seus convites/)
    ).toBeTruthy()
    expect(screen.getByText(/como “Conta excluída”/)).toBeTruthy()
    expect(screen.getByText(/dados guardados neste aparelho/)).toBeTruthy()
    fireEvent.press(
      screen.getByRole('button', { name: 'Voltar para Crônicas' })
    )
    expect(router.replace).toHaveBeenCalledWith('/')
  })

  it('sem senha: pede a senha e não chama a API', async () => {
    const { session } = await signedIn()
    renderWithSession(<AccountScreen />, session)
    fireEvent.press(screen.getByRole('button', { name: 'Excluir conta' }))
    expect(screen.getByText('Informe a sua senha para confirmar.')).toBeTruthy()
    expect(calls.meDelete).not.toHaveBeenCalled()
  })

  it('exclui com a senha: sai, apaga o aparelho e vai para o login com aviso', async () => {
    calls.meDelete.mockResolvedValue(ok(null))
    const { session, store } = await signedIn()
    renderWithSession(<AccountScreen />, session)
    await confirm()
    expect(calls.meDelete).toHaveBeenCalledWith({
      password: 'minha senha longa demais',
    })
    await waitFor(() => expect(session.getState().status).toBe('signedOut'))
    expect(await store.read()).toBeNull()
    expect(router.replace).toHaveBeenCalledWith('/login?deleted=1')
  })

  it('senha errada: avisa, limpa o campo e continua na conta', async () => {
    calls.meDelete.mockResolvedValue(
      fail(401, 'não foi possível confirmar a senha')
    )
    const { session } = await signedIn()
    renderWithSession(<AccountScreen />, session)
    await confirm('errada')
    expect(screen.getByText('Senha incorreta.')).toBeTruthy()
    expect(screen.getByTestId('account-password').props.value).toBe('')
    expect(session.getState().status).toBe('signedIn')
    expect(router.replace).not.toHaveBeenCalled()
  })

  it('narra crônica com outros jogadores: 409 lista as crônicas para abrir', async () => {
    calls.meDelete.mockResolvedValue({
      data: null,
      error: {
        status: 409,
        value: {
          error: 'Passe a narração ou exclua a crônica antes',
          chronicles: [
            { id: 'c1', name: 'Crônica da Liberdade' },
            { id: 'c2', name: 'Noites de São Paulo' },
            { lixo: true },
          ],
        },
      },
    })
    const { session } = await signedIn()
    renderWithSession(<AccountScreen />, session)
    await confirm()
    expect(
      screen.getByText('Passe a narração ou exclua a crônica antes')
    ).toBeTruthy()
    expect(screen.getAllByRole('button', { name: /^Abrir / })).toHaveLength(2)
    fireEvent.press(
      screen.getByRole('button', { name: 'Abrir Crônica da Liberdade' })
    )
    expect(router.push).toHaveBeenCalledWith('/chronicles/c1')
    expect(session.getState().status).toBe('signedIn')
  })

  it('a sessão é renovada antes de mandar a senha; sem rede, não manda', async () => {
    let online = true
    const { session, fetch } = await signedIn(() => {
      if (!online) throw new TypeError('Network request failed')
      return json(200, tokens(2))
    })
    renderWithSession(<AccountScreen />, session)
    online = false
    await confirm()
    expect(
      screen.getByText(/Não foi possível confirmar a sua sessão/)
    ).toBeTruthy()
    expect(calls.meDelete).not.toHaveBeenCalled()
    online = true
    calls.meDelete.mockResolvedValue(ok(null))
    const before = fetch.mock.calls.length
    await confirm()
    // Renovou (POST /auth/refresh) e só então pediu a exclusão
    expect(fetch.mock.calls.length).toBe(before + 1)
    expect(calls.meDelete).toHaveBeenCalledTimes(1)
  })

  it('outro erro: mensagem da API', async () => {
    calls.meDelete.mockResolvedValue(
      fail(429, 'muitas tentativas; tente de novo mais tarde')
    )
    const { session } = await signedIn()
    renderWithSession(<AccountScreen />, session)
    await confirm()
    expect(
      screen.getByText('muitas tentativas; tente de novo mais tarde')
    ).toBeTruthy()
  })
})
