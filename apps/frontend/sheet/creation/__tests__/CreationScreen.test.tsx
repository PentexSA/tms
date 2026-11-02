import {
  act,
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react-native'
import { effectiveCreationConfig } from '@tms/sheet-core'
import { randomUUID } from 'expo-crypto'
import { useRouter } from 'expo-router'
import { AccessibilityInfo, Dimensions, ScrollView } from 'react-native'

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

// No celular, as sub-abas ficam na faixa fixa e são as da seção no topo da
// tela (T-27): para as Habilidades, a ficha rola até elas
const layout = (testID: string, y: number, height = 400) =>
  fireEvent(screen.getByTestId(testID), 'layout', {
    nativeEvent: { layout: { x: 0, y, width: 390, height } },
  })
const scrollToAbilities = () => {
  layout('sheet-panel', 600)
  layout('sheet-nav', 500, 120)
  layout('section-attributes', 0)
  layout('section-abilities', 900)
  fireEvent.scroll(screen.UNSAFE_getAllByType(ScrollView)[0]!, {
    nativeEvent: { contentOffset: { x: 0, y: 1450 } },
  })
}

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
    // T-17: a prioridade é gravada na hora; os pontos, só no "Salvar".
    // R-28: e o aviso diz quais grupos foram marcados junto
    expect(
      await screen.findByText(
        'Prioridades salvas. Sociais ficou Secundária (5) e Mentais, Terciária (3): toque no grupo para trocar.'
      )
    ).toBeTruthy()
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
        'Físicos: os 7 pontos básicos já foram usados. Para passar disso, use os pontos de bônus (5 por ponto).'
      )
    ).toBeTruthy()
    expect(screen.getByTestId('counter-physical').props.children).toBe('7/7')

    tab('Orçamento')
    expect(screen.getByTestId('creation-panel')).toBeTruthy()
    fireEvent.press(screen.getByRole('radio', { name: 'Pontos de bônus' }))
    tab('Ficha')
    step('Vigor')
    // R-17: na fase de bônus, com o grupo cheio, o preço do próximo
    expect(screen.getByTestId('counter-physical').props.children).toBe(
      '7/7 · +1 bônus · +1 = 5 bônus'
    )
    tab('Orçamento')
    expect(screen.getByTestId('creation-freebies').props.children).toBe(
      'Bônus: restam 10 de 15.'
    )
  })
})

describe('o motivo certo da recusa (T-07)', () => {
  it('o 4º ponto em Prontidão diz o teto, e o contador continua 3/13', async () => {
    await open(PRIORITIES)
    scrollToAbilities()
    tab('Talentos')
    for (let i = 0; i < 3; i++) step('Prontidão')
    expect(screen.getByTestId('counter-talents').props.children).toBe('3/13')
    step('Prontidão')
    expect(
      screen.getByText(
        'Prontidão: com pontos básicos, vai até 3. Acima disso, cada ponto custa 2 de bônus.'
      )
    ).toBeTruthy()
    expect(screen.queryByText(/já foram usados/)).toBeNull()
    expect(screen.getByTestId('counter-talents').props.children).toBe('3/13')
  })
})

// T-20, T-55: o aviso fica ao lado do toque (na coluna do rótulo, na altura
// do "+"), um por ficha, e some quando a causa some
describe('aviso ao lado do toque', () => {
  it('Mentais 3/3: o aviso de Raciocínio fica na coluna do rótulo, e o próximo apaga o anterior', async () => {
    await open(PRIORITIES)
    tab('Mentais')
    for (let i = 0; i < 3; i++) step('Raciocínio')
    expect(screen.getByTestId('counter-mental').props.children).toBe('3/3')
    step('Raciocínio')
    // O rótulo e o aviso dividem a coluna, à esquerda do controle
    const column = screen.getByTestId('editor-wits-label')
    expect(within(column).getByText('Raciocínio')).toBeTruthy()
    expect(within(column).getByTestId('notice-wits')).toHaveTextContent(
      'Mentais: os 3 pontos básicos já foram usados. Para passar disso, use os pontos de bônus (5 por ponto).'
    )
    // "Ver orçamento" leva à aba da fase
    expect(screen.getByTestId('notice-wits-budget')).toBeTruthy()
    step('Inteligência')
    expect(screen.queryByTestId('notice-wits')).toBeNull()
    expect(screen.getByTestId('notice-intelligence')).toBeTruthy()
    fireEvent.press(screen.getByTestId('notice-intelligence-budget'))
    expect(screen.getByTestId('creation-panel')).toBeTruthy()
  })

  it('o aviso de "escolha a prioridade" some ao escolher a prioridade', async () => {
    calls.creationPatch.mockResolvedValue(ok({}))
    await open()
    step('Força')
    expect(screen.getByTestId('notice-strength')).toHaveTextContent(
      'Físicos: escolha a prioridade antes de distribuir os pontos.'
    )
    // O PATCH salva a escolha e a ficha rebuscada traz a ordem nova
    calls.characterGet.mockResolvedValue(
      character({ attributes: ['physical', 'social', 'mental'] })
    )
    await act(async () => {
      fireEvent.press(
        screen.getByRole('radio', { name: 'Físicos, Primária, 7 pontos' })
      )
    })
    await waitFor(() =>
      expect(screen.queryByTestId('notice-strength')).toBeNull()
    )
    // O ponto não entra sozinho
    expect(screen.getByTestId('counter-physical').props.children).toBe('0/7')
  })
})

