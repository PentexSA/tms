import { fireEvent, screen, within } from '@testing-library/react-native'
import { effectiveCreationConfig } from '@tms/sheet-core'
import { randomUUID } from 'expo-crypto'
import { useRouter } from 'expo-router'
import { AccessibilityInfo, Dimensions } from 'react-native'

import * as apiModule from '../../../lib/api'
import { type createFakeApi, ok } from '../../../test/fake-api'
import {
  GIFTS,
  modelOf,
  templateJson,
  templateWithIdentity,
  templateWithoutMeritCatalog,
} from '../../../test/fixtures'
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
  // O template com `recommend` e `creation.advice` de teste (P07-D)
  readonly identity?: boolean
  // Sem o catálogo de Qualidades e Defeitos (P17, N-07): o mecanismo da
  // lista sem catálogo (campo "Nome", texto livre, o mínimo do meta)
  readonly plain?: boolean
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
  const system = options.system ?? 'vtm-v20'
  calls.templateGet.mockResolvedValue(
    ok(
      options.identity
        ? templateWithIdentity(system)
        : options.plain
          ? templateWithoutMeritCatalog(system)
          : templateJson(system)
    )
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
  // A criação livre não tem a aba Pontos
  fireEvent.press(await screen.findByRole('tab', { name: 'Vantagens' }))
  return view
}

const tab = (name: string) => fireEvent.press(screen.getByRole('tab', { name }))

