import { onlineManager } from '@tanstack/react-query'
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native'
import { randomUUID } from 'expo-crypto'
import { operationError } from '../../components/chronicles/operationErrors'
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

async function render(ui = <TableView chronicleId={cid} />) {
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
