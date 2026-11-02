import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react-native'
import { describe as fieldDescribe, resolve } from '@tms/sheet-core'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { Dimensions, ScrollView } from 'react-native'

import { changeLabel } from '../../components/chronicles/tableItems'
import * as apiModule from '../../lib/api'
import { clearChronicleScroll, scrollOf } from '../../lib/chronicleScroll'
import { type createFakeApi, fail, ok } from '../../test/fake-api'
import { example, modelOf, sheetFor, templateJson } from '../../test/fixtures'
import {
  json,
  memoryStore,
  renderWithSession,
  testSession,
  tokens,
} from '../../test/session'
import ChronicleScreen, { viewOf } from '../(app)/chronicles/[id]/index'

// Etapa 19: a Mesa do narrador. Uma linha por personagem com o dock do
// template, desenhado pelo registry: o mesmo código para Vampiro e D&D.

jest.mock('../../lib/api', () => {
  const { createFakeApi } = require('../../test/fake-api')
  const fake = createFakeApi()
  return { ...jest.requireActual('../../lib/api'), api: fake.api, fake }
})

const calls = (
  apiModule as unknown as { fake: ReturnType<typeof createFakeApi> }
).fake.calls
const router = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  setParams: jest.fn(),
  canGoBack: jest.fn(),
}
const CHRONICLE_ID = '00000000-0000-4000-8000-0000000000c1'
const HELENA = '00000000-0000-4000-8000-00000000c001'
const LIA = '00000000-0000-4000-8000-00000000c002'
const VTM = { code: 'vtm-v20', name: 'Vampiro: A Máscara', family: 'wod' }

beforeEach(() => {
  jest.mocked(useRouter).mockReturnValue(router as never)
  jest.mocked(useLocalSearchParams).mockReturnValue({ id: CHRONICLE_ID })
  calls.templateGet.mockImplementation(async (code: string) =>
    ok(templateJson(code))
  )
  calls.chronicle.charactersGet.mockResolvedValue(ok([]))
})

async function signedIn() {
  const { session } = testSession(
    () => json(200, tokens()),
    memoryStore(true, 'refresh-0')
  )
  await session.restore()
  return session
}

const detail = (role: 'storyteller' | 'player') =>
  ok({
    id: CHRONICLE_ID,
    name: 'Crônica da Liberdade',
    system: VTM,
    role,
    storyteller: { id: 'u1', username: 'ana' },
    members: [{ id: 'u2', username: 'dona' }],
  })

// Hoje às 14:05 (hora local): a linha diz "alterada às 14:05"
const today = () => {
  const d = new Date()
  d.setHours(14, 5, 0, 0)
  return d.toISOString()
}

const row = (id: string, who: string, system: string, extra = {}) => {
  const c = example(who)
  return {
    id,
    name: String(c.sheet.values.name),
    owner: { id: `u-${who}`, username: 'dona' },
    systemCode: system,
    templateVersion: '1.0.0',
    sheetVersion: 2,
    updatedAt: today(),
    sheet: sheetFor(who, ['storyteller']).sheet,
    ...extra,
  }
}

/** A frase que o registry dá a cada campo do dock (o que os chips mostram). */
function dockPhrases(who: string, system: string) {
  const model = modelOf(system)
  const resolved = resolve(model, sheetFor(who, ['storyteller']).sheet)
  return model.template.dock.map(id => {
    const r = resolved.get(id)
    if (!r) throw new Error(`dock sem campo: ${id}`)
    return fieldDescribe(r, resolved)
  })
}

async function openTable() {
  calls.chronicle.get.mockResolvedValue(detail('storyteller'))
  const utils = renderWithSession(<ChronicleScreen />, await signedIn())
  fireEvent.press(await screen.findByRole('tab', { name: 'Mesa' }))
  return utils
}

