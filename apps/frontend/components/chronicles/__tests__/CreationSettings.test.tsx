import { act, fireEvent, screen } from '@testing-library/react-native'
import { Dimensions } from 'react-native'

import * as apiModule from '../../../lib/api'
import { type createFakeApi, ok } from '../../../test/fake-api'
import { templateJson } from '../../../test/fixtures'
import {
  json,
  memoryStore,
  renderWithSession,
  testSession,
  tokens,
} from '../../../test/session'
import { CreationSettings } from '../CreationSettings'

// As regras da criação da crônica: cada orçamento com o nome à vista e, na
// tela larga, "Como funciona" e "Orçamento" lado a lado.

jest.mock('../../../lib/api', () => {
  const { createFakeApi } = require('../../../test/fake-api')
  const fake = createFakeApi()
  return { ...jest.requireActual('../../../lib/api'), api: fake.api, fake }
})
const calls = (
  apiModule as unknown as { fake: ReturnType<typeof createFakeApi> }
).fake.calls

const CHRONICLE = '00000000-0000-4000-8000-0000000000c1'
const PHONE = { width: 390, height: 844, scale: 3, fontScale: 1 }
const DESKTOP = { width: 1280, height: 800, scale: 1, fontScale: 1 }

beforeEach(() => {
  calls.templateGet.mockResolvedValue(ok(templateJson('vtm-v20')))
})
afterEach(() => {
  Dimensions.set({ window: PHONE, screen: PHONE })
})

async function render() {
  const { session } = testSession(
    () => json(200, tokens()),
    memoryStore(true, 'r')
  )
  await session.restore()
  renderWithSession(
    <CreationSettings
      chronicleId={CHRONICLE}
      systemCode="vtm-v20"
      creation={{ approval: false, defaults: {}, revision: 3 }}
    />,
    session
  )
  await screen.findByTestId('creation-settings-budgets')
}

describe('Regras da criação', () => {
  it('mostra o nome de cada prioridade e de cada orçamento', async () => {
    await render()
    expect(
      screen.getByText(
        'Valem para as fichas criadas a partir de agora. Para mudar uma ficha que já existe, use as Regras da casa dentro dela.'
      )
    ).toBeTruthy()
    const attributes = screen.getByTestId('creation-settings-attributes')
    expect(attributes).toBeTruthy()
    expect(screen.getAllByText('Primária')).toHaveLength(2)
    expect(screen.getAllByText('Terciária')).toHaveLength(2)
    expect(screen.getByText('Antecedentes')).toBeTruthy()
    expect(screen.getByText('Pontos de bônus')).toBeTruthy()
  })

  it('no celular, uma coluna; na tela larga, duas', async () => {
    await render()
    const layout = () => screen.getByTestId('creation-settings-layout')
    expect(layout()).not.toHaveStyle({ flexDirection: 'row' })
    await act(async () => {
      Dimensions.set({ window: DESKTOP, screen: DESKTOP })
    })
    expect(layout()).toHaveStyle({ flexDirection: 'row' })
  })

  it('salva a prioridade mudada no orçamento da crônica', async () => {
    calls.chronicle.creationSettingsPatch.mockResolvedValue(ok({}))
    await render()
    fireEvent(
      screen.getByLabelText('Atributos, Primária'),
      'accessibilityAction',
      {
        nativeEvent: { actionName: 'increment' },
      }
    )
    await act(async () => {
      fireEvent.press(screen.getByTestId('creation-settings-save'))
    })
    expect(calls.chronicle.creationSettingsPatch).toHaveBeenCalledWith(
      CHRONICLE,
      {
        revision: 3,
        approval: false,
        defaults: { budgets: { attributes: [8, 5, 3] } },
      }
    )
  })
})
