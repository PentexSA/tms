import { act, fireEvent, screen } from '@testing-library/react-native'
import { usePreventRemove } from 'expo-router'
import { AccessibilityInfo, Dimensions } from 'react-native'

import * as apiModule from '../../../lib/api'
import { type createFakeApi, fail, ok } from '../../../test/fake-api'
import { templateJson } from '../../../test/fixtures'
import { sheetsDismissed } from '../../../test/queries'
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

async function renderPanel(systemCode = 'vtm-v20', revision = 3) {
  const { session } = testSession(
    () => json(200, tokens()),
    memoryStore(true, 'r')
  )
  await session.restore()
  renderWithSession(
    <CreationSettings
      chronicleId={CHRONICLE}
      systemCode={systemCode}
      creation={{ approval: false, defaults: {}, revision }}
    />,
    session
  )
}

// P09-D (T-36): com as regras já salvas, o painel abre recolhido; os casos
// que mexem nos controles abrem pelo "Editar"
const openPanel = async () =>
  fireEvent.press(
    await screen.findByRole('button', { name: 'Editar regras da criação' })
  )

async function render() {
  await renderPanel()
  await openPanel()
  await screen.findByTestId('creation-settings-budgets')
}

const FREE = /criação livre/
const save = () =>
  screen.getByRole('button', { name: 'Salvar regras da criação' })
