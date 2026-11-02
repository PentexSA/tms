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

interface Options {
  readonly system?: 'vtm-v20' | 'wta-w20' | 'mta-m20'
  readonly mode?: 'points' | 'free'
}

const character = (
  values: Record<string, unknown> = {},
  { system = 'vtm-v20', mode = 'points' }: Options = {}
) =>
  ok({
    id: ID,
    name: 'Nova',
    chronicle: { id: 'c1', name: 'Crônica da Liberdade' },
    owner: { id: 'u1', username: 'dona' },
    systemCode: system,
    templateVersion: '1.0.0',
    sheetVersion: 1,
    roles: ['owner'],
    status: 'creating',
    lockedAt: null,
    member: true,
    updatedAt: '2026-10-18T12:00:00Z',
    sheet: {
      values: {
        name: 'Nova',
        ...(system === 'vtm-v20' ? { clan: 'tremere' } : {}),
        ...values,
      },
      specialties: {},
    },
    creation: {
      revision: 1,
      mode,
      accounting: true,
      choices: { priorities: PRIORITIES },
      config: {},
      effective: effectiveCreationConfig(
        system === 'vtm-v20' ? vtm : modelOf(system)
      ),
      returned: null,
      approval: false,
    },
  })

async function open(values?: Record<string, unknown>, options: Options = {}) {
  calls.characterGet.mockResolvedValue(character(values, options))
  calls.templateGet.mockResolvedValue(
    ok(templateJson(options.system ?? 'vtm-v20'))
  )
  const { session } = testSession(
    () => json(200, tokens()),
    memoryStore(true, 'r')
  )
  await session.restore()
  const view = renderWithSession(
    <SheetScreen id={ID} initialMode="create" />,
    session
  )
  // A criação livre não tem a aba Orçamento
  fireEvent.press(await screen.findByRole('tab', { name: 'Vantagens' }))
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

// Três Disciplinas a 1: os 3 pontos básicos do grupo já usados
const THREE = {
  disciplines: [
    { id: 'd1', name: 'Taumaturgia', value: 1 },
    { id: 'd2', name: 'Auspícios', value: 1 },
    { id: 'd3', name: 'Dominação', value: 1 },
  ],
}
// 15 de bônus gastos em Qualidades (7 + 7 + 1): saldo zero
const SPENT = [
  { id: 'm1', name: 'Memória Eidética', meta: { cost: 7 } },
  { id: 'm2', name: 'Sono Leve', meta: { cost: 7 } },
  { id: 'm3', name: 'Senso de Direção', meta: { cost: 1 } },
]

const alertsIn = (testID: string) =>
  within(screen.getByTestId(testID)).queryAllByRole('alert')
const announced = () =>
  jest.mocked(AccessibilityInfo.announceForAccessibility).mock.calls.flat()

describe('T-19: a recusa aparece dentro da folha tocada', () => {
  it('4ª Disciplina em Pontos básicos: a frase fica embaixo da opção, e nada sobra na ficha ao fechar', async () => {
    await open(THREE)
    fireEvent.press(
      screen.getByRole('button', { name: 'Adicionar Disciplina' })
    )
    fireEvent.changeText(screen.getByLabelText('Buscar Disciplina'), 'ofusc')
    fireEvent.press(screen.getByRole('button', { name: 'Ofuscação' }))
    const sheet = alertsIn('add-sheet-disciplines')
    expect(sheet).toHaveLength(1)
    expect(sheet[0]).toHaveTextContent(/Disciplinas/)
    // Só a da folha: nenhuma frase embaixo da lista, atrás do modal
    expect(alertsIn('editor-disciplines')).toHaveLength(1)
    expect(announced()).toContain(sheet[0]?.props.children)
    // A opção continua lá, com a frase logo abaixo dela
    expect(screen.getByRole('button', { name: 'Ofuscação' })).toBeTruthy()

    fireEvent.press(screen.getByRole('button', { name: 'Fechar' }))
    expect(screen.queryByTestId('add-sheet-disciplines')).toBeNull()
    expect(alertsIn('editor-disciplines')).toHaveLength(0)
  })

  it('editor de Disciplina: + e Aplicar acima dos básicos avisa acima do Aplicar; o − apaga; com 1, Aplicar fecha', async () => {
    await open(THREE)
    fireEvent.press(screen.getByRole('button', { name: 'Dominação, 1 de 5' }))
    const stepper = { name: 'Dominação, valor' }
    fireEvent(screen.getByRole('adjustable', stepper), 'accessibilityAction', {
      nativeEvent: { actionName: 'increment' },
    })
    fireEvent.press(screen.getByRole('button', { name: 'Aplicar' }))
    expect(alertsIn('item-sheet-disciplines')).toHaveLength(1)
    expect(alertsIn('item-sheet-disciplines')[0]).toHaveTextContent(
      /Disciplinas/
    )
    fireEvent(screen.getByRole('adjustable', stepper), 'accessibilityAction', {
      nativeEvent: { actionName: 'decrement' },
    })
    expect(alertsIn('item-sheet-disciplines')).toHaveLength(0)
    fireEvent.press(screen.getByRole('button', { name: 'Aplicar' }))
    expect(screen.queryByTestId('item-sheet-disciplines')).toBeNull()
  })

  it('tirar o Defeito cujo crédito foi gasto: a frase aparece sob "Remover Inimigo?"', async () => {
    await open({
      merits: [...SPENT, { id: 'm4', name: 'Ambidestro', meta: { cost: 3 } }],
      flaws: [{ id: 'f1', name: 'Inimigo', meta: { bonus: 3 } }],
    })
    fireEvent.press(screen.getByRole('button', { name: 'Inimigo, Bônus 3' }))
    fireEvent.press(screen.getByRole('button', { name: 'Remover' }))
    fireEvent.press(screen.getByRole('button', { name: 'Remover' }))
    const sheet = within(screen.getByTestId('item-sheet-flaws'))
    expect(sheet.getByText('Remover Inimigo?')).toBeTruthy()
    expect(alertsIn('item-sheet-flaws')).toHaveLength(2)
    expect(alertsIn('item-sheet-flaws')[1]).toHaveTextContent(/bônus/i)
    // Cancelar a remoção apaga a frase; o Defeito continua na ficha
    fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }))
    expect(alertsIn('item-sheet-flaws')).toHaveLength(0)
    expect(
      within(screen.getByTestId('editor-flaws')).getByText('Bônus 3')
    ).toBeTruthy()
  })

  it('a recusa do Aplicar não aparece sob "Remover X?"', async () => {
    await open(THREE)
    fireEvent.press(screen.getByRole('button', { name: 'Dominação, 1 de 5' }))
    fireEvent(
      screen.getByRole('adjustable', { name: 'Dominação, valor' }),
      'accessibilityAction',
      { nativeEvent: { actionName: 'increment' } }
    )
    fireEvent.press(screen.getByRole('button', { name: 'Aplicar' }))
    expect(alertsIn('item-sheet-disciplines')).toHaveLength(1)
    fireEvent.press(screen.getByRole('button', { name: 'Remover' }))
    // Só o "Remover Dominação?"; nada da recusa anterior
    expect(alertsIn('item-sheet-disciplines')).toHaveLength(1)
    expect(alertsIn('item-sheet-disciplines')[0]).toHaveTextContent(
      'Remover Dominação?'
    )
  })

  it('recusa do texto livre mantém o nome digitado; mudar a busca apaga a frase', async () => {
    await open({ merits: SPENT })
    fireEvent.press(screen.getByRole('button', { name: 'Adicionar Qualidade' }))
    fireEvent.changeText(textInput('Nome'), 'Ambidestro')
    fireEvent.press(
      screen.getByRole('button', { name: 'Adicionar “Ambidestro”' })
    )
    expect(textInput('Nome').props.value).toBe('Ambidestro')
    expect(alertsIn('add-sheet-merits')).toHaveLength(1)
    expect(alertsIn('add-sheet-merits')[0]).toHaveTextContent(/bônus/i)
    fireEvent.changeText(textInput('Nome'), 'Ambidestra')
    expect(alertsIn('add-sheet-merits')).toHaveLength(0)
  })

  it('Enter recusado: a frase vai para o campo, e o nome fica (T-62)', async () => {
    await open(THREE)
    fireEvent.press(
      screen.getByRole('button', { name: 'Adicionar Disciplina' })
    )
    fireEvent.changeText(
      screen.getByLabelText('Buscar Disciplina'),
      'Ofuscação'
    )
    fireEvent(textInput('Buscar Disciplina'), 'submitEditing', {
      nativeEvent: { text: '' },
    })
    expect(textInput('Buscar Disciplina').props.value).toBe('Ofuscação')
    expect(alertsIn('add-sheet-disciplines')).toHaveLength(1)
    expect(alertsIn('add-sheet-disciplines')[0]).toHaveTextContent(
      /Disciplinas/
    )
  })
})

