import { fireEvent, screen } from '@testing-library/react-native'
import type { SheetData } from '@tms/sheet-core'
import { AccessibilityInfo, Platform } from 'react-native'
import { modelOf } from '../../../test/fixtures'
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
})
