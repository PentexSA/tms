import { act, fireEvent, screen, within } from '@testing-library/react-native'
import type { SheetData } from '@tms/sheet-core'
import { compileTemplate } from '@tms/sheet-core'
import {
  AccessibilityInfo,
  Dimensions,
  Platform,
  StyleSheet,
} from 'react-native'
import { modelOf, templateWithIdentity } from '../../../test/fixtures'
import { fakeServer, renderLive } from '../../../test/live'
import { textInput } from '../../../test/queries'

// P08 (onda 2), T-10: nas folhas de texto de uma linha, o "✓" do teclado
// (Enter no web) aplica, como o "Digitar" (T-25). No texto longo, Enter
// continua sendo nova linha.

const model = modelOf('vtm-v20')
const nova: SheetData = {
  values: { name: 'Nova', clan: 'tremere', strength: 2 },
  specialties: {},
}

beforeEach(() => {
  jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
})

const enterEvolve = () =>
  fireEvent.press(screen.getByRole('radio', { name: 'Editar' }))

// P03-D (D-01): no Editar a barra tem uma ação só ("Salvar alterações") e
// fica numa linha no celular; com fonte de 130%, o botão desce para baixo
// do texto. As duas linhas da Criação estão no CreationScreen.test.
describe('barra do Editar (D-01)', () => {
  const at = (width: number, fontScale = 1) =>
    act(() => {
      const size = { width, height: 844, scale: 3, fontScale }
      Dimensions.set({ window: size, screen: size })
    })
  afterEach(() => at(750))

  it('a 360, uma linha: "Editando · N alterações" e "Salvar alterações"', async () => {
    await renderLive({ model, sheet: nova }, fakeServer(model, nova).post)
    at(360)
    enterEvolve()
    expect(screen.queryByTestId('mode-bar-actions')).toBeNull()
    expect(
      StyleSheet.flatten(screen.getByTestId('mode-bar').props.style)
        .flexDirection
    ).toBe('row')
    expect(screen.getByTestId('mode-save')).toHaveTextContent(
      'Salvar alterações'
    )
  })

  it('com fonte de 130%, o botão desce para a linha de baixo', async () => {
    await renderLive({ model, sheet: nova }, fakeServer(model, nova).post)
    at(390, 1.3)
    enterEvolve()
    expect(
      within(screen.getByTestId('mode-bar-actions')).getByTestId('mode-save')
    ).toBeTruthy()
  })
})

