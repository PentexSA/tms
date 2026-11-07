import {
  act,
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react-native'
import { effectiveCreationConfig } from '@tms/sheet-core'
import { Stepper } from '@tms/ui'
import { randomUUID } from 'expo-crypto'
import { useRouter } from 'expo-router'
import {
  AccessibilityInfo,
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native'
import * as apiModule from '../../../lib/api'
import { type createFakeApi, ok } from '../../../test/fake-api'
import { modelOf, templateJson } from '../../../test/fixtures'
import { sheetsDismissed, summarySave } from '../../../test/queries'
import {
  json,
  memoryStore,
  renderWithSession,
  testSession,
  tokens,
} from '../../../test/session'
import { SheetScreen } from '../../SheetScreen'
import { resetBonusSeenMemory } from '../bonusSeen'
import * as guideModule from '../guide'
import { CREATION_HELP } from '../help'

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
  // A marca da folha de bônus é da sessão: cada teste começa sem ela
  resetBonusSeenMemory()
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
      adjust: null,
      ready: null,
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
  await screen.findByRole('tab', { name: 'Pontos' })
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

// R-19 (P10-D §3.7): "Prioridade" e "pontos de bônus" são nomes do app para
// as regras do motor; a frase vem do app, não do template.
describe('o "?" da Prioridade e dos pontos de bônus (R-19)', () => {
  it('"Prioridade" tem "Ajuda: Prioridade", com a frase genérica', async () => {
    await open()
    const help = screen.getByTestId('priority-help-physical')
    expect(help.props.accessibilityLabel).toBe('Ajuda: Prioridade')
    expect(screen.queryByText(CREATION_HELP.priority.text)).toBeNull()
    fireEvent.press(help)
    expect(screen.getByText(CREATION_HELP.priority.text)).toBeTruthy()
    // A frase não diz número: os valores vêm do template
    expect(CREATION_HELP.priority.text).not.toMatch(/\d/)
  })

  it('o saldo dos pontos de bônus tem "Ajuda: pontos de bônus"', async () => {
    await open(PRIORITIES, { ...ALMOST, stamina: 3 })
    tab('Pontos')
    fireEvent.press(
      screen.getByRole('button', { name: 'Ajuda: pontos de bônus' })
    )
    expect(screen.getByText(CREATION_HELP.freebies.text)).toBeTruthy()
    expect(screen.getByTestId('creation-freebies').props.children).toBe(
      'Bônus: restam 15 de 15.'
    )
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

    tab('Pontos')
    expect(screen.getByTestId('creation-panel')).toBeTruthy()
    fireEvent.press(
      screen.getByRole('button', { name: 'Usar pontos de bônus agora' })
    )
    tab('Ficha')
    step('Vigor')
    // R-17: na fase de bônus, com o grupo cheio, o preço do próximo
    expect(screen.getByTestId('counter-physical').props.children).toBe(
      '7/7 · +1 bônus · +1 = 5 bônus'
    )
    tab('Pontos')
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
    // "Ver Pontos" leva à aba da fase
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

// T-85: o "−" no valor inicial tem a cara de indisponível, continua
// tocável, e o toque diz de onde vem o inicial sem descer
describe('"−" no valor inicial', () => {
  it('FdV na Coragem 3: a dica junta os dois lados, e o "−" não desce', async () => {
    await open(PRIORITIES, { courage: 3 })
    fireEvent.press(screen.getByRole('button', { name: 'Em jogo' }))
    const control = () =>
      screen.getByRole('adjustable', { name: 'Força de Vontade permanente' })
    expect(control().props.accessibilityHint).toBe(
      'Aumentar: +1 = 1 bônus. Diminuir: Na criação, não fica abaixo de 3 (vem de Coragem).'
    )
    fireEvent(control(), 'accessibilityAction', {
      nativeEvent: { actionName: 'decrement' },
    })
    expect(screen.getByTestId('notice-willpower')).toHaveTextContent(
      'Força de Vontade: na criação, não fica abaixo de 3 (vem de Coragem).'
    )
    expect(control()).toHaveAccessibilityValue({ now: 3 })
    // Comprar 1 e voltar deixa o "−" livre no 4 e zera o contador
    step('Força de Vontade permanente')
    expect(control()).toHaveAccessibilityValue({ now: 4 })
    expect(control().props.accessibilityHint).toBe('+1 = 1 bônus')
    fireEvent(control(), 'accessibilityAction', {
      nativeEvent: { actionName: 'decrement' },
    })
    expect(control()).toHaveAccessibilityValue({ now: 3 })
    expect(screen.getByText(/0 alterações/)).toBeTruthy()
  })
})

// Achados 3 e 6 do /code-review (P10-C): acima do inicial, segurar o "−"
// para no inicial; no web, o "−" bloqueado aponta a própria descrição, e o
// aviso do "−" não vira a descrição do "+"
describe('"−" no valor inicial: segurar e descrição', () => {
  const realOS = Platform.OS
  const setOS = (os: string) =>
    Object.defineProperty(Platform, 'OS', { value: os, configurable: true })
  afterEach(() => setOS(realOS))

  it('no app, o "−" acima do inicial leva o stop do inicial', async () => {
    await open(PRIORITIES, {
      courage: 3,
      willpower: { permanent: 6, current: 6 },
    })
    fireEvent.press(screen.getByRole('button', { name: 'Em jogo' }))
    const steppers = screen.UNSAFE_getAllByType(Stepper)
    const row = steppers.find(
      x => x.props.label === 'Força de Vontade permanente'
    )
    expect(row?.props.decrease).toMatchObject({ blocked: false, stop: 3 })
  })

  it('no web, o "−" bloqueado sem aviso aponta a descrição dele', async () => {
    setOS('web')
    await open(PRIORITIES, { courage: 3 })
    fireEvent.press(screen.getByRole('button', { name: 'Em jogo' }))
    const less = () =>
      screen.getByRole('button', {
        name: 'Diminuir Força de Vontade permanente',
      })
    const more = () =>
      screen.getByRole('button', {
        name: 'Aumentar Força de Vontade permanente',
      })
    expect(less().props['aria-describedby']).toBe('advice-down-willpower')
    expect(
      screen.getByTestId('advice-down-willpower', {
        includeHiddenElements: true,
      })
    ).toHaveTextContent('Na criação, não fica abaixo de 3 (vem de Coragem).')
    // O toque recusado abre o aviso do "−": ele passa a descrevê-lo, e o
    // "+" não aponta o aviso que não é dele
    fireEvent.press(less())
    expect(screen.getByTestId('notice-willpower')).toBeTruthy()
    expect(less().props['aria-describedby']).toBe('notice-willpower')
    expect(more().props['aria-describedby']).not.toBe('notice-willpower')
  })
})

// T-18: o saldo que sobra não se lê como gasto, e a conta fechada com bônus
// livres diz que eles ainda podem ser gastos
describe('bônus que sobram', () => {
  it('com os básicos completos e 15 livres, a aba Pontos e a barra dizem o que resta', async () => {
    await open(PRIORITIES, { ...ALMOST, stamina: 3 })
    expect(screen.getByText(/Bônus: restam 15 de 15/)).toBeTruthy()
    tab('Pontos')
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
    tab('Pontos')
    expect(screen.getByTestId('creation-ready')).toHaveTextContent(
      'A conta fechou: conclua a criação pela barra de cima.'
    )
    expect(screen.getByTestId('creation-freebies').props.children).toBe(
      'Bônus: restam 0 de 15.'
    )
  })
})

// P09-D (D-10, POA-20): em `pending`, o narrador confere a conta em
// Leitura; a frase da conta fechada aponta o aviso do topo, não a barra
describe('a aba Pontos do narrador em pending', () => {
  const review = async (values: Record<string, unknown>) => {
    const sent = character(PRIORITIES, values) as {
      data: Record<string, unknown>
    }
    calls.characterGet.mockResolvedValue(
      ok({ ...sent.data, roles: ['storyteller'], status: 'pending' })
    )
    calls.templateGet.mockResolvedValue(ok(templateJson('vtm-v20')))
    const { session } = testSession(
      () => json(200, tokens()),
      memoryStore(true, 'r')
    )
    await session.restore()
    renderWithSession(<SheetScreen id={ID} />, session)
    fireEvent.press(await screen.findByRole('button', { name: 'Ver Pontos' }))
  }

  it('conta fechada sem sobra: "A conta fechou. Confira a ficha…"', async () => {
    await review({ ...ALMOST, stamina: 3, strength: 5, dexterity: 5 })
    expect(screen.getByRole('tab', { name: 'Pontos' })).toBeSelected()
    expect(screen.getByTestId('creation-ready')).toHaveTextContent(
      'A conta fechou. Confira a ficha e aprove ou devolva pelo aviso no topo.'
    )
  })

  it('com bônus sobrando: o que resta, e o mesmo próximo passo', async () => {
    await review({ ...ALMOST, stamina: 3 })
    expect(screen.getByTestId('creation-ready')).toHaveTextContent(
      'Pontos básicos completos; restam 15 de bônus. Confira a ficha e aprove ou devolva pelo aviso no topo.'
    )
  })
})

describe('extrato do bônus (R-17)', () => {
  it('a aba Pontos mostra onde foram os bônus, com o teto e a partida da FdV', async () => {
    await open(PRIORITIES, {
      ...ALMOST,
      stamina: 3,
      alertness: 4,
      willpower: { permanent: 4, current: 4 },
    })
    tab('Pontos')
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

describe('aba Pontos; Salvar sempre', () => {
  it('a conta fica na aba; antes de fechar, a barra só tem "Salvar"', async () => {
    await open(PRIORITIES)
    expect(screen.queryByTestId('creation-panel')).toBeNull()
    expect(screen.queryByText('Concluir criação')).toBeNull()
    expect(screen.queryByTestId('creation-action')).toBeNull()
    expect(screen.getByTestId('mode-save')).toHaveTextContent(/^Salvar$/)
    tab('Pontos')
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

// P03-D (T-04, D-01): salvar o progresso sem concluir, em qualquer fase
describe('Salvar e Concluir lado a lado (D-01)', () => {
  const saved = () =>
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
  const withApproval = (roles: string[] = ['owner']) => {
    const c = character(PRIORITIES, ALMOST) as {
      data: Record<string, unknown> & { creation: Record<string, unknown> }
    }
    return ok({
      ...c.data,
      roles,
      creation: { ...c.data.creation, approval: true },
    })
  }
  const openWith = async (body: unknown) => {
    calls.characterGet.mockResolvedValue(body)
    calls.templateGet.mockResolvedValue(ok(templateJson('vtm-v20')))
    const { session } = testSession(
      () => json(200, tokens()),
      memoryStore(true, 'r')
    )
    await session.restore()
    renderWithSession(<SheetScreen id={ID} initialMode="create" />, session)
    await screen.findByRole('tab', { name: 'Pontos' })
  }

  it('antes de a conta fechar: "Salvar" (nome "Salvar alterações"), sem ação seguinte', async () => {
    await open(PRIORITIES)
    const save = screen.getByRole('button', { name: 'Salvar alterações' })
    expect(save).toHaveTextContent(/^Salvar$/)
    expect(save.props.testID).toBe('mode-save')
    // Sem alterações, desabilitado
    expect(save).toBeDisabled()
    expect(screen.queryByTestId('creation-action')).toBeNull()
  })

  it('com a conta fechada, "Salvar" grava e fica em Criação, sem concluir', async () => {
    saved()
    await open(PRIORITIES, ALMOST)
    step('Vigor')
    fireEvent.press(screen.getByRole('button', { name: 'Entendi' }))
    expect(screen.getByTestId('mode-save')).toHaveTextContent(/^Salvar$/)
    expect(screen.getByTestId('mode-save')).toBeEnabled()
    expect(screen.getByTestId('creation-action')).toHaveTextContent(
      'Concluir criação'
    )
    fireEvent.press(screen.getByRole('button', { name: 'Salvar alterações' }))
    expect(screen.getByText('Salvar 1 alteração?')).toBeTruthy()
    await act(async () => {
      fireEvent.press(summarySave())
    })
    await waitFor(() => expect(calls.eventsPost).toHaveBeenCalledTimes(1))
    expect(calls.completePost).not.toHaveBeenCalled()
    expect(screen.getByRole('radio', { name: 'Criação' })).toBeChecked()
    // A conclusão continua ao lado, e o "Salvar" volta a esperar alterações
    expect(screen.getByTestId('creation-action')).toHaveTextContent(
      'Concluir criação'
    )
    expect(screen.getByTestId('mode-save')).toBeDisabled()
  })

  it('com a aprovação ligada, "Enviar para aprovação" ao lado; salvar não envia', async () => {
    saved()
    await openWith(withApproval())
    step('Vigor')
    fireEvent.press(screen.getByRole('button', { name: 'Entendi' }))
    expect(screen.getByTestId('creation-action')).toHaveTextContent(
      'Enviar para aprovação'
    )
    fireEvent.press(screen.getByTestId('mode-save'))
    await act(async () => {
      fireEvent.press(summarySave())
    })
    await waitFor(() => expect(calls.eventsPost).toHaveBeenCalledTimes(1))
    expect(calls.completePost).not.toHaveBeenCalled()
    expect(screen.getByRole('radio', { name: 'Criação' })).toBeChecked()
  })

  it('o narrador, com a aprovação ligada, vê "Concluir e aprovar" ao lado de "Salvar"', async () => {
    await openWith(withApproval(['storyteller']))
    step('Vigor')
    fireEvent.press(screen.getByRole('button', { name: 'Entendi' }))
    expect(screen.getByTestId('creation-action')).toHaveTextContent(
      'Concluir e aprovar'
    )
    expect(screen.getByTestId('mode-save')).toHaveTextContent(/^Salvar$/)
  })
})

// D-01: com duas ações, a barra fica em duas linhas no celular (o texto em
// cima, as ações embaixo, numa linha que quebra); fora dele, numa linha só
describe('barra de Criação em duas linhas (D-01)', () => {
  const at = (width: number, fontScale = 1) =>
    act(() => {
      const size = { width, height: 844, scale: 3, fontScale }
      Dimensions.set({ window: size, screen: size })
    })
  const style = (testID: string) =>
    StyleSheet.flatten(screen.getByTestId(testID).props.style)

  it('a 360 e a 393, o texto em cima e "Salvar" e "Concluir criação" numa linha embaixo', async () => {
    await open(PRIORITIES, { ...ALMOST, stamina: 3 })
    for (const width of [360, 393]) {
      at(width)
      expect(style('mode-bar').flexDirection).toBeUndefined()
      const actions = screen.getByTestId('mode-bar-actions')
      expect(StyleSheet.flatten(actions.props.style)).toMatchObject({
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'flex-end',
      })
      // "Salvar" e depois a ação seguinte (a principal à direita)
      expect(
        within(actions)
          .getAllByRole('button')
          .map(b => b.props.testID)
      ).toEqual(['mode-save', 'creation-action'])
    }
  })

  it('a 1280, numa linha: o texto e as duas ações à direita', async () => {
    await open(PRIORITIES, { ...ALMOST, stamina: 3 })
    at(1280)
    expect(screen.queryByTestId('mode-bar-actions')).toBeNull()
    expect(style('mode-bar').flexDirection).toBe('row')
    expect(screen.getByTestId('creation-action')).toBeTruthy()
    expect(screen.getByTestId('mode-save')).toBeTruthy()
  })

  it('com fonte de 130%, duas linhas também na tela larga', async () => {
    await open(PRIORITIES, { ...ALMOST, stamina: 3 })
    at(1280, 1.3)
    expect(screen.getByTestId('mode-bar-actions')).toBeTruthy()
  })

  // P04-D (D-03): a linha do próximo passo é o `note`; no celular, com ela,
  // a barra fica em duas linhas mesmo só com "Salvar" (onda-3 §4.1)
  it('só "Salvar" (a conta aberta): com o próximo passo, duas linhas no celular', async () => {
    await open(PRIORITIES)
    at(390)
    expect(screen.getByTestId('next-step')).toHaveTextContent(
      'Você conclui quando a conta fechar.'
    )
    const actions = screen.getByTestId('mode-bar-actions')
    // O "Faltam" (P05-D) ocupa o lugar do "Concluir", antes do "Salvar"
    expect(
      within(actions)
        .getAllByRole('button')
        .map(b => b.props.testID)
    ).toEqual(['creation-guide-0', 'creation-guide-more', 'mode-save'])
    // A tela larga continua numa linha
    at(1280)
    expect(screen.queryByTestId('mode-bar-actions')).toBeNull()
    expect(style('mode-bar').flexDirection).toBe('row')
  })

  it('Editar da criação livre: "Salvar" (nome "Salvar alterações") e "Avisar que terminei" numa linha embaixo', async () => {
    const free = character(PRIORITIES) as {
      data: Record<string, unknown> & { creation: Record<string, unknown> }
    }
    calls.characterGet.mockResolvedValue(
      ok({ ...free.data, creation: { ...free.data.creation, mode: 'free' } })
    )
    calls.templateGet.mockResolvedValue(ok(templateJson('vtm-v20')))
    const { session } = testSession(
      () => json(200, tokens()),
      memoryStore(true, 'r')
    )
    await session.restore()
    renderWithSession(<SheetScreen id={ID} />, session)
    await screen.findByTestId('creation-ready')
    at(360)
    const actions = screen.getByTestId('mode-bar-actions')
    expect(
      within(actions)
        .getAllByRole('button')
        .map(b => b.props.testID)
    ).toEqual(['mode-save', 'creation-ready'])
    const save = screen.getByTestId('mode-save')
    expect(save).toHaveTextContent('Salvar')
    expect(save).not.toHaveTextContent('Salvar alterações')
    expect(save.props.accessibilityLabel).toBe('Salvar alterações')
  })
})

// P05-D (D-05, R-18): o "Faltam: …" na barra, ao lado do "Salvar", com os
// itens que levam ao grupo; com a conta fechada, ele sai e o "Concluir" entra
describe('"Faltam" na barra (R-18)', () => {
  const guide = () => within(screen.getByTestId('creation-guide'))
  // Só faltam as Virtudes
  const VIRTUES = {
    ...ALMOST,
    stamina: 3,
    conscience: 1,
    selfControl: 1,
    courage: 1,
  }

  it('com a conta aberta: "Faltam:" e os itens como botões, antes do "Salvar"', async () => {
    await open(PRIORITIES)
    expect(guide().getByText('Faltam:')).toBeTruthy()
    // A 390 (264 dp no slot): o primeiro item inteiro e o "e mais N"
    expect(
      screen.getByRole('button', {
        name: 'Físicos 7: Físicos: faltam 7 pontos básicos.',
      })
    ).toHaveTextContent('Físicos 7')
    expect(
      screen.getByRole('button', {
        name: 'e mais 8: ver tudo o que falta em Pontos',
      })
    ).toBeTruthy()
    expect(screen.queryByTestId('creation-action')).toBeNull()
  })

  it('no começo, nem o primeiro cabe: um botão só, que leva à aba', async () => {
    await open()
    expect(guide().queryByText('Faltam:')).toBeNull()
    expect(guide().getByRole('button')).toHaveTextContent('Faltam 5 itens')
    fireEvent.press(guide().getByRole('button'))
    expect(screen.getByRole('tab', { name: 'Pontos' })).toBeSelected()
    expect(screen.getByTestId('creation-problems')).toBeTruthy()
  })

  it('tocar "Virtudes 7" leva à aba Vantagens e rola até a seção', async () => {
    await open(PRIORITIES, VIRTUES)
    expect(guide().getByText('Falta:')).toBeTruthy()
    const scrollView = screen.UNSAFE_getAllByType(ScrollView)[0]!.instance as {
      scrollTo: (o: object) => void
    }
    const scrollTo = jest.spyOn(scrollView, 'scrollTo')
    layout('sheet-panel', 600)
    layout('sheet-nav', 500, 120)
    fireEvent.press(
      screen.getByRole('button', {
        name: 'Virtudes 7: Virtudes: faltam 7 pontos básicos.',
      })
    )
    expect(screen.getByRole('tab', { name: 'Vantagens' })).toBeSelected()
    // A seção nova é medida depois da troca de aba: o pedido espera por ela
    layout('section-advantages', 300)
    await waitFor(() =>
      expect(scrollTo).toHaveBeenCalledWith({
        y: 600 + 300 - 120,
        animated: true,
      })
    )
  })

  // /code-review 5: o leitor de tela do app só vai a um elemento de
  // acessibilidade; o alvo do foco é o próprio título, não o contêiner
  it('o alvo do foco é o título (header) da seção e do grupo', async () => {
    await open(PRIORITIES, VIRTUES)
    tab('Vantagens')
    const group = screen.getByRole('header', { name: 'Virtudes' })
    expect(group.props.nativeID).toBe('anchor-advantages-virtues')
    tab('Ficha')
    const section = screen.getByRole('header', { name: 'Habilidades' })
    expect(section.props.nativeID).toBe('anchor-abilities')
  })

  // /code-review 7: a lista só é montada de novo quando a conta muda
  it('mudar o que não é a conta não remonta a lista do guia', async () => {
    await open(PRIORITIES)
    tab('Pontos')
    const spy = jest.spyOn(guideModule, 'guideItems')
    fireEvent.press(
      screen.getByRole('button', { name: 'Usar pontos de bônus agora' })
    )
    expect(screen.getByTestId('creation-phase')).toHaveTextContent(
      'Fase: pontos de bônus'
    )
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('fechar a conta tira o "Faltam" e mostra o "Concluir"', async () => {
    await open(PRIORITIES, ALMOST)
    expect(screen.getByTestId('creation-guide')).toBeTruthy()
    step('Vigor')
    fireEvent.press(screen.getByRole('button', { name: 'Entendi' }))
    expect(screen.queryByTestId('creation-guide')).toBeNull()
    expect(screen.getByTestId('creation-action')).toHaveTextContent(
      'Concluir criação'
    )
  })

  // Achado 3 do onda-3 §11: a linha do próximo passo muda com o botão
  it('fechar a conta muda a linha do próximo passo, e o anúncio sai uma vez', async () => {
    await open(PRIORITIES, { ...ALMOST, stamina: 3, conscience: 3 })
    expect(screen.getByTestId('next-step')).toHaveTextContent(
      'Você conclui quando a conta fechar.'
    )
    const announce = jest.mocked(AccessibilityInfo.announceForAccessibility)
    tab('Vantagens')
    announce.mockClear()
    step('Consciência')
    expect(screen.getByTestId('next-step')).toHaveTextContent(
      'A conta fechou: você conclui.'
    )
    expect(screen.getByTestId('creation-action')).toBeTruthy()
    // Os básicos fecharam na mesma passagem: só a folha anuncia
    expect(announce.mock.calls).toEqual([
      ['Pontos básicos distribuídos. Agora os pontos gastam bônus.'],
    ])
    fireEvent.press(screen.getByRole('button', { name: 'Entendi' }))
    // Abrir e fechar a conta de novo, sem a folha: o anúncio da conta
    fireEvent(
      screen.getByRole('adjustable', { name: 'Consciência' }),
      'accessibilityAction',
      { nativeEvent: { actionName: 'decrement' } }
    )
    expect(screen.getByTestId('next-step')).toHaveTextContent(
      'Você conclui quando a conta fechar.'
    )
    announce.mockClear()
    step('Consciência')
    expect(announce.mock.calls).toEqual([
      ['A conta fechou. Você pode concluir pela barra.'],
    ])
  })

  // /code-review 3: com a aprovação, o anúncio diz enviar, como o botão
  it('com a aprovação, o anúncio da conta fechada diz enviar ao narrador', async () => {
    const c = character(PRIORITIES, {
      ...ALMOST,
      stamina: 3,
      conscience: 3,
    }) as {
      data: Record<string, unknown> & { creation: Record<string, unknown> }
    }
    calls.characterGet.mockResolvedValue(
      ok({ ...c.data, creation: { ...c.data.creation, approval: true } })
    )
    calls.templateGet.mockResolvedValue(ok(templateJson('vtm-v20')))
    const { session } = testSession(
      () => json(200, tokens()),
      memoryStore(true, 'r')
    )
    await session.restore()
    renderWithSession(<SheetScreen id={ID} initialMode="create" />, session)
    await screen.findByRole('tab', { name: 'Pontos' })
    tab('Vantagens')
    step('Consciência')
    fireEvent.press(screen.getByRole('button', { name: 'Entendi' }))
    fireEvent(
      screen.getByRole('adjustable', { name: 'Consciência' }),
      'accessibilityAction',
      { nativeEvent: { actionName: 'decrement' } }
    )
    const announce = jest.mocked(AccessibilityInfo.announceForAccessibility)
    announce.mockClear()
    step('Consciência')
    expect(announce.mock.calls).toEqual([
      ['A conta fechou. Você pode enviar ao narrador pela barra.'],
    ])
    expect(screen.getByTestId('next-step')).toHaveTextContent(
      'A conta fechou: envie ao narrador.'
    )
  })

  it('na criação livre (Editar), nada de "Faltam"', async () => {
    const free = character(PRIORITIES) as {
      data: Record<string, unknown> & { creation: Record<string, unknown> }
    }
    calls.characterGet.mockResolvedValue(
      ok({ ...free.data, creation: { ...free.data.creation, mode: 'free' } })
    )
    calls.templateGet.mockResolvedValue(ok(templateJson('vtm-v20')))
    const { session } = testSession(
      () => json(200, tokens()),
      memoryStore(true, 'r')
    )
    await session.restore()
    renderWithSession(<SheetScreen id={ID} />, session)
    await screen.findByTestId('creation-ready')
    expect(screen.queryByTestId('creation-guide')).toBeNull()
  })
})

// P05-D (R-18): a aba "Pontos" e o "O que falta" tocável; o "confirme com o
// narrador" (o ponto de extensão do P07-D) separado do que falta
describe('aba Pontos (R-18)', () => {
  afterEach(() => jest.restoreAllMocks())

  it('a aba se chama "Pontos"; o "O que falta" tem um botão por item, que leva ao grupo', async () => {
    await open(PRIORITIES)
    tab('Pontos')
    const list = within(screen.getByTestId('creation-problems'))
    expect(list.getByRole('header', { name: 'O que falta' })).toBeTruthy()
    const items = list.getAllByRole('button')
    // Sem o corte em 12: os 9 grupos do V20
    expect(items).toHaveLength(9)
    expect(items[0]).toHaveTextContent('Físicos: faltam 7 pontos básicos.')
    const virtues = list.getByRole('button', {
      name: 'Virtudes: faltam 7 pontos básicos.',
    })
    fireEvent.press(virtues)
    expect(screen.getByRole('tab', { name: 'Vantagens' })).toBeSelected()
  })

  // /code-review 1: uma zona sem aba (a identidade) não tem âncora; o toque
  // leva à lista inteira, em vez de um pedido que nunca se resolve
  it('alvo numa zona sem aba vai à lista do "O que falta"', async () => {
    const notice: guideModule.GuideItem = {
      key: 'confirm:identity',
      kind: 'confirm',
      short: 'Clã',
      text: 'Confirme com o narrador: o clã.',
      target: {
        tab: 'identity',
        section: 'about-facts',
        group: null,
        path: 'values.clan',
      },
    }
    jest.spyOn(guideModule, 'useCreationNotices').mockReturnValue([notice])
    await open(PRIORITIES)
    tab('Pontos')
    const scrollView = screen.UNSAFE_getAllByType(ScrollView)[0]!.instance as {
      scrollTo: (o: object) => void
    }
    const scrollTo = jest.spyOn(scrollView, 'scrollTo')
    layout('sheet-panel', 600)
    layout('sheet-nav', 500, 120)
    layout('creation-panel', 0)
    fireEvent.press(
      within(screen.getByTestId('creation-notices')).getByRole('button')
    )
    expect(screen.getByRole('tab', { name: 'Pontos' })).toBeSelected()
    await waitFor(() =>
      expect(scrollTo).toHaveBeenCalledWith({ y: 480, animated: true })
    )
  })

  it('o "confirme com o narrador" fica na aba e na confirmação, nunca no "Faltam"', async () => {
    const notice: guideModule.GuideItem = {
      key: 'confirm:gift',
      kind: 'confirm',
      short: 'Dom',
      text: 'Confirme com o narrador: um Dom acima do Posto 1.',
      target: null,
    }
    jest.spyOn(guideModule, 'useCreationNotices').mockReturnValue([notice])
    await open(PRIORITIES, { ...ALMOST, stamina: 3 })
    // A conta fechada: o aviso não esconde o "Concluir" nem entra no "Faltam"
    expect(screen.queryByTestId('creation-guide')).toBeNull()
    expect(screen.getByTestId('creation-action')).toBeTruthy()
    tab('Pontos')
    const block = within(screen.getByTestId('creation-notices'))
    expect(
      block.getByRole('header', { name: 'Para confirmar com o narrador' })
    ).toBeTruthy()
    expect(block.getByRole('button')).toHaveTextContent(
      'Confirme com o narrador: um Dom acima do Posto 1.'
    )
    fireEvent.press(screen.getByTestId('creation-action'))
    expect(
      screen.getByText('1 item para confirmar com o narrador; veja em Pontos.')
    ).toBeTruthy()
  })
})

// P05-D (U-07): a fase em texto, com a troca manual como ação secundária
describe('fase da conta em texto (U-07)', () => {
  it('"Fase: pontos básicos", sem rádio; a troca manual vai e volta', async () => {
    await open(PRIORITIES)
    tab('Pontos')
    const panel = within(screen.getByTestId('creation-panel'))
    expect(panel.getByTestId('creation-phase')).toHaveTextContent(
      'Fase: pontos básicos'
    )
    expect(panel.queryAllByRole('radio')).toHaveLength(0)
    fireEvent.press(
      panel.getByRole('button', { name: 'Usar pontos de bônus agora' })
    )
    expect(panel.getByTestId('creation-phase')).toHaveTextContent(
      'Fase: pontos de bônus'
    )
    // Com os básicos faltando, dá para voltar
    fireEvent.press(
      panel.getByRole('button', { name: 'Voltar aos pontos básicos' })
    )
    expect(panel.getByTestId('creation-phase')).toHaveTextContent(
      'Fase: pontos básicos'
    )
  })

  it('com os básicos fechados, a fase é a dos bônus, sem a volta', async () => {
    await open(PRIORITIES, ALMOST)
    step('Vigor')
    fireEvent.press(screen.getByRole('button', { name: 'Entendi' }))
    tab('Pontos')
    expect(screen.getByTestId('creation-phase')).toHaveTextContent(
      'Fase: pontos de bônus'
    )
    expect(screen.queryByTestId('creation-phase-switch')).toBeNull()
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
    fireEvent.press(screen.getByRole('button', { name: 'Ver Pontos' }))
    // A aba troca depois que a folha sai (onClosed), não no toque
    expect(screen.queryByTestId('creation-phase')).toBeNull()
    await sheetsDismissed()
    expect(screen.getByRole('tab', { name: 'Pontos' })).toBeSelected()
    expect(screen.getByTestId('creation-phase')).toHaveTextContent(
      'Fase: pontos de bônus'
    )
    // Em Bônus, o grupo cheio passa
    tab('Ficha')
    step('Vigor')
    // R-17: na fase de bônus, com o grupo cheio, o preço do próximo
    expect(screen.getByTestId('counter-physical').props.children).toBe(
      '7/7 · +1 bônus · +1 = 5 bônus'
    )
  })
})

// P05-D (U-07): a folha só na primeira passagem de cada ficha
describe('folha de bônus uma vez (U-07)', () => {
  const OTHER = '00000000-0000-4000-8000-00000000c202'
  const decrement = (name: string) =>
    fireEvent(screen.getByRole('adjustable', { name }), 'accessibilityAction', {
      nativeEvent: { actionName: 'decrement' },
    })

  it('tirar e repor não reabre, nem numa tela nova da mesma ficha; outra ficha abre', async () => {
    await open(PRIORITIES, ALMOST)
    step('Vigor')
    fireEvent.press(screen.getByRole('button', { name: 'Entendi' }))
    decrement('Vigor')
    step('Vigor')
    expect(screen.queryByText('Começaram os pontos de bônus')).toBeNull()
    // Outra tela da mesma ficha: outro store, a mesma marca
    cleanup()
    await open(PRIORITIES, ALMOST)
    step('Vigor')
    expect(screen.queryByText('Começaram os pontos de bônus')).toBeNull()
    // Outra ficha: a folha abre
    cleanup()
    const c = character(PRIORITIES, ALMOST) as {
      data: Record<string, unknown>
    }
    calls.characterGet.mockResolvedValue(ok({ ...c.data, id: OTHER }))
    calls.templateGet.mockResolvedValue(ok(templateJson('vtm-v20')))
    const { session } = testSession(
      () => json(200, tokens()),
      memoryStore(true, 'r')
    )
    await session.restore()
    renderWithSession(<SheetScreen id={OTHER} initialMode="create" />, session)
    await screen.findByRole('tab', { name: 'Pontos' })
    step('Vigor')
    expect(screen.getByText('Começaram os pontos de bônus')).toBeTruthy()
  })

  it('com bônus já gasto, a passagem não abre a folha (o caso do PO-A)', async () => {
    // A Força de Vontade 2 acima da Coragem: 2 pontos de bônus gastos
    await open(PRIORITIES, {
      ...ALMOST,
      willpower: { permanent: 5, current: 5 },
    })
    step('Vigor')
    expect(screen.getByTestId('creation-action')).toBeTruthy()
    expect(screen.queryByText('Começaram os pontos de bônus')).toBeNull()
  })

  it('quem trocou a fase à mão já sabe dos bônus: sem folha', async () => {
    await open(PRIORITIES, ALMOST)
    tab('Pontos')
    fireEvent.press(
      screen.getByRole('button', { name: 'Usar pontos de bônus agora' })
    )
    tab('Ficha')
    step('Vigor')
    expect(screen.queryByText('Começaram os pontos de bônus')).toBeNull()
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

// P04-D (D-04, R-14): o pedido de ajuste do narrador aparece como a
// devolução, em qualquer modo; só um banner por vez
describe('ajuste pedido', () => {
  const ADJUST = {
    reason: 'Refaça os Antecedentes',
    at: '2026-11-02T10:00:00Z',
  }
  const asked = (roles: string[], over: Record<string, unknown> = {}) => {
    const base = character(PRIORITIES) as {
      data: Record<string, unknown> & { creation: Record<string, unknown> }
    }
    return ok({
      ...base.data,
      roles,
      creation: { ...base.data.creation, adjust: ADJUST, ...over },
    })
  }
  const render = async (roles: string[], over?: Record<string, unknown>) => {
    calls.characterGet.mockResolvedValue(asked(roles, over))
    calls.templateGet.mockResolvedValue(ok(templateJson('vtm-v20')))
    const { session } = testSession(
      () => json(200, tokens()),
      memoryStore(true, 'r')
    )
    await session.restore()
    renderWithSession(<SheetScreen id={ID} />, session)
  }

  it('a dona vê "O narrador pediu um ajuste" com o motivo, também em Jogo', async () => {
    await render(['owner'])
    const banner = await screen.findByTestId('creation-adjust')
    expect(banner.props.accessibilityLabel).toBe(
      'O narrador pediu um ajuste. Refaça os Antecedentes'
    )
    expect(screen.getByTestId('sheet-state')).toHaveTextContent(
      'Aguardando ajuste'
    )
    fireEvent.press(screen.getByRole('radio', { name: 'Jogo' }))
    expect(screen.getByTestId('creation-adjust')).toBeTruthy()
  })

  it('o narrador vê "Você pediu um ajuste"', async () => {
    await render(['storyteller'])
    expect(
      (await screen.findByTestId('creation-adjust')).props.accessibilityLabel
    ).toBe('Você pediu um ajuste. Refaça os Antecedentes')
  })

  it('só um banner por vez: o pedido vence a devolução', async () => {
    await render(['owner'], {
      returned: { reason: 'Antiga', at: '2026-10-20T00:00:00Z' },
    })
    expect(await screen.findByTestId('creation-adjust')).toBeTruthy()
    expect(screen.queryByTestId('creation-returned')).toBeNull()
  })
})

// P04-D (D-03, R-13): a barra diz o próximo passo; na criação livre, a dona
// avisa que terminou
describe('próximo passo e "Avisar que terminei"', () => {
  const render = async (
    creation: Record<string, unknown>,
    roles = ['owner']
  ) => {
    const base = character(PRIORITIES) as {
      data: Record<string, unknown> & { creation: Record<string, unknown> }
    }
    calls.characterGet.mockResolvedValue(
      ok({
        ...base.data,
        roles,
        creation: { ...base.data.creation, ...creation },
      })
    )
    calls.templateGet.mockResolvedValue(ok(templateJson('vtm-v20')))
    const { session } = testSession(
      () => json(200, tokens()),
      memoryStore(true, 'r')
    )
    await session.restore()
    renderWithSession(<SheetScreen id={ID} />, session)
  }

  it('por pontos, a dona lê que conclui quando a conta fechar', async () => {
    await open(PRIORITIES)
    expect(screen.getByTestId('next-step')).toHaveTextContent(
      'Você conclui quando a conta fechar.'
    )
    expect(screen.queryByTestId('creation-ready')).toBeNull()
  })

  it('livre: a linha e o botão; com 1 alteração, salva, espera a fila e só então avisa', async () => {
    calls.eventsPost.mockResolvedValue({
      ...ok({
        sheetVersion: 2,
        sheet: {
          values: { name: 'Nova', clan: 'tremere', strength: 2 },
          specialties: {},
        },
      }),
      status: 200,
      response: {} as Response,
      headers: {},
    })
    calls.creationReadyPost.mockResolvedValue(ok({ revision: 2 }))
    await render({ mode: 'free' })
    // A ficha livre da dona abre no Editar (T-05)
    expect(await screen.findByTestId('next-step')).toHaveTextContent(
      'Quando terminar, avise: o narrador conclui.'
    )
    const button = screen.getByTestId('creation-ready')
    expect(button).toHaveTextContent('Avisar que terminei')
    expect(button).toBeEnabled()
    step('Força')
    fireEvent.press(screen.getByTestId('creation-ready'))
    expect(screen.getByText('Avisar que terminei?')).toBeTruthy()
    expect(screen.getByTestId('completion-message')).toHaveTextContent(
      'O narrador vê na Mesa que você terminou e conclui a criação. Até lá, você ainda pode editar. As alterações abaixo são salvas antes.'
    )
    await act(async () => {
      fireEvent.press(screen.getByTestId('creation-ready-confirm'))
    })
    await waitFor(() =>
      expect(calls.creationReadyPost).toHaveBeenCalledWith(
        ID,
        expect.objectContaining({ revision: 1 })
      )
    )
    // O lote sai antes do aviso
    expect(calls.eventsPost.mock.invocationCallOrder[0]).toBeLessThan(
      calls.creationReadyPost.mock.invocationCallOrder[0]!
    )
    expect(
      await screen.findByText('Pronto: o narrador foi avisado.')
    ).toBeTruthy()
  })

  it('depois de avisar: sem o botão, e a linha muda', async () => {
    await render({ mode: 'free', ready: { at: '2026-11-02T10:00:00Z' } })
    expect(await screen.findByTestId('next-step')).toHaveTextContent(
      'Você avisou. O narrador conclui a criação.'
    )
    expect(screen.queryByTestId('creation-ready')).toBeNull()
    expect(screen.getByTestId('sheet-state')).toHaveTextContent(
      'Você avisou que terminou'
    )
  })

  it('um 409 diz que a ficha mudou', async () => {
    calls.creationReadyPost.mockResolvedValue({
      data: null,
      error: {
        status: 409,
        value: {
          error: 'a configuração da criação mudou',
          code: 'CREATION_REVISION_CONFLICT',
        },
      },
    })
    await render({ mode: 'free' })
    fireEvent.press(await screen.findByTestId('creation-ready'))
    await act(async () => {
      fireEvent.press(screen.getByTestId('creation-ready-confirm'))
    })
    expect(
      await screen.findByText(
        'A ficha mudou desde que você abriu. Confira e avise de novo.'
      )
    ).toBeTruthy()
  })
})
