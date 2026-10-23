import { act, fireEvent, screen } from '@testing-library/react-native'
import type { SheetData } from '@tms/sheet-core'
import { useLocalSearchParams, useRouter } from 'expo-router'

import * as rowModule from '../../components/chronicles/TableRow'
import * as apiModule from '../../lib/api'
import { neighborsOf, swipeTo, useTableOrder } from '../../lib/tableOrder'
import { TableNav } from '../../sheet/storyteller/TableNav'
import { type createFakeApi, ok } from '../../test/fake-api'
import { sheetFor, templateJson } from '../../test/fixtures'
import {
  json,
  memoryStore,
  renderWithSession,
  testSession,
  tokens,
} from '../../test/session'
import ChronicleScreen from '../(app)/chronicles/[id]/index'

// v3, Etapa 9: a Mesa com os alertas do template, o estado da ficha, filtro e
// ordem, e a navegação entre as fichas na ordem da Mesa.

jest.mock('../../lib/api', () => {
  const { createFakeApi } = require('../../test/fake-api')
  const fake = createFakeApi()
  return { ...jest.requireActual('../../lib/api'), api: fake.api, fake }
})
// Conta os renders de cada linha: filtrar não pode redesenhar as que ficam
jest.mock('../../components/chronicles/TableRow', () =>
  require('../../test/countRows').countingRows(
    jest.requireActual('../../components/chronicles/TableRow')
  )
)

const calls = (
  apiModule as unknown as { fake: ReturnType<typeof createFakeApi> }
).fake.calls
const renders = (rowModule as unknown as { renders: Map<string, number> })
  .renders
const router = { push: jest.fn(), replace: jest.fn(), back: jest.fn() }
const CHRONICLE_ID = '00000000-0000-4000-8000-0000000000c1'
const HELENA = '00000000-0000-4000-8000-00000000c001'
const CAIO = '00000000-0000-4000-8000-00000000c002'
const LIA = '00000000-0000-4000-8000-00000000c003'
const OLD = '00000000-0000-4000-8000-00000000c004'
const VTM = { code: 'vtm-v20', name: 'Vampiro: A Máscara', family: 'wod' }

beforeEach(() => {
  jest.mocked(useRouter).mockReturnValue(router as never)
  jest.mocked(useLocalSearchParams).mockReturnValue({ id: CHRONICLE_ID })
  calls.templateGet.mockImplementation(async (code: string) =>
    ok(templateJson(code))
  )
  calls.chronicle.charactersGet.mockResolvedValue(ok([]))
  calls.chronicle.get.mockResolvedValue(
    ok({
      id: CHRONICLE_ID,
      name: 'Crônica da Liberdade',
      system: VTM,
      role: 'storyteller',
      storyteller: { id: 'u1', username: 'ana' },
      members: [],
    })
  )
  renders.clear()
})

async function signedIn() {
  const { session } = testSession(
    () => json(200, tokens()),
    memoryStore(true, 'refresh-0')
  )
  await session.restore()
  return session
}

function row(
  id: string,
  who: string,
  system: string,
  extra: {
    values?: Record<string, unknown>
    status?: string
    lockedAt?: string | null
    updatedAt?: string
  } = {}
) {
  const sheet = sheetFor(who, ['storyteller']).sheet as SheetData
  return {
    id,
    name: String(sheet.values.name),
    owner: { id: `u-${who}`, username: 'dona' },
    systemCode: system,
    templateVersion: '1.0.0',
    sheetVersion: 2,
    status: extra.status ?? 'active',
    lockedAt: extra.lockedAt ?? null,
    updatedAt: extra.updatedAt ?? '2026-10-18T12:00:00Z',
    sheet: { ...sheet, values: { ...sheet.values, ...extra.values } },
  }
}

const playing = () => [
  row(HELENA, 'helena', 'vtm-v20', {
    values: { health: { aggravated: 1, lethal: 6, bashing: 0 } },
    updatedAt: '2026-10-18T10:00:00Z',
  }),
  row(CAIO, 'caio', 'vtm-v20', {
    status: 'creating',
    updatedAt: '2026-10-18T13:00:00Z',
  }),
  row(LIA, 'lia', 'dnd5e-2014', {
    values: { hp: { current: 10, max: 27, temp: 0 } },
    lockedAt: '2026-10-18T11:00:00Z',
    updatedAt: '2026-10-18T12:00:00Z',
  }),
]

async function openTable() {
  calls.chronicle.tableGet.mockImplementation(
    async (opts?: { query?: { status?: string } }) =>
      ok(
        opts?.query?.status === 'archived,dead'
          ? [row(OLD, 'beto', 'vtm-v20', { status: 'archived' })]
          : playing()
      )
  )
  renderWithSession(<ChronicleScreen />, await signedIn())
  fireEvent.press(await screen.findByRole('tab', { name: 'Mesa' }))
  await screen.findByTestId(`alert-${LIA}-lowHp`)
}

const order = () =>
  screen
    .getAllByTestId(/^table-row-/)
    .map(r => String(r.props.testID).replace('table-row-', ''))