describe('T-23: o Defeito vale o que a folha mostra', () => {
  it('Defeito novo nasce com Bônus 1, e o saldo passa a 16 de 16', async () => {
    await open({}, { plain: true })
    fireEvent.press(screen.getByRole('button', { name: 'Adicionar Defeito' }))
    fireEvent.changeText(textInput('Nome'), 'Inimigo')
    fireEvent.press(screen.getByRole('button', { name: 'Adicionar “Inimigo”' }))
    // P17 (N-08): nome sem custo no catálogo pede o custo; o mínimo fica
    fireEvent.press(screen.getByTestId('add-cost-confirm'))
    expect(
      within(screen.getByTestId('editor-flaws')).getByText('Bônus 1')
    ).toBeTruthy()
    tab('Pontos')
    // O crédito do Defeito entra no saldo (15 + 1), nada gasto
    expect(screen.getByTestId('creation-freebies')).toHaveTextContent(
      /\b16 de 16\b/
    )
  })

  it('Qualidade nasce com Custo 1, paga com bônus (D-06 pela regra do template)', async () => {
    await open({}, { plain: true })
    fireEvent.press(screen.getByRole('button', { name: 'Adicionar Qualidade' }))
    fireEvent.changeText(textInput('Nome'), 'Ambidestro')
    fireEvent.press(
      screen.getByRole('button', { name: 'Adicionar “Ambidestro”' })
    )
    // P17 (N-08): nome sem custo no catálogo pede o custo; o mínimo fica
    fireEvent.press(screen.getByTestId('add-cost-confirm'))
    const merits = within(screen.getByTestId('editor-merits'))
    expect(merits.getByText('Custo 1')).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: 'Adicionar “Ambidestro”' })
    ).toBeNull()
    tab('Pontos')
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

const step = (name: string) =>
  fireEvent(screen.getByRole('adjustable', { name }), 'accessibilityAction', {
    nativeEvent: { actionName: 'increment' },
  })
const alertsIn = (testID: string) =>
  within(screen.getByTestId(testID)).queryAllByRole('alert')

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
    // É o aviso do store (R-20), com o id que o leitor de tela anuncia
    expect(
      within(screen.getByTestId('add-sheet-disciplines')).getByTestId(
        'notice-disciplines'
      )
    ).toBeTruthy()
    // A opção continua lá, com a frase logo abaixo dela
    expect(screen.getByRole('button', { name: 'Ofuscação' })).toBeTruthy()

    fireEvent.press(screen.getByRole('button', { name: 'Fechar' }))
    expect(screen.queryByTestId('add-sheet-disciplines')).toBeNull()
    expect(alertsIn('editor-disciplines')).toHaveLength(0)
    // Fechar apaga o aviso do store: a folha do item não o herda
    fireEvent.press(
      screen.getByRole('button', { name: 'Dominação, 1 de 5, do clã' })
    )
    expect(alertsIn('item-sheet-disciplines')).toHaveLength(0)
  })

  it('R-25: o "+" da linha acima dos básicos avisa sob a linha tocada, sem folha; o "−" apaga', async () => {
    await open(THREE)
    const row = (id: string) => `item-disciplines-${id}`
    step('Dominação')
    // Nenhuma folha abre: o aviso fica na linha tocada, não nas outras
    expect(screen.queryByTestId('item-sheet-disciplines')).toBeNull()
    expect(alertsIn(row('d3'))).toHaveLength(1)
    expect(alertsIn(row('d3'))[0]).toHaveTextContent(/Disciplinas/)
    expect(
      within(screen.getByTestId(row('d3'))).getByTestId('notice-disciplines-d3')
    ).toBeTruthy()
    expect(alertsIn(row('d1'))).toHaveLength(0)
    expect(alertsIn(row('d2'))).toHaveLength(0)
    // O valor não mudou; o "−" é aceito e apaga o aviso
    expect(
      screen.getByRole('button', { name: 'Dominação, 1 de 5, do clã' })
    ).toBeTruthy()
    fireEvent(
      screen.getByRole('adjustable', { name: 'Dominação' }),
      'accessibilityAction',
      { nativeEvent: { actionName: 'decrement' } }
    )
    expect(alertsIn(row('d3'))).toHaveLength(0)
    expect(
      screen.getByRole('button', { name: 'Dominação, 0 de 5, do clã' })
    ).toBeTruthy()
  })

  it('a recusa do −/+ da linha não vai para a folha do item', async () => {
    await open(THREE)
    step('Dominação')
    expect(alertsIn('item-disciplines-d3')).toHaveLength(1)
    fireEvent.press(
      screen.getByRole('button', { name: 'Dominação, 1 de 5, do clã' })
    )
    expect(alertsIn('item-sheet-disciplines')).toHaveLength(0)
    expect(alertsIn('item-disciplines-d3')).toHaveLength(0)
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

  it('o "+" da linha avisa antes do toque e continua tocável (R-20)', async () => {
    await open(THREE)
    const stepper = () => screen.getByRole('adjustable', { name: 'Dominação' })
    // Grupo cheio em Pontos básicos: o motivo antes do toque, na dica
    expect(stepper().props.accessibilityHint).toMatch(/Disciplinas/)
    // O cabeçalho do grupo já diz "3/3": a linha não repete o motivo
    expect(screen.queryByTestId('advice-disciplines-d3')).toBeNull()
    // Outra Disciplina, a mesma previsão (a conta é do grupo)
    expect(
      screen.getByRole('adjustable', { name: 'Taumaturgia' }).props
        .accessibilityHint
    ).toMatch(/Disciplinas/)
  })

  it('item sem Valor (Dons do W20): nenhuma previsão de "+" na folha', async () => {
    await open(
      {
        gifts: [
          { id: 'g1', name: 'Pulo', meta: { rank: 1 } },
          { id: 'g2', name: 'Faro', meta: { rank: 1 } },
          { id: 'g3', name: 'Uivo', meta: { rank: 1 } },
        ],
      },
      { system: 'wta-w20' }
    )
    fireEvent.press(screen.getByRole('button', { name: /^Pulo/ }))
    expect(screen.getByTestId('item-sheet-gifts')).toBeTruthy()
    expect(screen.queryByTestId('advice-gifts-g1')).toBeNull()
  })

  it('fechar a folha não apaga o aviso de outra linha da ficha', async () => {
    await open({ strength: 4, dexterity: 3, stamina: 3 })
    tab('Ficha')
    step('Vigor')
    expect(screen.getByTestId('notice-stamina')).toBeTruthy()
    tab('Vantagens')
    fireEvent.press(
      screen.getByRole('button', { name: 'Adicionar Disciplina' })
    )
    fireEvent.press(screen.getByRole('button', { name: 'Fechar' }))
    tab('Ficha')
    expect(screen.getByTestId('notice-stamina')).toBeTruthy()
  })

  it('com saldo, o "+" da linha mostra o custo em bônus', async () => {
    await open(THREE)
    tab('Pontos')
    fireEvent.press(
      screen.getByRole('button', { name: 'Usar pontos de bônus agora' })
    )
    tab('Ficha')
    fireEvent.press(screen.getByRole('tab', { name: 'Vantagens' }))
    expect(
      screen.getByRole('adjustable', { name: 'Dominação' }).props
        .accessibilityHint
    ).toMatch(/bônus/)
    // Pago com bônus, o ponto entra pela linha
    step('Dominação')
    expect(
      screen.getByRole('button', { name: 'Dominação, 2 de 5, do clã' })
    ).toBeTruthy()
  })

  it('a recusa do Aplicar não aparece sob "Remover X?"', async () => {
    await open({ merits: SPENT })
    fireEvent.press(screen.getByRole('button', { name: /^Sono Leve/ }))
    // Custo 7 → 8 sem saldo: o Aplicar é recusado
    fireEvent(
      screen.getByRole('adjustable', { name: 'Sono Leve, Custo' }),
      'accessibilityAction',
      { nativeEvent: { actionName: 'increment' } }
    )
    fireEvent.press(screen.getByRole('button', { name: 'Aplicar' }))
    expect(alertsIn('item-sheet-merits')).toHaveLength(1)
    fireEvent.press(screen.getByRole('button', { name: 'Remover' }))
    // Só o "Remover Sono Leve?"; nada da recusa anterior
    expect(alertsIn('item-sheet-merits')).toHaveLength(1)
    expect(alertsIn('item-sheet-merits')[0]).toHaveTextContent(
      'Remover Sono Leve?'
    )
  })

  it('recusa do texto livre mantém o nome digitado; mudar a busca apaga a frase', async () => {
    await open({ merits: SPENT }, { plain: true })
    fireEvent.press(screen.getByRole('button', { name: 'Adicionar Qualidade' }))
    fireEvent.changeText(textInput('Nome'), 'Ambidestro')
    fireEvent.press(
      screen.getByRole('button', { name: 'Adicionar “Ambidestro”' })
    )
    // P17 (N-08): o passo do custo; a recusa do lote aparece nele
    fireEvent.press(screen.getByTestId('add-cost-confirm'))
    expect(alertsIn('add-sheet-merits')).toHaveLength(1)
    expect(alertsIn('add-sheet-merits')[0]).toHaveTextContent(/bônus/i)
    // "Trocar" volta à busca com o nome digitado, sem a frase
    fireEvent.press(screen.getByRole('button', { name: 'Trocar Ambidestro' }))
    expect(textInput('Nome').props.value).toBe('Ambidestro')
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
    // Como no app: o Enter traz o texto do campo
    fireEvent(textInput('Buscar Disciplina'), 'submitEditing', {
      nativeEvent: { text: 'Ofuscação' },
    })
    expect(textInput('Buscar Disciplina').props.value).toBe('Ofuscação')
    expect(alertsIn('add-sheet-disciplines')).toHaveLength(1)
    expect(alertsIn('add-sheet-disciplines')[0]).toHaveTextContent(
      /Disciplinas/
    )
    // É o erro do próprio campo, não uma frase solta ao lado dele
    expect(screen.queryByTestId('notice-disciplines')).toBeNull()
  })
})