// T-20, R-17: o "+" mostra a trava e o custo antes do toque
describe('"+" com a previsão da conta', () => {
  it('Mentais 3/3: o controle de Raciocínio diz a trava como dica, e o toque ainda chega', async () => {
    await open(PRIORITIES)
    tab('Mentais')
    for (let i = 0; i < 3; i++) step('Raciocínio')
    const wits = screen.getByRole('adjustable', { name: 'Raciocínio' })
    expect(wits.props.accessibilityHint).toBe(
      'Mentais: os 3 pontos básicos já foram usados. Para passar disso, use os pontos de bônus (5 por ponto).'
    )
    // Não é disabled: o toque chega à conta, que explica
    expect(wits.props['aria-disabled']).toBe(false)
    step('Raciocínio')
    expect(screen.getByTestId('notice-wits')).toBeTruthy()
  })

  it('Nosferatu: o "+" de Aparência trava, e o toque diz o porquê', async () => {
    await open(PRIORITIES, { clan: 'nosferatu' })
    tab('Sociais')
    expect(
      screen.getByRole('adjustable', { name: 'Aparência' }).props
        .accessibilityHint
    ).toBe('Fica em 0 na criação (Clã: Nosferatu).')
    step('Aparência')
    expect(screen.getByTestId('notice-appearance')).toHaveTextContent(
      'Aparência: fica em 0 na criação (Clã: Nosferatu).'
    )
  })

  it('a Força de Vontade diz o custo do próximo ponto na linha (R-17)', async () => {
    await open(PRIORITIES)
    // Na Criação, "Em jogo" começa recolhido (T-59)
    fireEvent.press(screen.getByRole('button', { name: 'Em jogo' }))
    expect(screen.getByTestId('advice-willpower')).toHaveTextContent(
      '+1 = 1 bônus'
    )
    expect(
      screen.getByRole('adjustable', { name: 'Força de Vontade permanente' })
        .props.accessibilityHint
    ).toBe('+1 = 1 bônus')
  })
})

// T-18: o saldo que sobra não se lê como gasto, e a conta fechada com bônus
// livres diz que eles ainda podem ser gastos
describe('bônus que sobram', () => {
  it('com os básicos completos e 15 livres, o Orçamento e a barra dizem o que resta', async () => {
    await open(PRIORITIES, { ...ALMOST, stamina: 3 })
    expect(screen.getByText(/Bônus: restam 15 de 15/)).toBeTruthy()
    tab('Orçamento')
    expect(screen.getByTestId('creation-ready')).toHaveTextContent(
      'Pontos básicos completos; restam 15 de bônus. Gaste-os nos grupos ou conclua pela barra de cima.'
    )
    expect(screen.getByTestId('creation-freebies').props.children).toBe(
      'Bônus: restam 15 de 15.'
    )
  })

  it('com o bônus zerado, a conta fechou', async () => {
    // 15 de bônus: 3 pontos de atributo acima dos básicos (5 cada)
    await open(PRIORITIES, { ...ALMOST, stamina: 3, strength: 5, dexterity: 5 })
    tab('Orçamento')
    expect(screen.getByTestId('creation-ready')).toHaveTextContent(
      'A conta fechou: conclua a criação pela barra de cima.'
    )
    expect(screen.getByTestId('creation-freebies').props.children).toBe(
      'Bônus: restam 0 de 15.'
    )
  })
})