describe('Mesa do narrador', () => {
  it('Vampiro e D&D: o dock de cada template, pelo mesmo código', async () => {
    calls.chronicle.tableGet.mockResolvedValue(
      ok([row(HELENA, 'helena', 'vtm-v20'), row(LIA, 'lia', 'dnd5e-2014')])
    )
    await openTable()
    const helena = dockPhrases('helena', 'vtm-v20')
    const lia = dockPhrases('lia', 'dnd5e-2014')
    expect(helena).toHaveLength(3)
    expect(lia).toHaveLength(3)
    // Cada chip é visual; o nome da linha (um alvo só) leva a frase de cada
    // um, para o leitor de tela não repetir
    await screen.findByRole('button', { name: /^Helena Varga, Tremere\./ })
    const lines = screen
      .getAllByRole('button')
      .map(b => String(b.props.accessibilityLabel ?? ''))
    for (const phrase of [...helena, ...lia])
      expect(lines.some(l => l.includes(phrase))).toBe(true)
    // Os templates vêm pela versão de cada ficha
    expect(calls.templateGet).toHaveBeenCalledWith(
      'dnd5e-2014',
      expect.objectContaining({ query: { version: '1.0.0' } })
    )
    // A linha inteira é um alvo: nome, selo, o dock e a hora da alteração
    const line = screen.getByRole('button', {
      name: /^Helena Varga, Tremere\./,
    })
    expect(line.props.accessibilityLabel).toContain(helena.join('. '))
    expect(line.props.accessibilityLabel).toMatch(/dona · alterada às 14:05$/)
    expect(screen.getAllByText('dona · alterada às 14:05')).toHaveLength(2)
  })

  // T-83: quem alterou por último, do último lote, sem id de ninguém
  it('o narrador salvou uma nota: "dona · alterada por você às 14:05"', async () => {
    calls.chronicle.tableGet.mockResolvedValue(
      ok([
        row(HELENA, 'helena', 'vtm-v20', {
          lastChange: { at: today(), by: 'you' },
        }),
      ])
    )
    await openTable()
    expect(
      await screen.findByText('dona · alterada por você às 14:05')
    ).toBeTruthy()
    const line = screen.getByRole('button', {
      name: /^Helena Varga, Tremere\./,
    })
    expect(line.props.accessibilityLabel).toMatch(
      /dona · alterada por você às 14:05$/
    )
  })

  it('changeLabel: você, o dono, outro, NPC e sem lote', () => {
    const now = new Date()
    now.setHours(18, 0, 0, 0)
    const base = {
      id: HELENA,
      name: 'Helena Varga',
      owner: { id: 'u-dona', username: 'dona' },
      systemCode: 'vtm-v20',
      templateVersion: '1.0.0',
      sheetVersion: 2,
      updatedAt: today(),
      sheet: {},
    }
    const at = new Date(now)
    at.setHours(13, 15, 0, 0)
    expect(changeLabel({ ...base, lastChange: { at, by: 'you' } }, now)).toBe(
      'dona · alterada por você às 13:15'
    )
    expect(changeLabel({ ...base, lastChange: { at, by: 'owner' } }, now)).toBe(
      'alterada por dona às 13:15'
    )
    expect(changeLabel({ ...base, lastChange: { at, by: 'other' } }, now)).toBe(
      'dona · alterada às 13:15'
    )
    expect(
      changeLabel(
        {
          ...base,
          kind: 'npc',
          lastChange: { at: at.toISOString(), by: 'you' },
        },
        now
      )
    ).toBe('alterada por você às 13:15')
    // Sem lote (ou a API antiga): o texto de antes, pelo updatedAt
    expect(changeLabel({ ...base, lastChange: null }, now)).toBe(
      'dona · alterada às 14:05'
    )
    expect(changeLabel(base, now)).toBe('dona · alterada às 14:05')
    // `by` desconhecido não inventa autor (fail secure)
    expect(
      changeLabel({ ...base, lastChange: { at, by: 'admin' as never } }, now)
    ).toBe('dona · alterada às 14:05')
  })

  it('tocar na linha abre a ficha (em Leitura)', async () => {
    calls.chronicle.tableGet.mockResolvedValue(
      ok([row(HELENA, 'helena', 'vtm-v20')])
    )
    await openTable()
    fireEvent.press(
      await screen.findByRole('button', { name: /^Helena Varga, Tremere\./ })
    )
    expect(router.push).toHaveBeenCalledWith(`/characters/${HELENA}`)
  })

  it('alteração de outro dia mostra a data', async () => {
    calls.chronicle.tableGet.mockResolvedValue(
      ok([
        row(HELENA, 'helena', 'vtm-v20', {
          updatedAt: '2020-03-07T12:00:00Z',
        }),
      ])
    )
    await openTable()
    expect(
      await screen.findByText(/^dona · alterada em 07\/03 às/)
    ).toBeTruthy()
  })

  it('ficha que não passa no validador não desenha o dock', async () => {
    const bad = row(HELENA, 'helena', 'vtm-v20', {
      sheet: { values: { name: 'Helena Varga', strength: 99 } },
    })
    calls.chronicle.tableGet.mockResolvedValue(ok([bad]))
    await openTable()
    expect(await screen.findByText('Ficha com dados inválidos.')).toBeTruthy()
    expect(screen.queryByLabelText(/^Pontos de Sangue/)).toBeNull()
  })

  it('template que o app não conhece: pede para atualizar', async () => {
    const t = templateJson('vtm-v20')
    t.schema = 2
    calls.templateGet.mockResolvedValue(ok(t))
    calls.chronicle.tableGet.mockResolvedValue(
      ok([row(HELENA, 'helena', 'vtm-v20')])
    )
    await openTable()
    expect(
      await screen.findByText('Atualize o app para ver esta ficha.')
    ).toBeTruthy()
  })

  it('vazia, e erro com tentar de novo', async () => {
    calls.chronicle.tableGet.mockResolvedValueOnce(fail(500, 'erro interno'))
    calls.chronicle.tableGet.mockResolvedValue(ok([]))
    await openTable()
    fireEvent.press(
      await screen.findByRole('button', { name: 'Tentar de novo' })
    )
    expect(
      await screen.findByText('Nenhuma ficha na crônica ainda.')
    ).toBeTruthy()
  })

  it('voltar para a Mesa rebusca (sem tempo real)', async () => {
    const focus: (() => void)[] = []
    jest.mocked(useFocusEffect).mockImplementation(cb => {
      focus.push(cb as () => void)
    })
    calls.chronicle.tableGet.mockResolvedValue(ok([]))
    await openTable()
    await waitFor(() => expect(calls.chronicle.tableGet).toHaveBeenCalled())
    const before = calls.chronicle.tableGet.mock.calls.length
    // A volta para a tela (a montagem já buscou)
    act(() => {
      focus.at(-1)?.()
    })
    await waitFor(() =>
      expect(calls.chronicle.tableGet.mock.calls.length).toBe(before + 1)
    )
    jest.mocked(useFocusEffect).mockReset()
  })

  // T-48 (P09-C): a Mesa em grade nas telas largas, na ordem da lista
  it('a 1280, a Mesa vira uma grade de 3 colunas, linha a linha', async () => {
    const DESKTOP = { width: 1280, height: 800, scale: 1, fontScale: 1 }
    const before = Dimensions.get('window')
    Dimensions.set({ window: DESKTOP, screen: DESKTOP })
    try {
      const ids = [HELENA, LIA, '00000000-0000-4000-8000-00000000c003']
      calls.chronicle.tableGet.mockResolvedValue(
        ok([
          row(ids[0] as string, 'helena', 'vtm-v20'),
          row(ids[1] as string, 'lia', 'dnd5e-2014'),
          row(ids[2] as string, 'helena', 'vtm-v20', { name: 'Zélia' }),
        ])
      )
      await openTable()
      const first = await screen.findByTestId('table-grid-row-0')
      for (const id of ids)
        expect(within(first).getByTestId(`table-row-${id}`)).toBeTruthy()
      expect(screen.queryByTestId('table-grid-row-1')).toBeNull()
    } finally {
      Dimensions.set({ window: before, screen: before })
    }
  })

  it('a 390, uma coluna, sem grade', async () => {
    calls.chronicle.tableGet.mockResolvedValue(
      ok([row(HELENA, 'helena', 'vtm-v20'), row(LIA, 'lia', 'dnd5e-2014')])
    )
    const PHONE = { width: 390, height: 844, scale: 3, fontScale: 1 }
    const before = Dimensions.get('window')
    Dimensions.set({ window: PHONE, screen: PHONE })
    try {
      await openTable()
      expect(await screen.findByTestId(`table-row-${LIA}`)).toBeTruthy()
      expect(screen.queryByTestId('table-grid')).toBeNull()
    } finally {
      Dimensions.set({ window: before, screen: before })
    }
  })

  // T-49 (P09-C): a barra da seleção é irmã da rolagem da crônica
  it('a barra da seleção fica fora da rolagem e só na aba Mesa', async () => {
    calls.chronicle.tableGet.mockResolvedValue(
      ok([row(HELENA, 'helena', 'vtm-v20')])
    )
    await openTable()
    fireEvent.press(
      await screen.findByRole('button', { name: 'Selecionar personagens' })
    )
    const bar = screen.getByTestId('table-action-bar')
    expect(bar.props.role).toBe('toolbar')
    expect(
      within(screen.getByTestId('chronicle-scroll')).queryByTestId(
        'table-action-bar'
      )
    ).toBeNull()
    fireEvent.press(
      screen.getByRole('checkbox', { name: 'Selecionar Helena Varga' })
    )
    expect(within(bar).getByText('1 selecionado (máx. 20)')).toBeTruthy()
    // Na aba Fichas, a barra sai; de volta à Mesa, a seleção continua
    fireEvent.press(screen.getByRole('tab', { name: 'Fichas' }))
    expect(screen.queryByTestId('table-action-bar')).toBeNull()
    fireEvent.press(screen.getByRole('tab', { name: 'Mesa' }))
    expect(
      within(await screen.findByTestId('table-action-bar')).getByText(
        '1 selecionado (máx. 20)'
      )
    ).toBeTruthy()
  })

  it('a aba Fichas continua com as fichas e o convite', async () => {
    calls.chronicle.tableGet.mockResolvedValue(ok([]))
    await openTable()
    fireEvent.press(screen.getByRole('tab', { name: 'Fichas' }))
    expect(await screen.findByText('Nenhuma ficha ainda.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Convidar' })).toBeTruthy()
    expect(screen.getByRole('header', { name: 'Participantes' })).toBeTruthy()
  })
})