describe('T-08 e as notas do P07-C: a prévia do item novo', () => {
  it('"Adicionar Qualidade" diz o custo e o saldo antes do toque', async () => {
    await open({}, { plain: true })
    fireEvent.press(screen.getByRole('button', { name: 'Adicionar Qualidade' }))
    expect(screen.getByTestId('add-preview')).toHaveTextContent(
      /Custa o Custo do item em bônus \(começa em 1\); restam 15\./
    )
  })

  it('sem saldo: "restam 0", e o toque continua dando a recusa na folha', async () => {
    await open({ merits: SPENT }, { plain: true })
    fireEvent.press(screen.getByRole('button', { name: 'Adicionar Qualidade' }))
    expect(screen.getByTestId('add-preview')).toHaveTextContent(/restam 0/)
    fireEvent.changeText(textInput('Nome'), 'Ambidestro')
    fireEvent.press(
      screen.getByRole('button', { name: 'Adicionar “Ambidestro”' })
    )
    // P17 (N-08): a prévia do passo do custo avisa antes; o toque continua
    expect(screen.getByTestId('add-cost-preview')).toHaveTextContent(
      'Faltaria 1 de bônus: custa 1, restam 0.'
    )
    fireEvent.press(screen.getByTestId('add-cost-confirm'))
    expect(alertsIn('add-sheet-merits')).toHaveLength(1)
  })

  it('"Adicionar Disciplina": os básicos que faltam, ou o motivo com o grupo cheio', async () => {
    await open()
    fireEvent.press(
      screen.getByRole('button', { name: 'Adicionar Disciplina' })
    )
    expect(screen.getByTestId('add-preview')).toHaveTextContent(
      /Entra com os pontos básicos \(faltam 3 de 3\)\./
    )
  })

  it('fora da Criação (Editar), sem prévia', async () => {
    await open({}, { mode: 'free' })
    fireEvent.press(screen.getByRole('button', { name: 'Adicionar Qualidade' }))
    expect(screen.queryByTestId('add-preview')).toBeNull()
  })
})