describe('T-58: um título e um contador por bloco, na criação', () => {
  it('V20 por pontos: "Disciplinas" uma vez, com a conta "0/3"', async () => {
    await open()
    const advantages = within(screen.getByTestId('groups-advantages'))
    expect(advantages.getAllByText('Disciplinas')).toHaveLength(1)
    expect(screen.getByTestId('counter-disciplines')).toHaveTextContent('0/3')
    expect(screen.queryByTestId('items-disciplines')).toBeNull()
    // Qualidades fora dos orçamentos: o contador é o da lista, com unidade
    expect(screen.getByTestId('items-merits')).toHaveTextContent('0 itens')
  })

  it('W20 por pontos: "Dons" uma vez, com "0/3"', async () => {
    await open({}, { system: 'wta-w20' })
    const gifts = within(screen.getByTestId('section-gifts'))
    expect(gifts.getAllByText('Dons')).toHaveLength(1)
    expect(gifts.getAllByText('0/3')).toHaveLength(1)
  })

  it('M20 por pontos: "7/7" uma vez nos Antecedentes', async () => {
    await open(
      {
        backgrounds: [
          { id: 'b1', name: 'Avatar', value: 3 },
          { id: 'b2', name: 'Biblioteca', value: 2 },
          { id: 'b3', name: 'Aliados', value: 2 },
        ],
      },
      { system: 'mta-m20' }
    )
    const backgrounds = within(screen.getByTestId('section-backgrounds'))
    expect(backgrounds.getAllByText('Antecedentes')).toHaveLength(1)
    expect(backgrounds.getAllByText('7/7')).toHaveLength(1)
  })

  it('criação livre: "3 itens" no lugar do número sem unidade', async () => {
    await open(THREE, { mode: 'free' })
    expect(screen.getByTestId('items-disciplines')).toHaveTextContent('3 itens')
    const advantages = within(screen.getByTestId('groups-advantages'))
    expect(advantages.queryByText('3')).toBeNull()
  })
})
