import { act, fireEvent, screen } from '@testing-library/react-native'
import { KeyboardArea, tokens as uiTokens } from '@tms/ui'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { StyleSheet, TextInput } from 'react-native'

import * as apiModule from '../../lib/api'
import { type createFakeApi, ok } from '../../test/fake-api'
import { templateJson } from '../../test/fixtures'
import {
  json,
  memoryStore,
  renderWithSession,
  testSession,
  tokens,
} from '../../test/session'
import ChronicleScreen from '../(app)/chronicles/[id]/index'
import NewCharacterScreen from '../(app)/chronicles/[id]/new-character'
import NewChronicleScreen from '../(app)/chronicles/new'
import JoinScreen from '../(app)/join'
import LoginScreen from '../(auth)/login'
import RegisterScreen from '../(auth)/register'

// P08 (onda 2), T-26: as telas com formulário encolhem acima do teclado
// também no Android (KeyboardArea), e o "Próximo" do teclado encadeia os
// campos. Só a senha envia o login; no cadastro, a senha envia.

jest.mock('../../lib/api', () => {
  const { createFakeApi } = require('../../test/fake-api')
  const fake = createFakeApi()
  return { ...jest.requireActual('../../lib/api'), api: fake.api, fake }
})
jest.mock('expo-crypto', () => ({
  randomUUID: () => require('node:crypto').randomUUID(),
}))

const calls = (
  apiModule as unknown as { fake: ReturnType<typeof createFakeApi> }
).fake.calls
const router = { push: jest.fn(), replace: jest.fn(), back: jest.fn() }
const CHRONICLE = '00000000-0000-4000-8000-0000000000c1'
const VTM = { code: 'vtm-v20', name: 'Vampiro: A Máscara', family: 'wod' }

beforeEach(() => {
  jest.mocked(useRouter).mockReturnValue(router as never)
  jest.mocked(useLocalSearchParams).mockReturnValue({ id: CHRONICLE })
})

async function signedIn() {
  const { session } = testSession(
    () => json(200, tokens()),
    memoryStore(true, 'r')
  )
  await session.restore()
  return session
}

/**
 * Quem recebeu focus(): o mock do TextInput compartilha um jest.fn entre as
 * instâncias, então a prova é o `this` de cada chamada.
 */
function focusSpy() {
  const inputs = screen.UNSAFE_getAllByType(TextInput)
  const instance = (testID: string) => {
    const found = inputs.find(el => el.props.testID === testID)?.instance
    if (!found) throw new Error(`sem campo ${testID}`)
    return found as { focus: () => void }
  }
  const spy = jest.spyOn(instance(inputs[0]!.props.testID), 'focus')
  spy.mockClear()
  return {
    focused: () =>
      spy.mock.contexts.map(
        c => inputs.find(el => el.instance === c)?.props.testID
      ),
    instance,
  }
}

describe('T-26: as telas com formulário usam o KeyboardArea', () => {
  it('login e cadastro', () => {
    const { session } = testSession(() => json(200, tokens()))
    renderWithSession(<LoginScreen />, session)
    expect(screen.UNSAFE_getAllByType(KeyboardArea)).toHaveLength(1)
    screen.unmount()
    renderWithSession(<RegisterScreen />, session)
    expect(screen.UNSAFE_getAllByType(KeyboardArea)).toHaveLength(1)
  })

  it('entrar com convite e nova crônica', async () => {
    renderWithSession(<JoinScreen />, await signedIn())
    expect(screen.UNSAFE_getAllByType(KeyboardArea)).toHaveLength(1)
    screen.unmount()
    calls.systemsGet.mockResolvedValue(ok([VTM]))
    renderWithSession(<NewChronicleScreen />, await signedIn())
    await screen.findByRole('radio', { name: VTM.name })
    expect(screen.UNSAFE_getAllByType(KeyboardArea)).toHaveLength(1)
  })

  it('nova ficha', async () => {
    calls.chronicle.get.mockResolvedValue(
      ok({
        id: CHRONICLE,
        name: 'Crônica da Liberdade',
        system: VTM,
        role: 'player',
        storyteller: { id: 'u1', username: 'ana' },
        members: [],
      })
    )
    calls.templateGet.mockResolvedValue(ok(templateJson('vtm-v20')))
    renderWithSession(<NewCharacterScreen />, await signedIn())
    await screen.findByTestId('editor-name')
    expect(screen.UNSAFE_getAllByType(KeyboardArea)).toHaveLength(1)
  })
})

describe('T-26: "Próximo" entre os campos', () => {
  it('login: Enter no e-mail vai à senha, sem enviar; a senha envia', async () => {
    const { session, fetch } = testSession(() => json(200, tokens()))
    renderWithSession(<LoginScreen />, session)
    const email = screen.getByTestId('login-email')
    expect(email.props.returnKeyType).toBe('next')
    expect(email.props.submitBehavior).toBe('submit')
    const focus = focusSpy()
    fireEvent.changeText(email, 'ana@example.test')
    fireEvent(email, 'submitEditing')
    expect(focus.focused()).toEqual(['login-password'])
    expect(fetch).not.toHaveBeenCalled()

    fireEvent.changeText(screen.getByTestId('login-password'), 'senha longa')
    await act(async () => {
      fireEvent(screen.getByTestId('login-password'), 'submitEditing')
    })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('cadastro: e-mail → usuário → senha; a senha envia', async () => {
    const { session, fetch } = testSession(() => json(200, tokens()))
    renderWithSession(<RegisterScreen />, session)
    const focus = focusSpy()
    fireEvent(screen.getByTestId('register-email'), 'submitEditing')
    expect(focus.focused()).toEqual(['register-username'])
    fireEvent(screen.getByTestId('register-username'), 'submitEditing')
    expect(focus.focused()).toEqual(['register-username', 'register-password'])

    const password = screen.getByTestId('register-password')
    expect(password.props.returnKeyType).toBe('go')
    // Vazio: a validação do cliente segura, sem chamar a API
    await act(async () => {
      fireEvent(password, 'submitEditing')
    })
    expect(fetch).not.toHaveBeenCalled()
    expect(screen.getByText('Informe um e-mail válido.')).toBeTruthy()
  })
})

describe('T-67: "Participantes" e o "Convidar" com a margem da página', () => {
  it('o título fica num invólucro com o recuo da página', async () => {
    calls.templateGet.mockResolvedValue(ok(templateJson('vtm-v20')))
    calls.chronicle.get.mockResolvedValue(
      ok({
        id: CHRONICLE,
        name: 'Crônica da Liberdade',
        system: VTM,
        role: 'storyteller',
        storyteller: { id: 'u1', username: 'ana' },
        members: [],
      })
    )
    calls.chronicle.charactersGet.mockResolvedValue(ok([]))
    renderWithSession(<ChronicleScreen />, await signedIn())
    expect(
      await screen.findByRole('header', { name: 'Participantes' })
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Convidar' })).toBeTruthy()
    expect(
      StyleSheet.flatten(screen.getByTestId('members-header').props.style)
        .paddingHorizontal
    ).toBe(uiTokens.layout.gutter)
  })
})
