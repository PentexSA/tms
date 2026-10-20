import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'
import type {
  RoleName,
  SheetData,
  SheetMode,
  SheetModel,
} from '@tms/sheet-core'
import { compileTemplate } from '@tms/sheet-core'
import { ToastProvider } from '@tms/ui'
import * as Haptics from 'expo-haptics'
import { AccessibilityInfo, Dimensions } from 'react-native'
import { modelOf, sheetFor, templateJson } from '../../../../test/fixtures'
import { SheetView } from '../../../SheetView'
import { createSheetStore } from '../../../store/sheetStore'
import type { QueuedBatch } from '../../../sync/outbox'

// v2, Etapa 3: o `state` no Jogo. Linha de "Em jogo", chip do dock e o sheet
// com as opções, os valores efetivos de cada uma e o custo opcional da troca.

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(),
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Medium: 'medium' },
  NotificationFeedbackType: { Warning: 'warning' },
}))

const wta = modelOf('wta-w20')
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
    model = wta,
  }: {
    readonly roles?: RoleName[]
    readonly mode?: SheetMode
    readonly model?: SheetModel
  } = {}
) {
  const enqueue = jest.fn()
  let n = 0
  const store = createSheetStore({
    characterId: 'c1',
    model,
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

// Iara: Hominídeo, Fúria 3 de 4. Tainá: Crinos, Fúria 0.
const iara = () => sheetFor('iara', ['owner']).sheet
const taina = () => sheetFor('taina', ['owner']).sheet
const openForm = () => fireEvent.press(screen.getByTestId('dock-form'))
const radio = (name: RegExp) => screen.getByRole('radio', { name })
const instant = () =>
  screen.getByRole('switch', { name: 'Mudança instantânea: gastar 1 Fúria' })

describe('a forma no dock e em Em jogo', () => {
  it('o chip mostra a forma, e o toque abre o sheet com as opções', () => {
    setup(iara())
    expect(screen.getByTestId('dock-form')).toBeTruthy()
    openForm()
    expect(screen.getByRole('header', { name: 'Forma' })).toBeTruthy()
    expect(screen.getByTestId('state-form')).toBeTruthy()
    expect(radio(/^Hominídeo/)).toBeChecked()
  })

  it('cada opção anuncia os valores efetivos por extenso', () => {
    setup(iara())
    openForm()
    expect(radio(/^Crinos/).props.accessibilityLabel).toBe(
      'Crinos, lobisomem, Força 7, Destreza 4, Vigor 6, Manipulação 0, Aparência 0'
    )
    expect(
      screen.getByText('lobisomem · For 7 · Des 4 · Vig 6 · Man 0 · Apa 0')
    ).toBeTruthy()
  })

  it('a partir de 600, a linha de Em jogo abre o mesmo sheet', () => {
    Dimensions.set({ window: TABLET, screen: TABLET })
    setup(iara())
    expect(screen.queryByTestId('dock-form')).toBeNull()
    fireEvent.press(screen.getByRole('button', { name: 'Forma: Hominídeo' }))
    expect(screen.getByTestId('state-form')).toBeTruthy()
  })
})

describe('trocar de forma', () => {
  it('sem a mudança instantânea: um evento, "Forma Hominídeo → Crinos"', async () => {
    const { batches } = setup(iara())
    openForm()
    fireEvent.press(radio(/^Crinos/))
    expect(batches()).toEqual([
      expect.objectContaining({
        events: [{ path: 'values.form', from: 'hominideo', to: 'crinos' }],
        label: 'Forma Hominídeo → Crinos',
      }),
    ])
    await waitFor(() => expect(Haptics.selectionAsync).toHaveBeenCalled())
  })

  it('com a mudança instantânea: a forma e 1 Fúria no mesmo lote, com Desfazer', async () => {
    const { batches, store } = setup(iara())
    openForm()
    fireEvent.press(instant())
    expect(instant()).toBeChecked()
    fireEvent.press(radio(/^Crinos/))
    expect(batches()).toEqual([
      expect.objectContaining({
        events: [
          { path: 'values.form', from: 'hominideo', to: 'crinos' },
          {
            path: 'values.rage',
            from: { current: 3, permanent: 4 },
            to: { current: 2, permanent: 4 },
          },
        ],
        label: 'Forma: Crinos (1 Fúria)',
      }),
    ])
    await waitFor(() => expect(Haptics.notificationAsync).toHaveBeenCalled())
    fireEvent.press(screen.getByRole('button', { name: 'Desfazer' }))
    expect(store.getState().values.values.form).toBe('hominideo')
    expect(store.getState().values.values.rage).toEqual({
      current: 3,
      permanent: 4,
    })
  })

  it('a nota da forma escolhida aparece embaixo', () => {
    setup(iara())
    openForm()
    fireEvent.press(radio(/^Crinos/))
    expect(
      screen.getByText('Humanos que veem a forma Crinos sofrem o Delírio.')
    ).toBeTruthy()
  })

  it('sem Fúria, a mudança instantânea fica desabilitada e diz por quê; a lenta continua', () => {
    const { batches } = setup(taina())
    openForm()
    expect(instant()).toBeDisabled()
    expect(instant().props.accessibilityHint).toBe('Fúria insuficiente')
    expect(screen.getByText('Fúria insuficiente')).toBeTruthy()
    fireEvent.press(radio(/^Hominídeo/))
    expect(batches()[0]?.events).toEqual([
      { path: 'values.form', from: 'crinos', to: 'hominideo' },
    ])
  })

  it('a troca muda o valor efetivo na ficha, não o gravado', () => {
    const { store } = setup(iara())
    openForm()
    fireEvent.press(radio(/^Crinos/))
    const strength = store.getState().entries.get('strength')?.resolved
    expect(strength).toMatchObject({ base: 3, value: 7 })
    expect(store.getState().values.values.strength).toBe(3)
  })
})

describe('fora do Jogo', () => {
  it('o narrador em Leitura vê a forma e os efetivos, sem as opções', () => {
    setup(sheetFor('taina', ['storyteller']).sheet, {
      roles: ['storyteller'],
      mode: 'read',
    })
    fireEvent.press(screen.getByRole('button', { name: 'Forma: Crinos' }))
    expect(screen.queryByTestId('state-form')).toBeNull()
    expect(
      screen.getByText('For 8 · Des 4 · Vig 6 · Man 0 · Apa 0')
    ).toBeTruthy()
    expect(screen.getByText('Somente leitura neste modo.')).toBeTruthy()
  })
})

describe('um `state` sem custo e sem nome de sistema', () => {
  // A postura mínima num template de outra criatura: o mesmo sheet, sem a
  // alternância de custo
  const stance = (() => {
    const t = structuredClone(templateJson('vtm-v20')) as unknown as {
      templateVersion: string
      fields: Record<string, unknown>
      sections: { id: string; fields?: string[] }[]
    }
    t.templateVersion = '9.9.7'
    t.fields.stance = {
      type: 'state',
      label: 'Postura',
      editableIn: ['play'],
      options: [
        { id: 'calm', label: 'Calma' },
        {
          id: 'guard',
          label: 'Guarda',
          modifiers: [{ field: 'dexterity', op: 'add', value: 1 }],
        },
      ],
    }
    const play = t.sections.find(s => s.id === 'play')
    if (play) play.fields = [...(play.fields ?? []), 'stance']
    return compileTemplate(t)
  })()

  it('abre as opções sem alternância e troca com um evento', () => {
    Dimensions.set({ window: TABLET, screen: TABLET })
    const { batches } = setup(sheetFor('helena', ['owner']).sheet, {
      model: stance,
    })
    fireEvent.press(screen.getByRole('button', { name: 'Postura: Calma' }))
    expect(screen.queryByRole('switch', { name: /gastar/ })).toBeNull()
    fireEvent.press(radio(/^Guarda/))
    expect(batches()[0]?.events).toEqual([
      { path: 'values.stance', from: null, to: 'guard' },
    ])
  })
})
