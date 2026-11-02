import { onlineManager } from '@tanstack/react-query'
import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react-native'
import { useToast } from '@tms/ui'
import { randomUUID } from 'expo-crypto'
import { useFocusEffect } from 'expo-router'
import { BackHandler } from 'react-native'
import { GROUP_TOAST_MS } from '../../components/chronicles/OperationSheet'
import { operationError } from '../../components/chronicles/operationErrors'
import {
  SELECTION_FULL,
  selectionLabel,
  TableActionBar,
  TableSelectionProvider,
} from '../../components/chronicles/TableSelection'
import { TableView } from '../../components/chronicles/TableView'
import * as apiModule from '../../lib/api'
import { HistorySheet } from '../../sheet/history/HistorySheet'
import { type createFakeApi, ok } from '../../test/fake-api'
import { example, modelOf, sheetFor, templateJson } from '../../test/fixtures'
import {
  json,
  memoryStore,
  renderWithSession,
  testSession,
  tokens,
} from '../../test/session'

jest.mock('../../lib/api', () => {
  const { createFakeApi } = require('../../test/fake-api')
  const fake = createFakeApi()
  return { ...jest.requireActual('../../lib/api'), api: fake.api, fake }
})
jest.mock('expo-crypto', () => ({ randomUUID: jest.fn() }))
let sequence = 0

const calls = (
  apiModule as unknown as { fake: ReturnType<typeof createFakeApi> }
).fake.calls
const cid = 'c1'
const row = (id: string, fixture = 'helena', system = 'vtm-v20') => ({
  id,
  name: String(example(fixture).sheet.values.name),
  owner: { id: 'u1', username: 'dona' },
  systemCode: system,
  templateVersion: '1.0.0',
  sheetVersion: 2,
  updatedAt: new Date().toISOString(),
  sheet: sheetFor(fixture, ['storyteller']).sheet,
})
const preview = (id: string, name: string, version = 2) => ({
  characterId: id,
  name,
  sheetVersion: version,
  ok: true,
  changes: [{ label: 'Vitalidade', change: '+2 letais' }],
})

// A Mesa como a crônica a monta: a seleção na tela e a barra fora da Mesa
const Mesa = () => (
  <TableSelectionProvider>
    <TableView chronicleId={cid} />
    <TableActionBar chronicleId={cid} />
  </TableSelectionProvider>
)

async function render(ui = <Mesa />) {
  const { session } = testSession(
    () => json(200, tokens()),
    memoryStore(true, 'refresh-0')
  )
  await session.restore()
  return renderWithSession(ui, session)
}