// T-39 (P09-C): a aba na URL e a rolagem guardada
describe('a crônica volta na mesma aba e no mesmo ponto', () => {
  it('?view=table abre a Mesa; trocar de aba põe a aba na URL', async () => {
    jest
      .mocked(useLocalSearchParams)
      .mockReturnValue({ id: CHRONICLE_ID, view: 'table' })
    calls.chronicle.get.mockResolvedValue(detail('storyteller'))
    calls.chronicle.tableGet.mockResolvedValue(ok([]))
    renderWithSession(<ChronicleScreen />, await signedIn())
    expect(
      await screen.findByText('Nenhuma ficha na crônica ainda.')
    ).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Mesa' })).toBeSelected()
    fireEvent.press(screen.getByRole('tab', { name: 'Bastidores' }))
    expect(router.setParams).toHaveBeenLastCalledWith({ view: 'backstage' })
    expect(screen.getByRole('tab', { name: 'Bastidores' })).toBeSelected()
    // "Fichas" é o padrão: sai da URL
    fireEvent.press(screen.getByRole('tab', { name: 'Fichas' }))
    expect(router.setParams).toHaveBeenLastCalledWith({ view: undefined })
  })

  it('valor desconhecido, ou o jogador com ?view=table, ficam em Fichas', async () => {
    expect(viewOf('table', true)).toBe('table')
    expect(viewOf('table', false)).toBe('sheets')
    expect(viewOf('backstage', false)).toBe('backstage')
    expect(viewOf('qualquer', true)).toBe('sheets')
    expect(viewOf(undefined, true)).toBe('sheets')
    jest
      .mocked(useLocalSearchParams)
      .mockReturnValue({ id: CHRONICLE_ID, view: 'table' })
    calls.chronicle.get.mockResolvedValue(detail('player'))
    renderWithSession(<ChronicleScreen />, await signedIn())
    expect(await screen.findByText('Narrador: ana')).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Fichas' })).toBeSelected()
    expect(calls.chronicle.tableGet).not.toHaveBeenCalled()
  })

  it('ao voltar à tela, a rolagem guardada da aba volta', async () => {
    const focus: (() => void)[] = []
    jest.mocked(useFocusEffect).mockImplementation(cb => {
      focus.push(cb as () => void)
    })
    try {
      jest
        .mocked(useLocalSearchParams)
        .mockReturnValue({ id: CHRONICLE_ID, view: 'table' })
      calls.chronicle.get.mockResolvedValue(detail('storyteller'))
      calls.chronicle.tableGet.mockResolvedValue(
        ok([row(HELENA, 'helena', 'vtm-v20')])
      )
      renderWithSession(<ChronicleScreen />, await signedIn())
      await screen.findByRole('button', { name: /^Helena Varga, Tremere\./ })
      const scroll = screen.getByTestId('chronicle-scroll')
      fireEvent.scroll(scroll, {
        nativeEvent: { contentOffset: { y: 640 } },
      })
      expect(scrollOf(CHRONICLE_ID, 'table')).toBe(640)
      expect(scrollOf(CHRONICLE_ID, 'sheets')).toBe(0)
      // A volta de uma ficha: o foco pede a rolagem; quando o conteúdo
      // cresce até ela, a tela rola uma vez
      // O mock do ScrollView do RN tem o scrollTo no protótipo
      const scrollTo = jest.mocked(
        (ScrollView as unknown as { prototype: { scrollTo: jest.Mock } })
          .prototype.scrollTo
      )
      scrollTo.mockClear()
      act(() => {
        for (const cb of focus) cb()
      })
      // O conteúdo ainda curto não rola; quando cresce até a altura, rola
      // uma vez, sem animação
      scrollTo.mockClear()
      fireEvent(scroll, 'contentSizeChange', 390, 300)
      expect(scrollTo).not.toHaveBeenCalled()
      fireEvent(scroll, 'contentSizeChange', 390, 2000)
      expect(scrollTo).toHaveBeenCalledWith({ y: 640, animated: false })
      fireEvent(scroll, 'contentSizeChange', 390, 2400)
      expect(scrollTo).toHaveBeenCalledTimes(1)
    } finally {
      jest.mocked(useFocusEffect).mockReset()
      clearChronicleScroll()
    }
  })
})

describe('para o jogador a Mesa não existe', () => {
  it('sem a aba e sem pedir a rota', async () => {
    calls.chronicle.get.mockResolvedValue(detail('player'))
    renderWithSession(<ChronicleScreen />, await signedIn())
    expect(await screen.findByText('Narrador: ana')).toBeTruthy()
    expect(screen.queryByRole('tab', { name: 'Mesa' })).toBeNull()
    // A v5 oferece o Diário público ao jogador, mas não a Mesa administrativa.
    expect(screen.getByLabelText('Visão da crônica')).toBeTruthy()
    // A lista de fichas é outra consulta: pode chegar depois do cabeçalho
    expect(
      await screen.findByText('Você ainda não tem ficha nesta crônica.')
    ).toBeTruthy()
    expect(calls.chronicle.tableGet).not.toHaveBeenCalled()
  })
})
