import { act, fireEvent, screen, waitFor } from '@testing-library/react-native'
import { effectiveCreationConfig } from '@tms/sheet-core'
import { randomUUID } from 'expo-crypto'
import { useRouter } from 'expo-router'
import { AccessibilityInfo, Dimensions } from 'react-native'

import * as apiModule from '../../../lib/api'
import { type createFakeApi, ok } from '../../../test/fake-api'
import { modelOf, templateJson } from '../../../test/fixtures'
import {
  json,
  memoryStore,
  renderWithSession,
  testSession,
  tokens,
} from '../../../test/session'
import { SheetScreen } from '../../SheetScreen'

// A prioridade escolhida no próprio grupo (Físicos: 7 · 5 · 3) e a trava a
// cada toque: em Pontos básicos, o grupo cheio não aceita o próximo ponto;
// em Pontos de bônus, passa, pago com o saldo.

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
const ID = '00000000-0000-4000-8000-00000000c201'
const PHONE = { width: 390, height: 844, scale: 3, fontScale: 1 }
const TABLET = { width: 750, height: 1334, scale: 2, fontScale: 1 }

beforeEach(() => {
  jest
    .mocked(randomUUID)
    .mockReturnValue('00000000-0000-4000-8000-00000000b201')
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

const character = (
  priorities?: Record<string, string[]>,
  values: Record<string, unknown> = {}
) =>
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
      choices: priorities ? { priorities } : {},
      config: {},
      effective: effectiveCreationConfig(vtm),
      returned: null,
      approval: false,
    },
  })

async function open(
  priorities?: Record<string, string[]>,
  values?: Record<string, unknown>
) {
  calls.characterGet.mockResolvedValue(character(priorities, values))
  calls.templateGet.mockResolvedValue(ok(templateJson('vtm-v20')))
  const { session } = testSession(
    () => json(200, tokens()),
    memoryStore(true, 'r')
  )
  await session.restore()
  renderWithSession(<SheetScreen id={ID} initialMode="create" />, session)
  await screen.findByRole('tab', { name: 'Orçamento' })
}

const tab = (name: string) => fireEvent.press(screen.getByRole('tab', { name }))

const PRIORITIES = {
  attributes: ['physical', 'social', 'mental'],
  abilities: ['talents', 'skills', 'knowledges'],
}

// Todos os pontos básicos da V20 distribuídos, menos 1 de Vigor
const ALMOST = {
  strength: 4,
  dexterity: 3,
  stamina: 2,
  charisma: 3,
  manipulation: 3,
  appearance: 2,
  perception: 2,
  intelligence: 2,
  wits: 2,
  alertness: 3,
  athletics: 3,
  awareness: 3,
  brawl: 3,
  empathy: 1,
  animalKen: 3,
  crafts: 3,
  drive: 3,
  academics: 3,
  computer: 2,
  disciplines: [
    { id: 'd1', name: 'Taumaturgia', value: 2 },
    { id: 'd2', name: 'Auspícios', value: 1 },
  ],
  backgrounds: [
    { id: 'b1', name: 'Recursos', value: 3 },
    { id: 'b2', name: 'Mentor', value: 2 },
  ],
  conscience: 4,
  selfControl: 3,
  courage: 3,
}

const step = (name: string) =>
  fireEvent(screen.getByRole('adjustable', { name }), 'accessibilityAction', {
    nativeEvent: { actionName: 'increment' },
  })

describe('prioridades no grupo', () => {
  it('a escolha fica no bloco de Físicos, não no topo', async () => {
    calls.creationPatch.mockResolvedValue(ok({}))
    await open()
    expect(screen.queryByText('Prioridades: Atributos')).toBeNull()
    expect(screen.getByTestId('priority-attributes-physical')).toBeTruthy()
    await act(async () => {
      fireEvent.press(
        screen.getByRole('radio', { name: 'Físicos, Primária, 7 pontos' })
      )
    })
    expect(calls.creationPatch).toHaveBeenCalledWith(
      ID,
      expect.objectContaining({
        revision: 1,
        choices: {
          priorities: { attributes: ['physical', 'social', 'mental'] },
        },
      })
    )
  })

  it('com a prioridade escolhida, o bloco mostra a conta e a escolha marcada', async () => {
    await open({ attributes: ['physical', 'social', 'mental'] })
    expect(screen.getByTestId('counter-physical').props.children).toBe('0/7')
    expect(
      screen.getByRole('radio', { name: 'Físicos, Primária, 7 pontos' })
    ).toBeChecked()
    expect(
      screen.getByRole('radio', { name: 'Físicos, Secundária, 5 pontos' })
    ).not.toBeChecked()
  })
})

