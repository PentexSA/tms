import { fireEvent, render, screen } from '@testing-library/react-native'
import type { ResolvedRating, SheetData, SheetMode } from '@tms/sheet-core'
import { resolve } from '@tms/sheet-core'
import { ToastProvider } from '@tms/ui'
import { Dimensions } from 'react-native'
import { modelOf, sheetFor } from '../../../test/fixtures'
import { SheetView } from '../../SheetView'
import { createSheetStore } from '../../store/sheetStore'
import { pipSegments } from '../RatingViews'

// v2, Etapa 4: o efeito da forma à vista. A grade mostra o valor efetivo e a
// origem, o Editar edita a base e avisa o efetivo, o Renome mostra o
// temporário acima do permanente e o Augúrio, a fase da lua.

const wta = modelOf('wta-w20')
const TABLET = { width: 750, height: 1334, scale: 2, fontScale: 1 }

beforeEach(() => {
  Dimensions.set({ window: TABLET, screen: TABLET })
})

function setup(sheet: SheetData, mode: SheetMode = 'play', model = wta) {
  const store = createSheetStore({
    characterId: 'c1',
    model,
    sheet,
    sheetVersion: 1,
    roles: ['owner'],
    mode,
    sync: { enqueue: jest.fn() },
    uuid: () => '00000000-0000-4000-8000-000000000001',
  })
  if (mode === 'evolve') store.getState().startDraft()
  render(
    <ToastProvider>
      <SheetView store={store} />
    </ToastProvider>
  )
  return store
}

const inCrinos = (): SheetData => {
  const { sheet } = sheetFor('iara', ['owner'])
  return { ...sheet, values: { ...sheet.values, form: 'crinos' } }
}

describe('pips com modificador', () => {
  const rating = (id: string, sheet: SheetData) =>
    resolve(wta, sheet).get(id) as ResolvedRating
  const count = (id: string, sheet: SheetData) =>
    Object.fromEntries(pipSegments(rating(id, sheet)).map(s => [s.kind, s.n]))

  it('acima da escala (Força 7 de 5): 5 pips, 3 próprios e 2 de bônus', () => {
    expect(count('strength', inCrinos())).toEqual({
      on: 3,
      bonus: 2,
      lost: 0,
      off: 0,
    })
  })

  it('abaixo da base (Manipulação 2 → 0, Aparência 3 → 0): os pontos tirados ficam vazados', () => {
    expect(count('manipulation', inCrinos())).toEqual({
      on: 0,
      bonus: 0,
      lost: 2,
      off: 3,
    })
    expect(count('appearance', inCrinos())).toMatchObject({ on: 0, lost: 3 })
  })

  it('sem modificador, como antes', () => {
    const { sheet } = sheetFor('iara', ['owner'])
    expect(count('strength', sheet)).toEqual({
      on: 3,
      bonus: 0,
      lost: 0,
      off: 2,
    })
  })
})

describe('a grade em Crinos', () => {
  it('Força 7 com "3 + 4 Crinos", e Aparência 0 com "Crinos: 0"', () => {
    setup(inCrinos())
    expect(
      screen.getByLabelText('Força, 7, base 3 mais 4 em Crinos')
    ).toBeTruthy()
    expect(screen.getByText('3 + 4 Crinos')).toBeTruthy()
    expect(screen.getByText('Crinos: 0')).toBeTruthy()
  })

  it('em Hominídeo, nenhuma nota de origem', () => {
    setup(sheetFor('iara', ['owner']).sheet)
    expect(screen.queryByText(/Crinos/)).toBeNull()
  })
})

describe('Editar em Crinos', () => {
  it('o stepper de Força edita a base (3) e avisa o efetivo', () => {
    const store = setup(inCrinos(), 'evolve')
    const stepper = screen.getByRole('adjustable', { name: 'Força' })
    expect(stepper.props['aria-valuenow']).toBe(3)
    expect(screen.getByTestId('mod-strength')).toHaveTextContent(
      'Efetivo 7 (3 + 4 Crinos)'
    )
    fireEvent(stepper, 'accessibilityAction', {
      nativeEvent: { actionName: 'increment' },
    })
    expect(store.getState().draftEvents()).toEqual([
      { path: 'values.strength', from: 3, to: 4 },
    ])
  })
})

describe('Renome e Augúrio', () => {
  it('Glória mostra o temporário acima do permanente', () => {
    setup(sheetFor('iara', ['owner']).sheet, 'read')
    fireEvent.press(screen.getByRole('tab', { name: 'Vantagens' }))
    expect(
      screen.getByLabelText('Glória: permanente 3, temporário 4')
    ).toBeTruthy()
    expect(screen.getByText('Permanente 3 · Temporário 4')).toBeTruthy()
  })

  it('o Augúrio leva a fase da lua; o Clã do Vampiro, nenhum glifo', () => {
    setup(sheetFor('iara', ['owner']).sheet, 'read')
    expect(
      screen.getByTestId('glyph-auspice', { includeHiddenElements: true })
    ).toBeTruthy()
    screen.unmount()
    setup(sheetFor('helena', ['owner']).sheet, 'read', modelOf('vtm-v20'))
    expect(
      screen.queryByTestId('glyph-clan', { includeHiddenElements: true })
    ).toBeNull()
  })
})