describe('T-08: a previsão do "+" do Custo e do Bônus na folha do item', () => {
  it('com saldo, o "+" do Custo diz o preço e o saldo, escrito e na dica', async () => {
    await open({
      merits: [{ id: 'm1', name: 'Ambidestro', meta: { cost: 1 } }],
    })
    fireEvent.press(screen.getByRole('button', { name: /^Ambidestro/ }))
    const plus = screen.getByRole('adjustable', { name: 'Ambidestro, Custo' })
    expect(plus.props.accessibilityHint).toMatch(/\+1 = 1 bônus; restam 14/)
    expect(plus.props['aria-disabled']).toBe(false)
    expect(screen.getByTestId('advice-merits-m1-cost')).toHaveTextContent(
      /restam 14/
    )
    // Com o Custo mudado na folha, a previsão sai: o Aplicar decide
    fireEvent(plus, 'accessibilityAction', {
      nativeEvent: { actionName: 'increment' },
    })
    expect(screen.queryByTestId('advice-merits-m1-cost')).toBeNull()
  })

  it('sem saldo, o "+" do Custo diz o motivo e continua tocável', async () => {
    await open({ merits: SPENT })
    fireEvent.press(screen.getByRole('button', { name: /^Sono Leve/ }))
    const plus = screen.getByRole('adjustable', { name: 'Sono Leve, Custo' })
    // No app, o controle ajustável não fica desabilitado: o toque decide (o
    // "+" com cara de indisponível e aria-disabled é do web, no E2E)
    expect(plus.props['aria-disabled']).toBe(false)
    expect(plus.props.accessibilityHint).toMatch(/restam 0/)
    expect(screen.getByTestId('advice-merits-m2-cost')).toHaveTextContent(
      /restam 0/
    )
  })

  it('o "+" do Bônus do Defeito diz que devolve, até 7', async () => {
    await open({ flaws: [{ id: 'f1', name: 'Inimigo', meta: { bonus: 2 } }] })
    fireEvent.press(screen.getByRole('button', { name: /^Inimigo/ }))
    expect(screen.getByTestId('advice-flaws-f1-bonus')).toHaveTextContent(
      '+1 = devolve 1, até 7.'
    )
  })
})