describe('T-10: Enter aplica na folha de uma linha', () => {
  it('Conceito: o "✓" aplica e fecha a folha', async () => {
    await renderLive({ model, sheet: nova }, fakeServer(model, nova).post)
    enterEvolve()
    fireEvent.press(screen.getByRole('button', { name: 'Conceito' }))
    const input = textInput('Conceito')
    expect(input.props.returnKeyType).toBe('done')
    expect(input.props.submitBehavior).toBe('submit')
    fireEvent.changeText(input, 'Arquivista')
    fireEvent(input, 'submitEditing')
    expect(screen.queryByRole('header', { name: 'Conceito' })).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Conceito' })
    ).toHaveAccessibilityValue({ text: 'Arquivista' })
  })

  it('o nome vazio não fecha: o erro aparece e o campo fica aberto', async () => {
    await renderLive({ model, sheet: nova }, fakeServer(model, nova).post)
    enterEvolve()
    fireEvent.press(screen.getByRole('button', { name: 'Nome' }))
    const input = screen.getByLabelText('Nome (obrigatório)')
    fireEvent.changeText(input, '  ')
    fireEvent(input, 'submitEditing')
    expect(screen.getByText('Informe o nome')).toBeTruthy()
    expect(screen.getByRole('header', { name: 'Nome' })).toBeTruthy()
  })

  it('no web, Enter não tira o foco do campo', async () => {
    const os = Platform.OS
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true })
    try {
      await renderLive({ model, sheet: nova }, fakeServer(model, nova).post)
      enterEvolve()
      fireEvent.press(screen.getByRole('button', { name: 'Conceito' }))
      expect(textInput('Conceito').props.blurOnSubmit).toBe(false)
    } finally {
      Object.defineProperty(Platform, 'OS', { value: os, configurable: true })
    }
  })

  it('texto longo (Fraqueza do clã): Enter é nova linha, não aplica', async () => {
    await renderLive({ model, sheet: nova }, fakeServer(model, nova).post)
    enterEvolve()
    fireEvent.press(screen.getByRole('tab', { name: 'Vantagens' }))
    fireEvent.press(screen.getByRole('button', { name: 'Fraqueza do clã' }))
    const input = textInput('Fraqueza do clã')
    expect(input.props.multiline).toBe(true)
    expect(input.props.onSubmitEditing).toBeUndefined()
    expect(input.props.returnKeyType).toBeUndefined()
  })

  describe('R-26: a Fraqueza já vem com o resumo do clã', () => {
    const v20 = compileTemplate(templateWithIdentity('vtm-v20'))
    const brujah: SheetData = {
      values: { name: 'Nova', clan: 'brujah' },
      specialties: {},
    }
    const open = async (sheet = brujah) => {
      const live = await renderLive(
        { model: v20, sheet },
        fakeServer(v20, sheet).post
      )
      enterEvolve()
      fireEvent.press(screen.getByRole('tab', { name: 'Vantagens' }))
      return live
    }
    const row = () => screen.getByTestId('editor-weakness')
    const pickClan = (label: string) => {
      fireEvent.press(screen.getByRole('tab', { name: 'Ficha' }))
      fireEvent.press(screen.getByRole('button', { name: /^Clã/ }))
      fireEvent.press(screen.getByRole('radio', { name: label }))
      fireEvent.press(screen.getByRole('tab', { name: 'Vantagens' }))
    }

    it('Brujah mostra o resumo; trocar para Toreador mostra o outro; nada é gravado', async () => {
      const { store } = await open()
      expect(row()).toHaveTextContent(/Resumo fictício de teste A\./)
      expect(screen.getByTestId('default-weakness')).toHaveTextContent(
        /Resumo de Brujah/
      )
      // Aplicar sem mudar o texto não grava nada
      fireEvent.press(row())
      fireEvent.press(screen.getByRole('button', { name: 'Aplicar' }))
      expect(
        store()
          .getState()
          .draftEvents()
          .filter(e => e.path === 'values.weakness')
      ).toEqual([])
      pickClan('Toreador')
      expect(row()).toHaveTextContent(/Resumo fictício de teste B\./)
      expect(
        store()
          .getState()
          .draftEvents()
          .map(e => e.path)
      ).toEqual(['values.clan'])
    })

    it('o texto editado fica ao trocar o Clã; apagar tudo volta ao resumo', async () => {
      const { store } = await open()
      fireEvent.press(row())
      fireEvent.changeText(textInput('Fraqueza do clã'), 'Meu texto')
      fireEvent.press(screen.getByRole('button', { name: 'Aplicar' }))
      pickClan('Toreador')
      expect(row()).toHaveTextContent(/Meu texto/)
      expect(screen.queryByTestId('default-weakness')).toBeNull()
      fireEvent.press(row())
      fireEvent.changeText(textInput('Fraqueza do clã'), '   ')
      fireEvent.press(screen.getByRole('button', { name: 'Aplicar' }))
      expect(row()).toHaveTextContent(/Resumo fictício de teste B\./)
      expect(
        store()
          .getState()
          .draftEvents()
          .find(e => e.path === 'values.weakness')
      ).toBeUndefined()
    })

    it('"Usar o resumo" troca o texto do jogador, com confirmação', async () => {
      await open({
        values: { name: 'Nova', clan: 'brujah', weakness: 'Meu texto' },
        specialties: {},
      })
      fireEvent.press(row())
      fireEvent.press(
        screen.getByRole('button', { name: 'Usar o resumo de Brujah' })
      )
      expect(
        screen.getByText('Trocar o seu texto pelo resumo de Brujah?')
      ).toBeTruthy()
      // Cancelar volta ao editor, sem trocar
      fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }))
      expect(textInput('Fraqueza do clã').props.value).toBe('Meu texto')
      fireEvent.press(
        screen.getByRole('button', { name: 'Usar o resumo de Brujah' })
      )
      fireEvent.press(screen.getByRole('button', { name: 'Trocar' }))
      expect(row()).toHaveTextContent(/Resumo fictício de teste A\./)
    })

    it('com texto próprio, trocar o Clã troca o "Usar o resumo de …" (code review)', async () => {
      await open({
        values: { name: 'Nova', clan: 'brujah', weakness: 'Meu texto' },
        specialties: {},
      })
      pickClan('Toreador')
      fireEvent.press(row())
      expect(
        screen.getByRole('button', { name: 'Usar o resumo de Toreador' })
      ).toBeTruthy()
    })

    it('Caitiff (sem resumo) e sem Clã: o campo fica vazio, sem "Usar o resumo"', async () => {
      await open({
        values: { name: 'Nova', clan: 'caitiff' },
        specialties: {},
      })
      expect(row()).toHaveTextContent(/—/)
      expect(screen.queryByTestId('default-weakness')).toBeNull()
      fireEvent.press(row())
      expect(
        screen.queryByRole('button', { name: /^Usar o resumo/ })
      ).toBeNull()
    })
  })

  it('Cancelar e Fechar não aplicam', async () => {
    await renderLive({ model, sheet: nova }, fakeServer(model, nova).post)
    enterEvolve()
    for (const close of ['Cancelar', 'Fechar']) {
      fireEvent.press(screen.getByRole('button', { name: 'Conceito' }))
      fireEvent.changeText(textInput('Conceito'), 'Arquivista')
      fireEvent.press(screen.getByRole('button', { name: close }))
      expect(screen.queryByRole('header', { name: 'Conceito' })).toBeNull()
      expect(
        screen.getByRole('button', { name: 'Conceito' })
      ).toHaveAccessibilityValue({ text: 'vazio' })
    }
  })
})
