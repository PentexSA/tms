import { act, fireEvent, screen, waitFor } from '@testing-library/react-native'
import { describe as fieldDescribe, resolve } from '@tms/sheet-core'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'

import * as apiModule from '../../lib/api'
import { type createFakeApi, fail, ok } from '../../test/fake-api'
import { example, modelOf, sheetFor, templateJson } from '../../test/fixtures'
import {
  json,
  memoryStore,
  renderWithSession,
  testSession,
  tokens,
} from '../../test/session'
import ChronicleScreen from '../(app)/chronicles/[id]/index'

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
const router = { push: jest.fn(), replace: jest.fn(), back: jest.fn() }
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

  it('a aba Fichas continua com as fichas e o convite', async () => {
    calls.chronicle.tableGet.mockResolvedValue(ok([]))
    await openTable()
    fireEvent.press(screen.getByRole('tab', { name: 'Fichas' }))
    expect(await screen.findByText('Nenhuma ficha ainda.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Convidar' })).toBeTruthy()
    expect(screen.getByRole('header', { name: 'Participantes' })).toBeTruthy()
  })
})

describe('para o jogador a Mesa não existe', () => {
  it('sem a aba e sem pedir a rota', async () => {
    calls.chronicle.get.mockResolvedValue(detail('player'))
    renderWithSession(<ChronicleScreen />, await signedIn())
    expect(await screen.findByText('Narrador: ana')).toBeTruthy()
    expect(screen.queryByRole('tab', { name: 'Mesa' })).toBeNull()
    expect(screen.queryByLabelText('Visão da crônica')).toBeNull()
    expect(screen.getByText('Nenhuma ficha ainda.')).toBeTruthy()
    expect(calls.chronicle.tableGet).not.toHaveBeenCalled()
  })
})