describe('R-26: as Disciplinas do clã, o selo e o "fora do clã"', () => {
  it('Brujah: "Do clã" com as 3 e "Outras" com as 14; Dominação entra e a linha avisa, sem bloquear', async () => {
    await open({ clan: 'brujah' }, { identity: true })
    fireEvent.press(
      screen.getByRole('button', { name: 'Adicionar Disciplina' })
    )
    const sheet = within(screen.getByTestId('add-sheet-disciplines'))
    expect(sheet.getByRole('header', { name: 'Do clã' })).toBeTruthy()
    expect(sheet.getByRole('header', { name: 'Outras' })).toBeTruthy()
    const clan = within(screen.getByTestId('add-block-by-clan'))
    expect(
      clan
        .getAllByRole('button', { name: /, do clã$/ })
        .map(b => b.props.accessibilityLabel)
    ).toEqual(['Potência, do clã', 'Presença, do clã', 'Rapidez, do clã'])
    // 14 opções, cada uma com o "?" da frase da Disciplina (onda 4)
    const others = within(screen.getByTestId('add-block-others'))
      .getAllByRole('button')
      .map(b => b.props.accessibilityLabel as string)
    expect(others.filter(l => !l.startsWith('Ajuda: '))).toHaveLength(14)
    expect(others.filter(l => l.startsWith('Ajuda: '))).toHaveLength(14)
    fireEvent.press(sheet.getByRole('button', { name: 'Dominação' }))
    // Entrou (nada bloqueia) e a linha diz o "fora", só na criação
    expect(screen.queryByTestId('add-sheet-disciplines')).toBeNull()
    const line = screen.getByTestId('identity-disciplines-i1')
    expect(line).toHaveTextContent('fora do clã: confirme com o narrador')
    // O "O que falta" ganha o aviso, sem virar problema
    tab('Pontos')
    expect(screen.getByTestId('creation-notices')).toHaveTextContent(
      /Disciplinas: 1 fora do clã\./
    )
    expect(screen.getByTestId('creation-problems')).not.toHaveTextContent(
      /fora do clã/
    )
  })

  // P09-D: o narrador confirma na revisão o que o aviso pede, também em
  // `pending`, na aba Pontos em Leitura
  it('em pending, o narrador lê o "fora do clã" na aba Pontos', async () => {
    const sent = character({
      clan: 'brujah',
      disciplines: [{ id: 'd1', name: 'Dominação', value: 1 }],
    }) as { data: Record<string, unknown> }
    calls.characterGet.mockResolvedValue(
      ok({ ...sent.data, roles: ['storyteller'], status: 'pending' })
    )
    calls.templateGet.mockResolvedValue(ok(templateWithIdentity('vtm-v20')))
    const { session } = testSession(
      () => json(200, tokens()),
      memoryStore(true, 'r')
    )
    await session.restore()
    renderWithSession(<SheetScreen id={ID} />, session)
    fireEvent.press(await screen.findByRole('button', { name: 'Ver Pontos' }))
    expect(screen.getByTestId('creation-notices')).toHaveTextContent(
      /Disciplinas: 1 fora do clã\./
    )
  })

  it('a Disciplina do clã leva o selo na linha e no nome acessível', async () => {
    await open(
      {
        clan: 'brujah',
        disciplines: [{ id: 'd1', name: 'Potência', value: 1 }],
      },
      { identity: true }
    )
    expect(
      screen.getByRole('button', { name: 'Potência, 1 de 5, do clã' })
    ).toBeTruthy()
    expect(screen.getByTestId('identity-disciplines-d1')).toHaveTextContent(
      'do clã'
    )
    expect(screen.getByTestId('identity-disciplines-d1')).not.toHaveTextContent(
      /fora/
    )
  })
})