describe('Mesa com alertas', () => {
  it('inclui fichas aguardando aprovação no recorte em jogo', async () => {
    await openTable()
    expect(calls.chronicle.tableGet).toHaveBeenCalledWith(
      expect.objectContaining({
        query: { status: 'creating,pending,active' },
      })
    )
  })

  it('Incapacitado vira selo e entra no nome acessível; sem alerta, nada', async () => {
    await openTable()
    expect(
      screen.getByTestId(`alert-${HELENA}-incapacitated`)
    ).toHaveTextContent('Incapacitado')
    const line = screen.getByTestId(`table-row-${HELENA}`)
    expect(line.props.accessibilityLabel).toContain('Incapacitado')
    expect(screen.queryAllByTestId(new RegExp(`^alert-${CAIO}-`))).toEqual([])
  })

  it('o fixture de D&D mostra o alerta de PV pelo mesmo código', async () => {
    await openTable()
    expect(screen.getByTestId(`alert-${LIA}-lowHp`)).toHaveTextContent(
      'PV abaixo da metade'
    )
  })

  it('o estado da ficha: Em criação e Travada', async () => {
    await openTable()
    expect(screen.getByText('Em criação')).toBeTruthy()
    expect(screen.getByText('Travada')).toBeTruthy()
    expect(screen.getByTestId('table-updated')).toHaveTextContent(
      'Atualizado agora'
    )
  })

  it('ordena por nome e pela última alteração', async () => {
    await openTable()
    expect(order()).toEqual([CAIO, HELENA, LIA])
    fireEvent.press(
      screen.getByRole('button', { name: 'Ordenar pela última alteração' })
    )
    expect(order()).toEqual([CAIO, LIA, HELENA])
  })

  it('"Só com alerta" esconde quem está bem, sem redesenhar quem fica', async () => {
    await openTable()
    const before = new Map(renders)
    fireEvent.press(screen.getByRole('button', { name: 'Só com alerta' }))
    expect(order()).toEqual([HELENA, LIA])
    expect(renders.get(HELENA)).toBe(before.get(HELENA))
    expect(renders.get(LIA)).toBe(before.get(LIA))
    // Mudar a ordem também não redesenha
    fireEvent.press(
      screen.getByRole('button', { name: 'Ordenar pela última alteração' })
    )
    expect(renders.get(HELENA)).toBe(before.get(HELENA))
  })

  it('as arquivadas não estão na Mesa; o filtro as pede ao servidor', async () => {
    await openTable()
    expect(screen.queryByTestId(`table-row-${OLD}`)).toBeNull()
    fireEvent.press(
      screen.getByRole('tab', { name: 'Arquivadas e fora de jogo' })
    )
    expect(await screen.findByText('Arquivada')).toBeTruthy()
    expect(calls.chronicle.tableGet).toHaveBeenCalledWith(
      expect.objectContaining({ query: { status: 'archived,dead' } })
    )
    expect(screen.queryByTestId(`table-row-${HELENA}`)).toBeNull()
  })
})

describe('navegar entre as fichas na ordem da Mesa', () => {
  it('abrir uma linha guarda a ordem da tela, e "Próxima" segue essa ordem', async () => {
    await openTable()
    fireEvent.press(
      screen.getByRole('button', { name: 'Ordenar pela última alteração' })
    )
    fireEvent.press(screen.getByTestId(`table-row-${LIA}`))
    expect(router.push).toHaveBeenCalledWith(`/characters/${LIA}`)
    expect(useTableOrder.getState().ids).toEqual([CAIO, LIA, HELENA])

    renderWithSession(<TableNav characterId={LIA} />, await signedIn())
    expect(screen.getByText('2 de 3 na Mesa')).toBeTruthy()
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Próxima ›' }))
    })
    expect(router.replace).toHaveBeenCalledWith(`/characters/${HELENA}`)
  })

  it('neighborsOf: a anterior e a próxima; fora da ordem, nada', () => {
    expect(neighborsOf(['a', 'b', 'c'], 'a')).toEqual({
      prev: null,
      next: 'b',
      position: 1,
      total: 3,
    })
    expect(neighborsOf(['a', 'b', 'c'], 'x').position).toBe(0)
  })

  it('swipeTo: para a esquerda é a próxima, longe da borda e na horizontal', () => {
    const w = 390
    expect(swipeTo({ x0: 200, dx: -80, dy: 5 }, w)).toBe('next')
    expect(swipeTo({ x0: 200, dx: 80, dy: 5 }, w)).toBe('prev')
    // Da borda (o voltar do iOS), curto ou vertical: nada
    expect(swipeTo({ x0: 10, dx: 80, dy: 0 }, w)).toBeNull()
    expect(swipeTo({ x0: 380, dx: -80, dy: 0 }, w)).toBeNull()
    expect(swipeTo({ x0: 200, dx: -30, dy: 0 }, w)).toBeNull()
    expect(swipeTo({ x0: 200, dx: -80, dy: 60 }, w)).toBeNull()
  })
})
