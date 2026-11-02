import {
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react-native'
import { KeyboardArea } from '@tms/ui'
import { ScrollView, TextInput } from 'react-native'

import { modelOf, sheetFor } from '../../test/fixtures'
import { fakeServer, type LiveProps, renderLive } from '../../test/live'
import { CharacterForm } from '../CharacterForm'

// P08 (onda 2): layout e teclado na ficha. Cada caso é a regressão de um
// achado da matriz (doc/testes/2026-11-01/matriz-achados.md).

/**
 * Quem recebeu focus(): o mock do TextInput compartilha um jest.fn entre as
 * instâncias, então a prova é o `this` de cada chamada.
 */
function focusSpy() {
  const inputs = screen.UNSAFE_getAllByType(TextInput)
  const spy = jest.spyOn(inputs[0]!.instance as { focus: () => void }, 'focus')
  spy.mockClear()
  return () =>
    spy.mock.contexts.map(
      c => inputs.find(el => el.instance === c)?.props.testID
    )
}

const vtm = modelOf('vtm-v20')
const helena = () => sheetFor('helena', ['owner']).sheet

async function renderSheet(
  props: Partial<LiveProps> & { readonly system?: string } = {}
) {
  const model = props.system ? modelOf(props.system) : vtm
  const sheet = props.sheet ?? helena()
  return renderLive(
    { mode: 'evolve', ...props, model, sheet },
    fakeServer(model, sheet).post
  )
}

describe('T-26: a rolagem da ficha encolhe acima do teclado', () => {
  it('a rolagem fica dentro do KeyboardArea; o seletor de modo e a barra ficam fora', async () => {
    await renderSheet()
    const area = screen.UNSAFE_getByType(KeyboardArea)
    expect(area.findAllByType(ScrollView)).toHaveLength(1)
    expect(within(area).queryByLabelText('Modo da ficha')).toBeNull()
    expect(screen.getByLabelText('Modo da ficha')).toBeTruthy()
  })
})

describe('T-26: "Próximo" entre os campos da Nova ficha', () => {
  it('W20: cada campo de texto foca o seguinte, na ordem do formulário; o último não envia', () => {
    const onSubmit = jest.fn()
    render(<CharacterForm model={modelOf('wta-w20')} onSubmit={onSubmit} />)
    const texts = screen
      .UNSAFE_getAllByType(TextInput)
      .map(el => el.props.testID as string)
    // Só os textos de uma linha; os campos de escolha ficam fora
    expect(texts[0]).toBe('editor-name')
    expect(texts).toContain('editor-packName')
    const focused = focusSpy()
    for (const id of texts.slice(0, -1)) {
      const input = screen.getByTestId(id)
      expect(input.props.returnKeyType).toBe('next')
      fireEvent(input, 'submitEditing')
    }
    expect(focused()).toEqual(texts.slice(1))

    const last = screen.getByTestId(texts.at(-1)!)
    expect(last.props.returnKeyType).toBe('done')
    expect(last.props.onSubmitEditing).toBeUndefined()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('V20: o Clã (escolha) fica fora da cadeia', () => {
    render(<CharacterForm model={modelOf('vtm-v20')} onSubmit={jest.fn()} />)
    const texts = screen
      .UNSAFE_getAllByType(TextInput)
      .map(el => el.props.testID as string)
    expect(texts).toEqual([
      'editor-name',
      'editor-nature',
      'editor-demeanor',
      'editor-concept',
      'editor-sire',
    ])
    const focused = focusSpy()
    fireEvent(screen.getByTestId('editor-name'), 'submitEditing')
    fireEvent(screen.getByTestId('editor-demeanor'), 'submitEditing')
    expect(focused()).toEqual(['editor-nature', 'editor-concept'])
    expect(screen.getByTestId('editor-sire').props.returnKeyType).toBe('done')
  })
})
