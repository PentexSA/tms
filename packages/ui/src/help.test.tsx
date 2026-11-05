// R-19 (P10-D): o "?" da ajuda contextual, no padrão disclosure, e o "?" no
// Choice e no TextField. Os ramos do web e do Android rodam com o Platform.OS
// trocado, como em a11y.test.
import {
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react-native'
import {
  AccessibilityInfo,
  Platform,
  StyleSheet,
  type ViewStyle,
} from 'react-native'
import { Choice, HelpButton, HelpText, TextField, useHelp } from './index'

const realOS = Platform.OS
const setOS = (os: string) =>
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true })
afterEach(() => setOS(realOS))

const flat = (el: { props: { style?: unknown } }) =>
  StyleSheet.flatten(el.props.style as ViewStyle) ?? {}

function HelpHarness({ text = 'Frase do time.' }: { readonly text?: string }) {
  const { expanded, toggle, textId } = useHelp()
  return (
    <>
      <HelpButton
        subject="Consciência"
        expanded={expanded}
        onToggle={toggle}
        controls={textId}
      />
      {expanded ? (
        <HelpText id={textId} text={text} testID="help-text" />
      ) : null}
    </>
  )
}
const helpButton = (name = 'Consciência') =>
  screen.getByRole('button', { name: `Ajuda: ${name}` })

describe('HelpButton e HelpText', () => {
  // O aria-expanded do DOM é conferido no E2E (help.spec.ts): no Jest, o
  // Pressable do RN o junta ao accessibilityState.
  it('nome "Ajuda: X", papel botão, recolhido → expandido, e a frase aparece', () => {
    render(<HelpHarness />)
    expect(helpButton().props.accessibilityState).toMatchObject({
      expanded: false,
    })
    expect(screen.queryByText('Frase do time.')).toBeNull()
    fireEvent.press(helpButton())
    expect(helpButton().props.accessibilityState).toMatchObject({
      expanded: true,
    })
    expect(screen.getByText('Frase do time.')).toBeTruthy()
    fireEvent.press(helpButton())
    expect(screen.queryByText('Frase do time.')).toBeNull()
  })

  it.each([
    ['android', 48],
    ['ios', 44],
    ['web', 44],
  ] as const)('%s: alvo de %i', (os, size) => {
    setOS(os)
    render(<HelpHarness />)
    expect(flat(helpButton()).minHeight).toBe(size)
    expect(flat(helpButton()).minWidth).toBe(size)
  })

  it('web: aria-controls aponta a frase, que é região viva educada', () => {
    setOS('web')
    render(<HelpHarness />)
    fireEvent.press(helpButton())
    const text = screen.getByTestId('help-text')
    expect(helpButton().props['aria-controls']).toBe(text.props.nativeID)
    expect(text.props['aria-live']).toBe('polite')
  })

  it('Android: região viva e sem aria-controls', () => {
    setOS('android')
    render(<HelpHarness />)
    fireEvent.press(helpButton())
    expect(screen.getByTestId('help-text').props.accessibilityLiveRegion).toBe(
      'polite'
    )
    expect(helpButton().props['aria-controls']).toBeUndefined()
  })

  it('iOS: anuncia a frase ao abrir (não há região viva)', () => {
    setOS('ios')
    const announce = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockImplementation(() => undefined)
    render(<HelpHarness />)
    expect(announce).not.toHaveBeenCalled()
    fireEvent.press(helpButton())
    expect(announce).toHaveBeenCalledWith('Frase do time.')
    announce.mockRestore()
  })

  it('a frase é texto puro: marcação aparece como texto', () => {
    render(<HelpHarness text="<b>forte</b>" />)
    fireEvent.press(helpButton())
    expect(screen.getByText('<b>forte</b>')).toBeTruthy()
  })
})

