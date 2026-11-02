import { act, fireEvent, screen } from '@testing-library/react-native'
import { usePreventRemove } from 'expo-router'
import { Dimensions } from 'react-native'

import * as apiModule from '../../../lib/api'
import { type createFakeApi, fail, ok } from '../../../test/fake-api'
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

async function renderPanel(systemCode = 'vtm-v20') {
  const { session } = testSession(
    () => json(200, tokens()),
    memoryStore(true, 'r')
  )
  await session.restore()
  renderWithSession(
    <CreationSettings
      chronicleId={CHRONICLE}
      systemCode={systemCode}
      creation={{ approval: false, defaults: {}, revision: 3 }}
    />,
    session
  )
}

async function render() {
  await renderPanel()
  await screen.findByTestId('creation-settings-budgets')
}

const FREE = /criação livre/
const save = () =>
  screen.getByRole('button', { name: 'Salvar regras da criação' })
const turnApprovalOn = () =>
  fireEvent.press(screen.getByRole('radio', { name: 'Ligada' }))

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

// T-56 (QAW-10, NW-03): mudar as regras e sair descartava sem perguntar
describe('sair com as regras mudadas', () => {
  const last = () => {
    const calls = jest.mocked(usePreventRemove).mock.calls
    return calls[calls.length - 1]
  }
  const raisePrimary = () =>
    fireEvent(
      screen.getByLabelText('Atributos, Primária'),
      'accessibilityAction',
      { nativeEvent: { actionName: 'increment' } }
    )

  it('sem mudança, não segura a saída', async () => {
    await render()
    expect(last()?.[0]).toBe(false)
  })

  it('mudou: "Sair sem salvar?"; "Descartar e sair" volta ao salvo e sai', async () => {
    await render()
    raisePrimary()
    expect(last()?.[0]).toBe(true)
    const repeat = jest.fn()
    act(() => {
      last()?.[1]?.({ data: { action: { type: 'GO_BACK' } }, repeat } as never)
    })
    expect(screen.getByText('Sair sem salvar?')).toBeTruthy()
    expect(
      screen.getByText('As regras da criação mudaram e não foram salvas.')
    ).toBeTruthy()
    fireEvent.press(screen.getByRole('button', { name: 'Continuar editando' }))
    expect(repeat).not.toHaveBeenCalled()
    act(() => {
      last()?.[1]?.({ data: { action: { type: 'GO_BACK' } }, repeat } as never)
    })
    fireEvent.press(screen.getByRole('button', { name: 'Descartar e sair' }))
    expect(repeat).toHaveBeenCalledTimes(1)
    // De volta ao salvo: nada a perder
    expect(last()?.[0]).toBe(false)
  })
})

// L-01: "o template não carregou" e "o app não entende o template" não são
// "criação livre", e as regras não se salvam sem o narrador vê-las
describe('Regras da criação sem as regras do sistema', () => {
  it('template mais novo que o app: avisa, sem "criação livre", e não salva', async () => {
    const t = templateJson('vtm-v20')
    t.schema = 2
    calls.templateGet.mockResolvedValue(ok(t))
    await renderPanel()
    expect(
      await screen.findByText(/^As regras deste sistema são mais novas/)
    ).toBeTruthy()
    expect(screen.queryByText(FREE)).toBeNull()
    turnApprovalOn()
    expect(save()).toBeDisabled()
  })

  it('o template não carregou: erro com "Tentar de novo", e não salva', async () => {
    calls.templateGet.mockResolvedValue(fail(500, 'erro no servidor'))
    await renderPanel()
    expect(
      await screen.findByText(
        'Não foi possível carregar as regras deste sistema.'
      )
    ).toBeTruthy()
    expect(screen.queryByText(FREE)).toBeNull()
    expect(screen.queryByText('Carregando as regras do sistema…')).toBeNull()
    turnApprovalOn()
    expect(save()).toBeDisabled()

    calls.templateGet.mockResolvedValue(ok(templateJson('vtm-v20')))
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Tentar de novo' }))
    })
    expect(await screen.findByTestId('creation-settings-budgets')).toBeTruthy()
    expect(save()).toBeEnabled()
  })

  it('sistema sem criação por pontos: "criação livre" e a aprovação salva', async () => {
    calls.templateGet.mockResolvedValue(ok(templateJson('coc7e')))
    calls.chronicle.creationSettingsPatch.mockResolvedValue(ok({}))
    await renderPanel('coc7e')
    expect(await screen.findByText(FREE)).toBeTruthy()
    turnApprovalOn()
    expect(save()).toBeEnabled()
    await act(async () => {
      fireEvent.press(save())
    })
    expect(calls.chronicle.creationSettingsPatch).toHaveBeenCalledWith(
      CHRONICLE,
      { revision: 3, approval: true, defaults: {} }
    )
  })
})