describe('extrato do bônus (R-17)', () => {
  it('o Orçamento mostra onde foram os bônus, com o teto e a partida da FdV', async () => {
    await open(PRIORITIES, {
      ...ALMOST,
      stamina: 3,
      alertness: 4,
      willpower: { permanent: 4, current: 4 },
    })
    tab('Orçamento')
    const ledger = screen.getByTestId('creation-ledger')
    expect(ledger).toHaveTextContent(/Habilidades › Talentos: 1 × 2 = 2/)
    expect(ledger).toHaveTextContent(/Prontidão acima de 3: 1/)
    expect(ledger).toHaveTextContent(/Força de Vontade: 1 × 1 = 1/)
    expect(ledger).toHaveTextContent(/parte de 3, que vem de Coragem/)
    expect(screen.getByTestId('creation-ledger-total')).toHaveTextContent(
      'Gastos 3 · restam 12 de 15'
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

// T-32: a barra usa o mesmo texto do menu, escrito para quem lê
describe('confirmação da barra', () => {
  it('a dona lê "passa pelo narrador"; o narrador, "passa por você"', async () => {
    await open(PRIORITIES, { ...ALMOST, stamina: 3 })
    fireEvent.press(screen.getByTestId('creation-action'))
    // O corpo do T-32, e a sobra de bônus do T-18 numa linha à parte
    expect(
      screen.getByText(
        'A ficha entra em jogo. Depois disso, subir um traço passa pelo narrador. Não dá para voltar à criação.'
      )
    ).toBeTruthy()
    expect(screen.getByTestId('completion-message')).toHaveTextContent(
      /Sobram 15 pontos de bônus\. Eles não viram XP\.$/
    )
    cleanup()
    const mine = character(PRIORITIES, { ...ALMOST, stamina: 3 }) as {
      data: Record<string, unknown>
    }
    calls.characterGet.mockResolvedValue(
      ok({ ...mine.data, roles: ['storyteller'] })
    )
    const { session } = testSession(
      () => json(200, tokens()),
      memoryStore(true, 'r')
    )
    await session.restore()
    renderWithSession(<SheetScreen id={ID} initialMode="create" />, session)
    fireEvent.press(await screen.findByTestId('creation-action'))
    expect(screen.getByText('Concluir criação?')).toBeTruthy()
    expect(screen.getByTestId('completion-message')).toHaveTextContent(
      /passa por você/
    )
    expect(screen.getByTestId('completion-message')).not.toHaveTextContent(
      /pelo narrador/
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
    // R-17: na fase de bônus, com o grupo cheio, o preço do próximo
    expect(screen.getByTestId('counter-physical').props.children).toBe(
      '7/7 · +1 bônus · +1 = 5 bônus'
    )
  })
})

// T-32: "Aprovar ficha" confirma antes, com o mesmo texto do concluir
describe('aprovar ficha', () => {
  it('abre "Aprovar ficha?" sem chamar a API; confirmar aprova', async () => {
    // Enviada com a conta fechada e os 15 de bônus livres
    const pending = character(PRIORITIES, { ...ALMOST, stamina: 3 }) as {
      data: Record<string, unknown>
    }
    calls.characterGet.mockResolvedValue(
      ok({ ...pending.data, status: 'pending', roles: ['storyteller'] })
    )
    calls.templateGet.mockResolvedValue(ok(templateJson('vtm-v20')))
    calls.creationApprovePost.mockResolvedValue(ok({ status: 'active' }))
    const { session } = testSession(
      () => json(200, tokens()),
      memoryStore(true, 'r')
    )
    await session.restore()
    renderWithSession(<SheetScreen id={ID} />, session)
    fireEvent.press(await screen.findByTestId('creation-approve'))
    expect(screen.getByText('Aprovar ficha?')).toBeTruthy()
    expect(screen.getByTestId('completion-message')).toHaveTextContent(
      /passa por você/
    )
    // T-18: a sobra de bônus também ao aprovar (nenhum bônus gasto: 15)
    expect(
      screen.getByText('Sobram 15 pontos de bônus. Eles não viram XP.')
    ).toBeTruthy()
    expect(calls.creationApprovePost).not.toHaveBeenCalled()
    await act(async () => {
      fireEvent.press(screen.getByTestId('creation-approve-confirm'))
    })
    expect(calls.creationApprovePost).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('Ficha aprovada e liberada.')).toBeTruthy()
  })
})

// T-31 (nota do QA app às 15:51): o formulário de devolução reaparecia
// preenchido, porque o painel fica montado fora de `pending`
describe('devolver para correção', () => {
  it('depois de devolver, o formulário fecha e o motivo zera', async () => {
    const pending = character(PRIORITIES) as { data: Record<string, unknown> }
    calls.characterGet.mockResolvedValue(
      ok({ ...pending.data, status: 'pending', roles: ['storyteller'] })
    )
    calls.templateGet.mockResolvedValue(ok(templateJson('vtm-v20')))
    calls.creationReturnPost.mockResolvedValue(ok({}))
    const { session } = testSession(
      () => json(200, tokens()),
      memoryStore(true, 'r')
    )
    await session.restore()
    renderWithSession(<SheetScreen id={ID} />, session)
    fireEvent.press(await screen.findByTestId('creation-return-open'))
    fireEvent.changeText(
      screen.getByTestId('creation-return-reason'),
      'Falta o Clã'
    )
    await act(async () => {
      fireEvent.press(screen.getByTestId('creation-return'))
    })
    expect(calls.creationReturnPost).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('creation-return-reason')).toBeNull()
    fireEvent.press(screen.getByTestId('creation-return-open'))
    expect(screen.getByTestId('creation-return-reason').props.value).toBe('')
  })
})