describe('prioridades na tela larga', () => {
  it('cada coluna de Atributos tem a própria escolha', async () => {
    Dimensions.set({ window: TABLET, screen: TABLET })
    await open({ attributes: ['mental', 'social', 'physical'] })
    expect(
      screen.getByRole('radio', { name: 'Mentais, Primária, 7 pontos' })
    ).toBeChecked()
    expect(
      screen.getByRole('radio', { name: 'Físicos, Terciária, 3 pontos' })
    ).toBeChecked()
    expect(screen.getByTestId('counter-social').props.children).toBe('0/5')
  })
})

describe('trava da distribuição', () => {
  it('em Pontos básicos, o grupo cheio trava; em Pontos de bônus, passa', async () => {
    await open({
      attributes: ['physical', 'social', 'mental'],
      abilities: ['talents', 'skills', 'knowledges'],
    })
    for (let i = 0; i < 3; i++) step('Força')
    for (let i = 0; i < 3; i++) step('Destreza')
    step('Vigor')
    expect(screen.getByTestId('counter-physical').props.children).toBe('7/7')

    step('Vigor')
    expect(
      screen.getByText(
        'Físicos: os 7 pontos básicos já foram usados. Para passar disso, use os pontos de bônus.'
      )
    ).toBeTruthy()
    expect(screen.getByTestId('counter-physical').props.children).toBe('7/7')

    tab('Orçamento')
    expect(screen.getByTestId('creation-panel')).toBeTruthy()
    fireEvent.press(screen.getByRole('radio', { name: 'Pontos de bônus' }))
    tab('Ficha')
    step('Vigor')
    expect(screen.getByTestId('counter-physical').props.children).toBe(
      '7/7 · +1 bônus'
    )
    tab('Orçamento')
    expect(screen.getByTestId('creation-freebies').props.children).toBe(
      'Bônus: 10 de 15 restantes.'
    )
  })
})

describe('aba Orçamento e botão único', () => {
  it('a conta fica na aba, e a barra tem um botão só', async () => {
    await open(PRIORITIES)
    expect(screen.queryByTestId('creation-panel')).toBeNull()
    expect(screen.queryByText('Concluir criação')).toBeNull()
    expect(screen.getByTestId('creation-action')).toHaveTextContent(
      'Salvar alterações'
    )
    tab('Orçamento')
    expect(screen.getByTestId('creation-problems')).toBeTruthy()
  })

  it('com a conta fechada, o botão conclui depois de salvar', async () => {
    // O servidor devolve a ficha aplicada, como a API
    calls.eventsPost.mockResolvedValue({
      ...ok({
        sheetVersion: 2,
        sheet: {
          values: { name: 'Nova', clan: 'tremere', ...ALMOST, stamina: 3 },
          specialties: {},
        },
      }),
      status: 200,
      response: {} as Response,
      headers: {},
    })
    calls.completePost.mockResolvedValue(ok({ status: 'active' }))
    await open(PRIORITIES, ALMOST)
    step('Vigor')
    fireEvent.press(screen.getByRole('button', { name: 'Entendi' }))
    expect(screen.getByTestId('creation-action')).toHaveTextContent(
      'Concluir criação'
    )
    fireEvent.press(screen.getByTestId('creation-action'))
    await act(async () => {
      fireEvent.press(screen.getByTestId('creation-confirm'))
    })
    expect(calls.eventsPost).toHaveBeenCalled()
    // Só depois que a fila confirma o lote
    await waitFor(() =>
      expect(calls.completePost).toHaveBeenCalledWith(
        ID,
        expect.objectContaining({ revision: 1, sheetVersion: 2 })
      )
    )
  })
})

describe('aviso dos pontos de bônus', () => {
  it('o último ponto básico abre o aviso e passa para os bônus', async () => {
    await open(PRIORITIES, ALMOST)
    expect(screen.queryByText('Começaram os pontos de bônus')).toBeNull()
    step('Vigor')
    expect(screen.getByText('Começaram os pontos de bônus')).toBeTruthy()
    fireEvent.press(screen.getByRole('button', { name: 'Ver orçamento' }))
    expect(screen.getByRole('radio', { name: 'Pontos de bônus' })).toBeChecked()
    // Em Bônus, o grupo cheio passa
    tab('Ficha')
    step('Vigor')
    expect(screen.getByTestId('counter-physical').props.children).toBe(
      '7/7 · +1 bônus'
    )
  })
})