// O nome acessível tem o efeito da opção depois do rótulo (T-29)
const turnApprovalOn = () =>
  fireEvent.press(screen.getByRole('radio', { name: /^Ligada, / }))

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

  // T-29 (R-10, NW-02, NA-01): o efeito de cada opção, à vista e no nome
  it('cada opção diz o efeito que tem hoje', async () => {
    await render()
    for (const name of [
      'Desligada, Na criação por pontos, a ficha entra em jogo quando o jogador conclui.',
      'Ligada, Na criação por pontos, o jogador envia a ficha e ela fica só para leitura até você aprovar ou devolver.',
      'Por pontos, A ficha conta os pontos do orçamento e avisa o que falta; o jogador conclui.',
      'Livre, Sem conta de pontos: o jogador monta no modo Editar e você conclui.',
    ])
      expect(screen.getByRole('radio', { name })).toBeTruthy()
    expect(
      screen.getByText(
        'Sem conta de pontos: o jogador monta no modo Editar e você conclui.'
      )
    ).toBeTruthy()
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
    // A saída vem depois que a folha sai da tela (onClosed, P03-D)
    await sheetsDismissed()
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
    await openPanel()
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
    await openPanel()
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
    await openPanel()
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

// P09-D (T-36, D-10): depois de salvas, as regras ficam num resumo de uma
// linha com "Editar", e as abas da crônica sobem
describe('o painel recolhido', () => {
  const SUMMARY =
    'Criação por pontos · Atributos 7/5/3 · Habilidades 13/9/5 · Disciplinas 3 · Antecedentes 5 · Virtudes 7 · 15 de bônus · aprovação desligada'
  let focus: jest.SpyInstance
  beforeEach(() => {
    focus = jest
      .spyOn(AccessibilityInfo, 'sendAccessibilityEvent')
      .mockImplementation(() => undefined)
  })
  afterEach(() => focus.mockRestore())

  it('com as regras salvas: o título, o resumo que o jogador lê e "Editar"', async () => {
    await renderPanel()
    expect(await screen.findByText(SUMMARY)).toBeTruthy()
    expect(screen.getByTestId('creation-settings-summary')).toHaveTextContent(
      SUMMARY
    )
    expect(screen.getByText('Criação de fichas')).toBeTruthy()
    expect(screen.getByTestId('creation-settings')).toBeTruthy()
    // Sem os controles nem os ids de dentro
    expect(screen.queryAllByRole('radio')).toHaveLength(0)
    expect(screen.queryByTestId('creation-settings-budgets')).toBeNull()
    expect(screen.queryByTestId('creation-settings-save')).toBeNull()
    expect(screen.queryByText('Orçamento')).toBeNull()
    // O texto visível começa o nome acessível (WCAG 2.5.3)
    const edit = screen.getByRole('button', {
      name: 'Editar regras da criação',
    })
    expect(edit).toHaveTextContent('Editar')
  })

  it('"Editar" abre e leva o foco à aprovação; "Cancelar" descarta e recolhe', async () => {
    await renderPanel()
    await openPanel()
    expect(await screen.findByTestId('creation-settings-budgets')).toBeTruthy()
    expect(focus).toHaveBeenCalledTimes(1)
    turnApprovalOn()
    fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }))
    expect(
      await screen.findByTestId('creation-settings-summary')
    ).toHaveTextContent(/aprovação desligada$/)
    // O foco volta ao "Editar"
    expect(focus).toHaveBeenCalledTimes(2)
    expect(calls.chronicle.creationSettingsPatch).not.toHaveBeenCalled()
    // Reabrir: o descartado não voltou
    await openPanel()
    expect(screen.getByRole('radio', { name: /^Desligada, / })).toBeChecked()
    expect(jest.mocked(usePreventRemove).mock.calls.at(-1)?.[0]).toBe(false)
  })

  it('salvar recolhe, com o aviso de hoje', async () => {
    calls.chronicle.creationSettingsPatch.mockResolvedValue(ok({}))
    await render()
    turnApprovalOn()
    await act(async () => {
      fireEvent.press(save())
    })
    expect(await screen.findByTestId('creation-settings-summary')).toBeTruthy()
    expect(screen.getByText('Regras da criação salvas.')).toBeTruthy()
  })

  // /code-review (P09-D): antes da rebusca, o resumo, o "mudou" e o
  // "Cancelar" partem do que acabou de ser salvo, não da prop velha
  it('depois de salvar, o resumo diz o novo antes da rebusca', async () => {
    calls.chronicle.creationSettingsPatch.mockResolvedValue(ok({}))
    await render()
    turnApprovalOn()
    await act(async () => {
      fireEvent.press(save())
    })
    expect(
      await screen.findByTestId('creation-settings-summary')
    ).toHaveTextContent(/aprovação ligada$/)
    // Reaberto, nada mudou em relação ao que acabou de ser salvo
    await openPanel()
    expect(jest.mocked(usePreventRemove).mock.calls.at(-1)?.[0]).toBe(false)
    expect(screen.getByRole('radio', { name: /^Ligada, / })).toBeChecked()
    fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.getByTestId('creation-settings-summary')).toHaveTextContent(
      /aprovação ligada$/
    )
  })

  it('erro ao salvar: continua aberto, com o erro', async () => {
    calls.chronicle.creationSettingsPatch.mockResolvedValue(
      fail(409, 'as regras mudaram')
    )
    await render()
    turnApprovalOn()
    await act(async () => {
      fireEvent.press(save())
    })
    expect(
      await screen.findByText(/as regras mudaram|Não foi possível salvar/)
    ).toBeTruthy()
    expect(screen.getByTestId('creation-settings-budgets')).toBeTruthy()
    expect(screen.queryByTestId('creation-settings-summary')).toBeNull()
  })

  it('crônica que nunca salvou: aberto, e salvar o padrão sem mudança vale', async () => {
    calls.chronicle.creationSettingsPatch.mockResolvedValue(ok({}))
    await renderPanel('vtm-v20', 0)
    expect(await screen.findByTestId('creation-settings-budgets')).toBeTruthy()
    // Sem "Cancelar": não há o que restaurar
    expect(screen.queryByRole('button', { name: 'Cancelar' })).toBeNull()
    expect(save()).toBeEnabled()
    await act(async () => {
      fireEvent.press(save())
    })
    expect(calls.chronicle.creationSettingsPatch).toHaveBeenCalledWith(
      CHRONICLE,
      { revision: 0, approval: false, defaults: {} }
    )
    expect(await screen.findByTestId('creation-settings-summary')).toBeTruthy()
  })

  it('sem as regras do sistema, o resumo nunca diz "criação livre"', async () => {
    const t = templateJson('vtm-v20')
    t.schema = 2
    calls.templateGet.mockResolvedValue(ok(t))
    await renderPanel()
    expect(
      await screen.findByText(/^As regras deste sistema são mais novas/)
    ).toBeTruthy()
    expect(screen.queryByText(FREE)).toBeNull()
  })

  it('o template não carregou: o erro com "Tentar de novo", recolhido', async () => {
    calls.templateGet.mockResolvedValue(fail(500, 'erro no servidor'))
    await renderPanel()
    expect(
      await screen.findByText(
        'Não foi possível carregar as regras deste sistema.'
      )
    ).toBeTruthy()
    expect(screen.queryByText(FREE)).toBeNull()
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeTruthy()
  })

  it('carregando: "Carregando as regras do sistema…"', async () => {
    calls.templateGet.mockImplementation(() => new Promise(() => undefined))
    await renderPanel()
    expect(
      await screen.findByText('Carregando as regras do sistema…')
    ).toBeTruthy()
    expect(screen.queryByText(FREE)).toBeNull()
  })

  it('sistema sem criação por pontos: "Criação livre · o narrador conclui"', async () => {
    calls.templateGet.mockResolvedValue(ok(templateJson('coc7e')))
    await renderPanel('coc7e')
    expect(
      await screen.findByText('Criação livre · o narrador conclui')
    ).toBeTruthy()
  })
})
