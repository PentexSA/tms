import { act, render, screen } from '@testing-library/react-native'
import { sheetFor } from '../../test/fixtures'
import { SheetView } from '../SheetView'
import { createSheetStore } from '../store/sheetStore'
import * as views from '../views'

// Etapa 16, assinatura por campo (doc/arquitetura §6.5): com dezenas de
// campos na tela, gastar Sangue re-renderiza só quem assina o Sangue.

jest.mock('../views', () =>
  require('../../test/countViews').countingViews(jest.requireActual('../views'))
)
const renders = (views as unknown as { renders: Map<string, number> }).renders

it('gastar Sangue re-renderiza só o Sangue', () => {
  const { model, sheet } = sheetFor('helena', ['owner'])
  const store = createSheetStore({
    characterId: 'c1',
    model,
    sheet,
    sheetVersion: 1,
    roles: ['owner'],
    sync: { enqueue: jest.fn() },
    uuid: () => '00000000-0000-4000-8000-000000000001',
  })
  // Duas fichas do mesmo store (a do celular e uma prévia): ~90 FieldSlot
  render(
    <>
      <SheetView store={store} />
      <SheetView store={store} />
    </>
  )
  const total = [...renders.values()].reduce((a, b) => a + b, 0)
  expect(total).toBeGreaterThanOrEqual(50)
  renders.clear()

  act(() => {
    store
      .getState()
      .commit(
        [{ path: 'values.blood', from: { current: 9 }, to: { current: 8 } }],
        'Sangue −1'
      )
  })
  expect(screen.getAllByLabelText(/^Pontos de Sangue, 8 de/)).toHaveLength(2)
  expect([...renders.keys()]).toEqual(['blood'])
  expect(renders.get('blood')).toBe(2)
})

it('mexer na roda do Mago re-renderiza só a roda (v1)', () => {
  const { model, sheet } = sheetFor('tomas', ['owner'])
  const store = createSheetStore({
    characterId: 'c2',
    model,
    sheet,
    sheetVersion: 1,
    roles: ['owner'],
    sync: { enqueue: jest.fn() },
    uuid: () => '00000000-0000-4000-8000-000000000002',
  })
  render(<SheetView store={store} />)
  renders.clear()

  act(() => {
    store.getState().commit(
      [
        {
          path: 'values.wheel',
          from: { quintessence: 6, paradox: 2 },
          to: { quintessence: 6, paradox: 3 },
        },
      ],
      'Paradoxo 2 → 3'
    )
  })
  expect([...renders.keys()]).toEqual(['wheel'])
})