describe('Choice com ajuda', () => {
  const WITH_HELP = [
    { id: 'brujah', label: 'Brujah', help: 'Frase do Brujah.' },
    { id: 'tremere', label: 'Tremere' },
    { id: 'ventrue', label: 'Ventrue', help: 'Frase do Ventrue.' },
  ]
  const MANY = Array.from({ length: 8 }, (_, i) => ({
    id: `c${i}`,
    label: `Opção ${i}`,
    ...(i === 0 ? { help: 'Frase.' } : {}),
  }))
  const radio = (name: string) => screen.getByRole('radio', { name })

  it('"?" na opção, fora do rádio, e o nome do rádio não muda', () => {
    render(
      <Choice
        label="Clã"
        options={WITH_HELP}
        value={null}
        onChange={jest.fn()}
      />
    )
    expect(within(radio('Brujah')).queryByRole('button')).toBeNull()
    expect(helpButton('Brujah')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Ajuda: Tremere' })).toBeNull()
    fireEvent.press(helpButton('Ventrue'))
    expect(screen.getByText('Frase do Ventrue.')).toBeTruthy()
    expect(screen.queryByText('Frase do Brujah.')).toBeNull()
  })

  it('o "?" não escolhe a opção, e o Tab itinerante continua só nos rádios', () => {
    setOS('web')
    const onChange = jest.fn()
    render(
      <Choice
        label="Clã"
        options={WITH_HELP}
        value={null}
        onChange={onChange}
      />
    )
    fireEvent.press(helpButton('Brujah'))
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getAllByRole('radio').map(r => r.props.tabIndex)).toEqual([
      0, -1, -1,
    ])
  })

  it('"?" no título do grupo; o grupo continua nomeado só pelo título', () => {
    setOS('web')
    render(
      <Choice
        label="Clã"
        options={WITH_HELP}
        value={null}
        onChange={jest.fn()}
        help="Frase do clã."
      />
    )
    const title = screen.getByText('Clã')
    expect(screen.getByLabelText('Clã').props['aria-labelledby']).toBe(
      title.props.nativeID
    )
    fireEvent.press(helpButton('Clã'))
    expect(screen.getByText('Frase do clã.')).toBeTruthy()
  })

  it('sem showLabel, a frase do grupo fica com quem abriu a folha', () => {
    render(
      <Choice
        label="Clã"
        options={WITH_HELP}
        value={null}
        onChange={jest.fn()}
        help="Frase do clã."
        showLabel={false}
      />
    )
    expect(screen.queryByRole('button', { name: 'Ajuda: Clã' })).toBeNull()
  })

  it('com frase: 1 coluna abaixo de 480, 2 a partir de 480; sem frase: 2', () => {
    const { rerender } = render(
      <Choice label="X" options={MANY} value={null} onChange={jest.fn()} />
    )
    fireEvent(screen.getByLabelText('X'), 'layout', {
      nativeEvent: { layout: { width: 360 } },
    })
    expect(flat(radio('Opção 1')).width).toBeUndefined()
    fireEvent(screen.getByLabelText('X'), 'layout', {
      nativeEvent: { layout: { width: 600 } },
    })
    expect(flat(radio('Opção 1')).width).toBe('50%')
    rerender(
      <Choice
        label="X"
        options={MANY.map(({ id, label }) => ({ id, label }))}
        value={null}
        onChange={jest.fn()}
      />
    )
    expect(flat(radio('Opção 1')).width).toBe('50%')
  })
})

describe('TextField com ajuda', () => {
  it('"?" na linha do rótulo; a frase abaixo; o nome do campo não muda', () => {
    render(
      <TextField
        label="Natureza"
        value=""
        onChangeText={jest.fn()}
        help={{ subject: 'Natureza', text: 'Frase da Natureza.' }}
        testID="field"
      />
    )
    expect(screen.getByTestId('field').props.accessibilityLabel).toBe(
      'Natureza'
    )
    fireEvent.press(helpButton('Natureza'))
    expect(screen.getByText('Frase da Natureza.')).toBeTruthy()
  })

  it('sem help, nenhum "?"', () => {
    render(<TextField label="Nome" value="" onChangeText={jest.fn()} />)
    expect(screen.queryByRole('button')).toBeNull()
  })
})
