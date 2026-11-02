import { fireEvent, screen, within } from '@testing-library/react-native'
import { effectiveCreationConfig } from '@tms/sheet-core'
import { randomUUID } from 'expo-crypto'
import { useRouter } from 'expo-router'
import { AccessibilityInfo, Dimensions } from 'react-native'

import * as apiModule from '../../../lib/api'
import { type createFakeApi, ok } from '../../../test/fake-api'
import { modelOf, templateJson } from '../../../test/fixtures'
import { textInput } from '../../../test/queries'
import {
  json,
  memoryStore,
  renderWithSession,
  testSession,
  tokens,
} from '../../../test/session'
import { SheetScreen } from '../../SheetScreen'

// P07-C: as folhas das Vantagens na criação por pontos (V20, 390 px). A
// recusa da conta aparece dentro da folha tocada, e o item nasce com o
// valor que o editor mostra. A frase em si é do P05-C: os testes buscam o
// papel `alert` e o rótulo do grupo, nunca a frase inteira.

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(),
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Medium: 'medium' },
  NotificationFeedbackType: { Warning: 'warning' },
}))
jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(),
  getRandomValues: jest.fn(),
}))
jest.mock('../../../lib/api', () => {
  const { createFakeApi } = require('../../../test/fake-api')
  const fake = createFakeApi()
  return { ...jest.requireActual('../../../lib/api'), api: fake.api, fake }
})
const calls = (
  apiModule as unknown as { fake: ReturnType<typeof createFakeApi> }
).fake.calls

const vtm = modelOf('vtm-v20')
const ID = '00000000-0000-4000-8000-00000000c207'
const PHONE = { width: 390, height: 844, scale: 3, fontScale: 1 }
const TABLET = { width: 750, height: 1334, scale: 2, fontScale: 1 }

beforeEach(() => {
  jest
    .mocked(randomUUID)
    .mockReturnValue('00000000-0000-4000-8000-00000000b207')
  Dimensions.set({ window: PHONE, screen: PHONE })
  jest
    .spyOn(AccessibilityInfo, 'announceForAccessibility')
    .mockImplementation(() => undefined)
  jest
    .mocked(useRouter)
    .mockReturnValue({ push: jest.fn(), replace: jest.fn() } as never)
})
afterEach(() => {
  Dimensions.set({ window: TABLET, screen: TABLET })
})

const PRIORITIES = {
  attributes: ['physical', 'social', 'mental'],
  abilities: ['talents', 'skills', 'knowledges'],
}

const character = (values: Record<string, unknown> = {}) =>
  ok({
    id: ID,
    name: 'Nova',
    chronicle: { id: 'c1', name: 'Crônica da Liberdade' },
    owner: { id: 'u1', username: 'dona' },
    systemCode: 'vtm-v20',
    templateVersion: '1.0.0',
    sheetVersion: 1,
    roles: ['owner'],
    status: 'creating',
    lockedAt: null,
    member: true,
    updatedAt: '2026-10-18T12:00:00Z',
    sheet: {
      values: { name: 'Nova', clan: 'tremere', ...values },
      specialties: {},
    },
    creation: {
      revision: 1,
      mode: 'points',
      accounting: true,
      choices: { priorities: PRIORITIES },
      config: {},
      effective: effectiveCreationConfig(vtm),
      returned: null,
      approval: false,
    },
  })

async function open(values?: Record<string, unknown>) {
  calls.characterGet.mockResolvedValue(character(values))
  calls.templateGet.mockResolvedValue(ok(templateJson('vtm-v20')))
  const { session } = testSession(
    () => json(200, tokens()),
    memoryStore(true, 'r')
  )
  await session.restore()
  const view = renderWithSession(
    <SheetScreen id={ID} initialMode="create" />,
    session
  )
  await screen.findByRole('tab', { name: 'Orçamento' })
  fireEvent.press(screen.getByRole('tab', { name: 'Vantagens' }))
  return view
}

const tab = (name: string) => fireEvent.press(screen.getByRole('tab', { name }))

describe('T-23: o Defeito vale o que a folha mostra', () => {
  it('Defeito novo nasce com Bônus 1, e o saldo passa a 16 de 16', async () => {
    await open()
    fireEvent.press(screen.getByRole('button', { name: 'Adicionar Defeito' }))
    fireEvent.changeText(textInput('Nome'), 'Inimigo')
    fireEvent.press(screen.getByRole('button', { name: 'Adicionar “Inimigo”' }))
    expect(
      within(screen.getByTestId('editor-flaws')).getByText('Bônus 1')
    ).toBeTruthy()
    tab('Orçamento')
    // O crédito do Defeito entra no saldo (15 + 1), nada gasto
    expect(screen.getByTestId('creation-freebies')).toHaveTextContent(
      /\b16 de 16\b/
    )
  })

  it('Qualidade nasce com Custo 1, paga com bônus (D-06 pela regra do template)', async () => {
    await open()
    fireEvent.press(screen.getByRole('button', { name: 'Adicionar Qualidade' }))
    fireEvent.changeText(textInput('Nome'), 'Ambidestro')
    fireEvent.press(
      screen.getByRole('button', { name: 'Adicionar “Ambidestro”' })
    )
    const merits = within(screen.getByTestId('editor-merits'))
    expect(merits.getByText('Custo 1')).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: 'Adicionar “Ambidestro”' })
    ).toBeNull()
    tab('Orçamento')
    expect(screen.getByTestId('creation-freebies')).toHaveTextContent(
      /\b14 de 15\b/
    )
  })
})
