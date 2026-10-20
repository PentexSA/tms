import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'
import type { RoleName, SheetData, SheetMode } from '@tms/sheet-core'
import { ToastProvider } from '@tms/ui'
import * as Haptics from 'expo-haptics'
import { AccessibilityInfo, Dimensions } from 'react-native'
import { modelOf, sheetFor } from '../../../../test/fixtures'
import { SheetView } from '../../../SheetView'
import { createSheetStore } from '../../../store/sheetStore'
import type { QueuedBatch } from '../../../sync/outbox'

// v1, Etapa 4: a roda (clock) no Jogo. Chip do dock, linha de "Em jogo" e o
// sheet com um Stepper por preenchimento, cada passo pela regra do core.

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(),
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Medium: 'medium' },
  NotificationFeedbackType: { Warning: 'warning' },
}))

const mta = modelOf('mta-m20')
const PHONE = { width: 390, height: 844, scale: 3, fontScale: 1 }
const TABLET = { width: 750, height: 1334, scale: 2, fontScale: 1 }

beforeEach(() => {
  Dimensions.set({ window: PHONE, screen: PHONE })
  jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
})
afterEach(() => {
  Dimensions.set({ window: TABLET, screen: TABLET })
})

function setup(
  sheet: SheetData,
  {
    roles = ['owner'],
    mode = 'play',
  }: { readonly roles?: RoleName[]; readonly mode?: SheetMode } = {}
) {
  const enqueue = jest.fn()
  let n = 0
  const store = createSheetStore({
    characterId: 'c1',
    model: mta,
    sheet,
    sheetVersion: 1,
    roles,
    mode,
    sync: { enqueue },
    uuid: () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
  })
  render(
    <ToastProvider>
      <SheetView store={store} />
    </ToastProvider>
  )
  const batches = () => enqueue.mock.calls.map(c => c[1] as QueuedBatch)
  return { store, batches }
}

// Otto: roda cheia (5 Quintessência, 15 Paradoxo). Tomás: 6 e 2.
const otto = () => sheetFor('otto', ['owner']).sheet
const tomas = () => sheetFor('tomas', ['owner']).sheet
const step = (name: string, actionName: 'increment' | 'decrement') =>
  fireEvent(screen.getByRole('adjustable', { name }), 'accessibilityAction', {
    nativeEvent: { actionName },
  })
const announced = () =>
  jest
    .mocked(AccessibilityInfo.announceForAccessibility)
    .mock.calls.map(c => c[0])

describe('roda no dock', () => {
  it('o chip anuncia os dois preenchimentos e o toque abre o sheet', () => {
    setup(tomas())
    const chip = screen.getByTestId('dock-wheel')
    expect(chip.props.accessibilityLabel).toBe(
      'Quintessência e Paradoxo: Quintessência 6, Paradoxo 2, de 20 casas'
    )
    fireEvent.press(chip)
    expect(
      screen.getByRole('header', { name: 'Quintessência e Paradoxo' })
    ).toBeTruthy()
    expect(
      screen.getByText('Quintessência 6 · Paradoxo 2 · 12 livres')
    ).toBeTruthy()
  })

  it('a partir de 600, a linha de Em jogo abre o mesmo sheet', () => {
    Dimensions.set({ window: TABLET, screen: TABLET })
    setup(tomas())
    expect(screen.queryByTestId('dock-wheel')).toBeNull()
    fireEvent.press(
      screen.getByRole('button', {
        name: 'Quintessência e Paradoxo: Quintessência 6, Paradoxo 2, de 20 casas',
      })
    )
    expect(
      screen.getByRole('adjustable', { name: 'Quintessência' })
    ).toBeTruthy()
  })
})

describe('sheet da roda (mage-quint-paradox)', () => {
  it('+1 Quintessência com casa livre: "Quintessência 6 → 7"', async () => {
    const { batches } = setup(tomas())
    fireEvent.press(screen.getByTestId('dock-wheel'))
    step('Quintessência', 'increment')
    expect(batches()).toEqual([
      expect.objectContaining({
        events: [
          {
            path: 'values.wheel',
            from: { quintessence: 6, paradox: 2 },
            to: { quintessence: 7, paradox: 2 },
          },
        ],
        label: 'Quintessência 6 → 7',
      }),
    ])
    await waitFor(() => expect(Haptics.selectionAsync).toHaveBeenCalled())
  })

  it('Paradoxo +1 com a roda cheia consome Quintessência, com o aviso da regra', async () => {
    const { batches } = setup(otto())
    fireEvent.press(screen.getByTestId('dock-wheel'))
    step('Paradoxo', 'increment')
    expect(batches()).toEqual([
      expect.objectContaining({
        events: [
          {
            path: 'values.wheel',
            from: { quintessence: 5, paradox: 15 },
            to: { quintessence: 4, paradox: 16 },
          },
        ],
        label: 'Sem casa livre: 1 Quintessência virou Paradoxo',
      }),
    ])
    expect(announced()).toContain(
      'Sem casa livre: 1 Quintessência virou Paradoxo'
    )
    await waitFor(() => expect(Haptics.notificationAsync).toHaveBeenCalled())
  })

  it('Quintessência com a roda cheia: o + não passa, e o porquê fica escrito', () => {
    const { batches } = setup(otto())
    fireEvent.press(screen.getByTestId('dock-wheel'))
    expect(
      screen.getByText('Sem casa livre: Quintessência não entra')
    ).toBeTruthy()
    step('Quintessência', 'increment')
    expect(batches()).toEqual([])
    // O − continua valendo
    step('Quintessência', 'decrement')
    expect(batches()[0]?.label).toBe('Quintessência 5 → 4')
  })

  it('Desfazer devolve a roda', () => {
    const { store } = setup(otto())
    fireEvent.press(screen.getByTestId('dock-wheel'))
    step('Paradoxo', 'increment')
    fireEvent.press(screen.getByRole('button', { name: 'Desfazer' }))
    expect(store.getState().values.values.wheel).toEqual({
      quintessence: 5,
      paradox: 15,
    })
  })

  it('o narrador em Leitura vê a roda sem stepper', () => {
    // Em Leitura não há dock: a roda fica na seção Em jogo
    setup(sheetFor('tomas', ['storyteller']).sheet, {
      roles: ['storyteller'],
      mode: 'read',
    })
    expect(screen.queryByTestId('dock-wheel')).toBeNull()
    fireEvent.press(
      screen.getByRole('button', {
        name: 'Quintessência e Paradoxo: Quintessência 6, Paradoxo 2, de 20 casas',
      })
    )
    expect(screen.queryByRole('adjustable', { name: 'Paradoxo' })).toBeNull()
    expect(screen.getByText('Somente leitura neste modo.')).toBeTruthy()
  })
})
