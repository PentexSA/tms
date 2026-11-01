import { screen, waitFor } from '@testing-library/react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Platform } from 'react-native'

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
import AppLayout from '../(app)/_layout'
import ChronicleScreen from '../(app)/chronicles/[id]/index'
import LoginScreen from '../(auth)/login'
import RegisterScreen from '../(auth)/register'

// Acessibilidade das telas do app (P06 da onda 1): um teste de regressão
// por bug.

jest.mock('../../lib/api', () => {
  const { createFakeApi } = require('../../test/fake-api')
  const fake = createFakeApi()
  return { ...jest.requireActual('../../lib/api'), api: fake.api, fake }
})
const calls = (
  apiModule as unknown as { fake: ReturnType<typeof createFakeApi> }
).fake.calls

const realOS = Platform.OS
afterEach(() =>
  Object.defineProperty(Platform, 'OS', { value: realOS, configurable: true })
)

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

const CHRONICLE_ID = '00000000-0000-4000-8000-0000000000c1'
// Só os elementos de host (o que vira nó no DOM)
const tabPanels = () =>
  screen
    .UNSAFE_queryAllByProps({ role: 'tabpanel' })
    .filter(el => typeof el.type === 'string')

async function chronicleOnWeb(role: 'storyteller' | 'former') {
  Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true })
  jest.mocked(useLocalSearchParams).mockReturnValue({ id: CHRONICLE_ID })
  calls.templateGet.mockImplementation(async (code: string) =>
    ok(templateJson(code))
  )
  calls.chronicle.get.mockResolvedValue(
    ok({
      id: CHRONICLE_ID,
      name: 'Crônica de teste',
      system: { code: 'vtm-v20', name: 'Vampiro: A Máscara', family: 'wod' },
      role,
      storyteller: { id: 'u1', username: 'ana' },
      members: [],
    })
  )
  calls.chronicle.charactersGet.mockResolvedValue(ok([]))
  const { session } = testSession(
    () => json(200, tokens()),
    memoryStore(true, 'r')
  )
  await session.restore()
  renderWithSession(<ChronicleScreen />, session)
  await screen.findByRole('header', { name: 'Crônica de teste' })
}

describe('Visão da crônica: painel só com as abas (T-35)', () => {
  it('narrador: o painel é nomeado por uma aba que existe', async () => {
    await chronicleOnWeb('storyteller')
    const panels = tabPanels()
    expect(panels).toHaveLength(1)
    const tab = screen.getByRole('tab', { name: 'Fichas' })
    expect(panels[0]?.props['aria-labelledby']).toBe(tab.props.nativeID)
  })

  it('ex-membro: sem abas, sem tabpanel (nada de aria-labelledby órfão)', async () => {
    await chronicleOnWeb('former')
    expect(screen.queryAllByRole('tab')).toHaveLength(0)
    expect(tabPanels()).toHaveLength(0)
  })
})