describe('T-24: Dons do catálogo, o Posto e o aviso acima do Posto 1', () => {
  const LUPINO = { breed: 'lupino', auspice: 'ahroun', tribe: 'fianna' }

  // A2 do roteiro web: com o wta-w20 do produto, o Dom com Posto 2 avisa na
  // linha, na aba Pontos e na confirmação. Os três são recomendados (onda 4:
  // Mestre do Fogo é da Raça), para o aviso ser só o do Posto
  it('wta-w20 do produto: Dom de Posto 2 avisa na linha, em Pontos e ao concluir', async () => {
    await open(
      {
        strength: 4,
        dexterity: 3,
        stamina: 3,
        charisma: 3,
        manipulation: 2,
        appearance: 3,
        perception: 2,
        intelligence: 2,
        wits: 2,
        breed: 'hominideo',
        auspice: 'ahroun',
        tribe: 'fianna',
        alertness: 3,
        athletics: 3,
        brawl: 3,
        empathy: 2,
        primalUrge: 2,
        drive: 3,
        melee: 3,
        survival: 3,
        enigmas: 2,
        occult: 2,
        rituals: 1,
        backgrounds: [
          { id: 'b1', name: 'Raça Pura', value: 3 },
          { id: 'b2', name: 'Fetiche', value: 2 },
        ],
        gifts: [
          { id: 'g1', name: 'Mestre do Fogo', meta: { rank: 2 } },
          { id: 'g2', name: 'Inspiração', meta: { rank: 1 } },
          { id: 'g3', name: 'Persuasão', meta: { rank: 1 } },
        ],
      },
      { system: 'wta-w20' }
    )
    expect(screen.getByTestId('identity-gifts-g1')).toHaveTextContent(
      /Posto 2: na criação, vai até 1\. Confirme com o narrador\./
    )
    // Os de Posto 1 têm só o selo, sem aviso
    expect(screen.getByTestId('identity-gifts-g2')).toHaveTextContent(
      'do Augúrio'
    )
    expect(screen.getByTestId('identity-gifts-g2')).not.toHaveTextContent(
      /confirme/
    )
    tab('Pontos')
    expect(screen.getByTestId('creation-notices')).toHaveTextContent(
      /Dons: 1 com Posto acima de 1\./
    )
    // A conta fechou: o aviso não esconde o "Concluir" e vai para as notas
    fireEvent.press(screen.getByTestId('creation-action'))
    expect(
      screen.getByText('1 item para confirmar com o narrador; veja em Pontos.')
    ).toBeTruthy()
  })

  it('Dom de Posto 2 do catálogo entra com Posto 2; a linha e o "O que falta" avisam; o "Concluir" não muda', async () => {
    await open(LUPINO, { system: 'wta-w20', identity: true })
    fireEvent.press(screen.getByRole('button', { name: 'Adicionar Dom' }))
    fireEvent.changeText(screen.getByLabelText('Buscar Dom'), 'neblina')
    fireEvent.press(
      screen.getByRole('button', { name: `${GIFTS.rank2}, Posto 2` })
    )
    const row = screen.getByRole('button', { name: /^Passo de Neblina/ })
    expect(row.props.accessibilityLabel).toMatch(/Posto 2/)
    expect(screen.getByTestId('identity-gifts-i1')).toHaveTextContent(
      /Posto 2: na criação, vai até 1\. Confirme com o narrador\./
    )
    expect(screen.getByTestId('identity-gifts-i1')).toHaveTextContent(
      /fora da Raça, do Augúrio e da Tribo: confirme com o narrador/
    )
    tab('Pontos')
    const advice = screen.getByTestId('creation-notices')
    expect(advice).toHaveTextContent(/Dons: 1 com Posto acima de 1\./)
    expect(screen.getByTestId('creation-problems')).not.toHaveTextContent(
      /Posto/
    )
  })

  it('T-24d: o "+" do Posto na folha do Dom já avisa; de volta ao 1, some', async () => {
    await open(
      { gifts: [{ id: 'g1', name: 'Faro do Asfalto', meta: { rank: 1 } }] },
      { system: 'wta-w20' }
    )
    fireEvent.press(screen.getByRole('button', { name: /^Faro do Asfalto/ }))
    const sheet = within(screen.getByTestId('item-sheet-gifts'))
    const rank = () =>
      screen.getByRole('adjustable', { name: 'Faro do Asfalto, Posto' })
    expect(sheet.queryByTestId('item-advice-gifts')).toBeNull()
    fireEvent(rank(), 'accessibilityAction', {
      nativeEvent: { actionName: 'increment' },
    })
    expect(sheet.getByTestId('item-advice-gifts')).toHaveTextContent(
      'Posto 2: na criação, vai até 1. Confirme com o narrador.'
    )
    // Nada bloqueia: o "Aplicar" continua disponível
    expect(sheet.getByRole('button', { name: 'Aplicar' })).toBeEnabled()
    fireEvent(rank(), 'accessibilityAction', {
      nativeEvent: { actionName: 'decrement' },
    })
    expect(sheet.queryByTestId('item-advice-gifts')).toBeNull()
  })

  it('o Dom recomendado de Posto 1 não avisa', async () => {
    await open(
      {
        ...LUPINO,
        gifts: [{ id: 'g1', name: GIFTS.tribe, meta: { rank: 1 } }],
      },
      { system: 'wta-w20', identity: true }
    )
    expect(screen.getByTestId('identity-gifts-g1')).toHaveTextContent(
      'da Tribo'
    )
    expect(screen.getByTestId('identity-gifts-g1')).not.toHaveTextContent(
      /confirme/
    )
    tab('Pontos')
    expect(screen.queryByTestId('creation-notices')).toBeNull()
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

// P17 (N-08): na Criação, o passo do custo mostra o efeito na conta, refeito
// a cada mudança do valor
describe('N-08: a prévia do passo do custo na Criação', () => {
  it('Defeito do catálogo de custo variável: "Devolve 1", depois "Devolve 3"; entra com o Bônus escolhido', async () => {
    await open()
    fireEvent.press(screen.getByRole('button', { name: 'Adicionar Defeito' }))
    fireEvent.changeText(textInput('Buscar Defeito'), 'Inimigo')
    fireEvent.press(screen.getByRole('button', { name: 'Inimigo' }))
    // A faixa do anexo, na ajuda do catálogo
    expect(screen.getByTestId('add-cost-help')).toHaveTextContent(
      'Bônus de 1 a 5, escolhido ao adicionar. O app não confere o valor: combine com o narrador.'
    )
    expect(screen.getByTestId('add-cost-preview')).toHaveTextContent(
      'Devolve 1 de bônus.'
    )
    for (let i = 0; i < 2; i++)
      fireEvent(
        screen.getByRole('adjustable', { name: 'Bônus' }),
        'accessibilityAction',
        { nativeEvent: { actionName: 'increment' } }
      )
    expect(screen.getByTestId('add-cost-preview')).toHaveTextContent(
      'Devolve 3 de bônus.'
    )
    fireEvent.press(screen.getByTestId('add-cost-confirm'))
    expect(
      within(screen.getByTestId('editor-flaws')).getByText('Bônus 3')
    ).toBeTruthy()
    tab('Pontos')
    expect(screen.getByTestId('creation-freebies')).toHaveTextContent(
      /\b18 de 18\b/
    )
  })

  it('Qualidade digitada: "Custa 1 de bônus; restam 14."', async () => {
    await open()
    fireEvent.press(screen.getByRole('button', { name: 'Adicionar Qualidade' }))
    fireEvent.changeText(textInput('Buscar Qualidade'), 'Qualidade Inventada')
    fireEvent.press(
      screen.getByRole('button', { name: 'Adicionar “Qualidade Inventada”' })
    )
    expect(screen.getByTestId('add-cost-preview')).toHaveTextContent(
      'Custa 1 de bônus; restam 14.'
    )
  })
})

// P17 (N-07): o catálogo do produto na Criação: o nome de custo fixo entra
// num toque, com o custo do anexo (Ambidestro, 1 no V20)
describe('N-07: o catálogo de Qualidades do V20', () => {
  it('Ambidestro entra num toque, com Custo 1, e o saldo cai para 14', async () => {
    await open()
    fireEvent.press(screen.getByRole('button', { name: 'Adicionar Qualidade' }))
    fireEvent.changeText(textInput('Buscar Qualidade'), 'ambidest')
    fireEvent.press(screen.getByRole('button', { name: 'Ambidestro, Custo 1' }))
    expect(screen.queryByTestId('add-cost-merits')).toBeNull()
    expect(
      within(screen.getByTestId('editor-merits')).getByText('Custo 1')
    ).toBeTruthy()
    tab('Pontos')
    expect(screen.getByTestId('creation-freebies')).toHaveTextContent(
      /\b14 de 15\b/
    )
  })
})