beforeEach(() => {
  jest
    .mocked(randomUUID)
    .mockImplementation(
      () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`
    )
  onlineManager.setOnline(true)
  calls.templateGet.mockImplementation(async (code: string) =>
    ok(templateJson(code))
  )
  calls.chronicle.tableGet.mockResolvedValue(ok([row('a'), row('b', 'caio')]))
  calls.chronicle.operationPreview.mockResolvedValue(
    ok({ characters: [preview('a', 'Helena Varga'), preview('b', 'Caio')] })
  )
  calls.chronicle.operationPost.mockResolvedValue(
    ok({
      operationId: 'op1',
      duplicate: false,
      characters: [{ characterId: 'a' }, { characterId: 'b' }],
    })
  )
})
afterEach(() => {
  onlineManager.setOnline(true)
})

async function select() {
  await screen.findByRole('button', { name: /^Helena Varga,/ })
  fireEvent.press(
    screen.getByRole('button', { name: 'Selecionar personagens' })
  )
  fireEvent.press(
    screen.getByRole('checkbox', { name: 'Selecionar Helena Varga' })
  )
  const other = screen
    .getAllByRole('checkbox')
    .find(c => c.props.accessibilityLabel !== 'Selecionar Helena Varga')!
  fireEvent.press(other)
  fireEvent.press(screen.getByRole('button', { name: 'Aplicar dano' }))
  fireEvent.press(screen.getByRole('button', { name: 'Letal' }))
  fireEvent(screen.getByLabelText('Quantidade'), 'accessibilityAction', {
    nativeEvent: { actionName: 'increment' },
  })
  fireEvent.press(screen.getByRole('button', { name: 'Ver prévia' }))
  await screen.findByTestId('operation-preview-a')
}

it('dois personagens, 2 letais: um pedido; atualiza a Mesa e desfaz pelo toast', async () => {
  await render()
  await select()
  expect(calls.chronicle.operationPreview).toHaveBeenCalledWith(
    expect.objectContaining({ kind: 'damage', type: 'lethal', amount: 2 })
  )
  const before = calls.chronicle.tableGet.mock.calls.length
  fireEvent.press(screen.getByRole('button', { name: 'Confirmar operação' }))
  await screen.findByText('Dano aplicado em 2 personagens.')
  expect(calls.chronicle.operationPost).toHaveBeenCalledTimes(1)
  expect(calls.chronicle.operationPost).toHaveBeenLastCalledWith(
    expect.objectContaining({
      clientOperationId: expect.any(String),
      targets: expect.arrayContaining([
        expect.objectContaining({ characterId: 'a', sheetVersion: 2 }),
        expect.objectContaining({ characterId: 'b', sheetVersion: 2 }),
      ]),
    })
  )
  expect(calls.chronicle.tableGet.mock.calls.length).toBeGreaterThan(before)
  fireEvent.press(screen.getByRole('button', { name: 'Desfazer' }))
  await screen.findByText('Alteração desfeita.')
  expect(calls.chronicle.operationPost).toHaveBeenLastCalledWith(
    expect.objectContaining({ kind: 'revert', revertsOperationId: 'op1' })
  )
})

it('Nova noite vem do template, apresenta a ajuda, confirma e permite Desfazer', async () => {
  await render()
  await screen.findByRole('button', { name: /^Helena Varga,/ })
  fireEvent.press(
    screen.getByRole('button', { name: 'Selecionar personagens' })
  )
  fireEvent.press(
    screen.getByRole('checkbox', { name: 'Selecionar Helena Varga' })
  )
  fireEvent.press(screen.getByRole('button', { name: 'Nova noite' }))
  expect(screen.getByText(/Desconta 1 ponto de Sangue/)).toBeTruthy()
  expect(screen.queryByLabelText('Quantidade')).toBeNull()
  fireEvent.press(screen.getByRole('button', { name: 'Ver prévia' }))
  await screen.findByTestId('operation-preview-a')
  expect(calls.chronicle.operationPreview).toHaveBeenLastCalledWith({
    kind: 'recovery',
    recoveryId: 'newNight',
    targets: [{ characterId: 'a' }],
  })
  fireEvent.press(screen.getByRole('button', { name: 'Confirmar operação' }))
  await screen.findByText('Nova noite em 1 personagem.')
  expect(calls.chronicle.operationPost).toHaveBeenLastCalledWith(
    expect.objectContaining({
      kind: 'recovery',
      recoveryId: 'newNight',
      targets: [{ characterId: 'a', sheetVersion: 2 }],
    })
  )
  fireEvent.press(screen.getByRole('button', { name: 'Desfazer' }))
  await screen.findByText('Alteração desfeita.')
})

it('409: apresenta a nova prévia e pede outra confirmação com as versões novas', async () => {
  calls.chronicle.operationPost.mockResolvedValueOnce({
    data: null,
    error: {
      status: 409,
      value: {
        preview: [preview('a', 'Helena Varga', 3), preview('b', 'Caio', 4)],
      },
    },
  })
  await render()
  await select()
  fireEvent.press(screen.getByRole('button', { name: 'Confirmar operação' }))
  await screen.findByText(
    'A mesa mudou. Confira a nova prévia e confirme de novo.'
  )
  expect(calls.chronicle.operationPost).toHaveBeenCalledTimes(1)
  fireEvent.press(screen.getByRole('button', { name: 'Confirmar operação' }))
  await screen.findByText('Dano aplicado em 2 personagens.')
  const [first, second] = calls.chronicle.operationPost.mock.calls.map(
    c => c[0]
  )
  expect(second.clientOperationId).not.toBe(first.clientOperationId)
  expect(second.targets).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ characterId: 'a', sheetVersion: 3 }),
      expect.objectContaining({ characterId: 'b', sheetVersion: 4 }),
    ])
  )
})

it('uma resposta perdida conserva a chave no reenvio', async () => {
  calls.chronicle.operationPost.mockRejectedValueOnce(
    new TypeError('Failed to fetch')
  )
  await render()
  await select()
  fireEvent.press(screen.getByRole('button', { name: 'Confirmar operação' }))
  await screen.findByText(/Não foi possível falar com o servidor/)
  fireEvent.press(screen.getByRole('button', { name: 'Confirmar operação' }))
  await screen.findByText('Dano aplicado em 2 personagens.')
  expect(calls.chronicle.operationPost.mock.calls[0]?.[0]).toEqual(
    calls.chronicle.operationPost.mock.calls[1]?.[0]
  )
})

it('sem rede, a operação fica desabilitada com o motivo', async () => {
  await render()
  await screen.findByRole('button', { name: /^Helena Varga,/ })
  fireEvent.press(
    screen.getByRole('button', { name: 'Selecionar personagens' })
  )
  fireEvent.press(
    screen.getByRole('checkbox', { name: 'Selecionar Helena Varga' })
  )
  act(() => {
    onlineManager.setOnline(false)
  })
  expect(screen.getByRole('button', { name: 'Aplicar dano' })).toBeDisabled()
  expect(
    screen.getByText('Conecte-se para aplicar uma operação em grupo.')
  ).toBeTruthy()
  expect(calls.chronicle.operationPost).not.toHaveBeenCalled()
})

it('D&D: aplica no PV pelo mesmo fluxo, sem tipos de trilha', async () => {
  calls.chronicle.tableGet.mockResolvedValue(
    ok([row('a', 'lia', 'dnd5e-2014')])
  )
  calls.chronicle.operationPreview.mockResolvedValue(
    ok({
      characters: [
        {
          ...preview('a', 'Lia'),
          changes: [{ label: 'Pontos de Vida', change: '12 → 10' }],
        },
      ],
    })
  )
  await render()
  await screen.findByRole('button', { name: /^Lia/ })
  fireEvent.press(
    screen.getByRole('button', { name: 'Selecionar personagens' })
  )
  fireEvent.press(screen.getByRole('checkbox', { name: /^Selecionar Lia/ }))
  fireEvent.press(screen.getByRole('button', { name: 'Aplicar dano' }))
  expect(screen.queryByRole('button', { name: 'Letal' })).toBeNull()
  fireEvent.press(screen.getByRole('button', { name: 'Ver prévia' }))
  await screen.findByText('Pontos de Vida: 12 → 10')
  fireEvent.press(screen.getByRole('button', { name: 'Confirmar operação' }))
  await screen.findByText('Dano aplicado em 1 personagem.')
  expect(calls.chronicle.operationPost).toHaveBeenLastCalledWith(
    expect.objectContaining({
      targets: [expect.objectContaining({ characterId: 'a', field: 'hp' })],
    })
  )
})

it.each([true, false])(
  'histórico: Desfazer só nos reversíveis e para o narrador (%s)',
  async storyteller => {
    calls.historyGet.mockResolvedValue(
      ok({
        items: [true, false].map((reversible, i) => ({
          id: `b${i}`,
          at: new Date().toISOString(),
          by: { username: 'ana' },
          byRole: 'owner',
          reversible,
          changes: [{ label: 'Vitalidade', change: '+2 letais' }],
        })),
        next: null,
      })
    )
    await render(
      <HistorySheet
        characterId="a"
        chronicleId={cid}
        characterName="Helena"
        model={modelOf('vtm-v20')}
        storyteller={storyteller}
        visible
        onClose={jest.fn()}
      />
    )
    await screen.findAllByText('Vitalidade: +2 letais')
    expect(screen.queryAllByRole('button', { name: 'Desfazer' })).toHaveLength(
      storyteller ? 1 : 0
    )
    if (storyteller) {
      fireEvent.press(screen.getByRole('button', { name: 'Desfazer' }))
      await waitFor(() =>
        expect(calls.chronicle.operationPost).toHaveBeenCalledWith(
          expect.objectContaining({ revertsBatchId: 'b0', kind: 'revert' })
        )
      )
    }
  }
)

// T-49, T-75, T-76 (P09-C): a barra fixa da seleção
describe('barra da seleção', () => {
  // O View da barra não é um elemento só para o leitor de tela (os botões
  // dela continuam alcançáveis): acha-se pelo nome, e o papel é conferido
  const bar = () => {
    const el = screen.getByLabelText('Ações da seleção')
    expect(el.props.role).toBe('toolbar')
    return el
  }
  const start = async () => {
    await screen.findByRole('button', { name: /^Helena Varga,/ })
    fireEvent.press(
      screen.getByRole('button', { name: 'Selecionar personagens' })
    )
  }

  it('selectionLabel: nenhum, 1 e n, sempre com o máximo', () => {
    expect(selectionLabel(0)).toBe('Nenhum selecionado (máx. 20)')
    expect(selectionLabel(1)).toBe('1 selecionado (máx. 20)')
    expect(selectionLabel(2)).toBe('2 selecionados (máx. 20)')
  })

  it('a contagem e as ações ficam na barra; depois da operação, a seleção fica', async () => {
    await render()
    await select()
    expect(within(bar()).getByText('2 selecionados (máx. 20)')).toBeTruthy()
    fireEvent.press(screen.getByRole('button', { name: 'Confirmar operação' }))
    await screen.findByText('Dano aplicado em 2 personagens.')
    // A seleção continua para a próxima operação (Nova noite depois do dano)
    expect(within(bar()).getByText('2 selecionados (máx. 20)')).toBeTruthy()
    expect(
      screen.getByRole('checkbox', { name: 'Selecionar Helena Varga' })
    ).toBeChecked()
  })

  it('"Limpar seleção" zera e continua selecionando; "Cancelar seleção" sai', async () => {
    await render()
    await start()
    expect(within(bar()).getByText('Nenhum selecionado (máx. 20)')).toBeTruthy()
    fireEvent.press(
      screen.getByRole('checkbox', { name: 'Selecionar Helena Varga' })
    )
    expect(within(bar()).getByText('1 selecionado (máx. 20)')).toBeTruthy()
    fireEvent.press(
      within(bar()).getByRole('button', { name: 'Limpar seleção' })
    )
    expect(within(bar()).getByText('Nenhum selecionado (máx. 20)')).toBeTruthy()
    expect(
      screen.getByRole('checkbox', { name: 'Selecionar Helena Varga' })
    ).not.toBeChecked()
    fireEvent.press(screen.getByRole('button', { name: 'Cancelar seleção' }))
    expect(screen.queryByLabelText('Ações da seleção')).toBeNull()
  })

  it('o 21º toque não marca e explica o máximo', async () => {
    calls.chronicle.tableGet.mockResolvedValue(
      ok(Array.from({ length: 21 }, (_, i) => row(`id-${i}`)))
    )
    await render()
    await screen.findAllByRole('button', { name: /^Helena Varga,/ })
    fireEvent.press(
      screen.getByRole('button', { name: 'Selecionar personagens' })
    )
    const boxes = screen.getAllByRole('checkbox')
    expect(boxes).toHaveLength(21)
    for (const box of boxes.slice(0, 20)) fireEvent.press(box)
    expect(within(bar()).getByText('20 selecionados (máx. 20)')).toBeTruthy()
    expect(screen.queryByText(SELECTION_FULL)).toBeNull()
    fireEvent.press(boxes[20] as never)
    expect(within(bar()).getByText('20 selecionados (máx. 20)')).toBeTruthy()
    expect(boxes[20]).not.toBeChecked()
    expect(screen.getByText(SELECTION_FULL)).toBeTruthy()
    // Desmarcar uma libera a vez e tira o aviso
    fireEvent.press(boxes[0] as never)
    expect(screen.queryByText(SELECTION_FULL)).toBeNull()
  })

  it('a ficha que sai da Mesa sai da seleção: a contagem e o limite batem', async () => {
    const focus: (() => void)[] = []
    jest.mocked(useFocusEffect).mockImplementation(cb => {
      focus.push(cb as () => void)
    })
    try {
      await render()
      await start()
      for (const box of screen.getAllByRole('checkbox')) fireEvent.press(box)
      expect(within(bar()).getByText('2 selecionados (máx. 20)')).toBeTruthy()
      // Caio foi arquivado em outra tela: a volta à Mesa já não o traz
      calls.chronicle.tableGet.mockResolvedValue(ok([row('a')]))
      act(() => {
        for (const cb of focus) cb()
      })
      await waitFor(() =>
        expect(within(bar()).getByText('1 selecionado (máx. 20)')).toBeTruthy()
      )
    } finally {
      jest.mocked(useFocusEffect).mockReset()
    }
  })

  it('Mesa vazia: sem "Selecionar personagens"', async () => {
    calls.chronicle.tableGet.mockResolvedValue(ok([]))
    await render()
    expect(
      await screen.findByText('Nenhuma ficha na crônica ainda.')
    ).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: 'Selecionar personagens' })
    ).toBeNull()
  })

  it('o voltar do Android desliga a seleção antes de sair', async () => {
    const focus: (() => undefined | (() => void))[] = []
    jest.mocked(useFocusEffect).mockImplementation(cb => {
      focus.push(cb as () => undefined | (() => void))
    })
    type Handler = Parameters<typeof BackHandler.addEventListener>[1]
    const handlers: Handler[] = []
    const remove = jest.fn()
    jest
      .spyOn(BackHandler, 'addEventListener')
      .mockImplementation((_, handler) => {
        handlers.push(handler)
        return { remove }
      })
    try {
      await render()
      await start()
      // A tela em foco: os efeitos de foco registrados rodam (o da seleção
      // ligada registra o voltar)
      act(() => {
        for (const cb of focus) cb()
      })
      expect(handlers.length).toBeGreaterThan(0)
      let handled: boolean | undefined
      act(() => {
        handled = handlers.at(-1)?.({} as Parameters<Handler>[0])
      })
      expect(handled).toBe(true)
      expect(screen.queryByLabelText('Ações da seleção')).toBeNull()
      expect(
        screen.getByRole('button', { name: 'Selecionar personagens' })
      ).toBeTruthy()
    } finally {
      jest.mocked(useFocusEffect).mockReset()
    }
  })

  it('o aviso da operação em grupo dura 10 s', async () => {
    const shown: unknown[] = []
    function Spy() {
      const toast = useToast()
      const original = toast.show
      toast.show = m => {
        shown.push(m)
        original(m)
      }
      return null
    }
    await render(
      <>
        <Spy />
        <Mesa />
      </>
    )
    await select()
    fireEvent.press(screen.getByRole('button', { name: 'Confirmar operação' }))
    await screen.findByText('Dano aplicado em 2 personagens.')
    expect(GROUP_TOAST_MS).toBe(10_000)
    expect(shown).toContainEqual(
      expect.objectContaining({
        message: 'Dano aplicado em 2 personagens.',
        durationMs: GROUP_TOAST_MS,
      })
    )
  })
})

it('o conflito de reversão nomeia o campo e o personagem', () => {
  expect(
    operationError(
      {
        status: 409,
        value: {
          code: 'REVERT_CONFLICT',
          conflicts: [{ characterId: 'a', paths: ['values.health'] }],
        },
      },
      new Map([['a', { name: 'Caio', model: modelOf('vtm-v20') }]])
    )
  ).toBe('Vitalidade de Caio mudou depois; edite à mão.')
})
