import {
  act,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react-native'
import {
  AccessibilityInfo,
  Modal,
  Platform,
  Text as RNText,
  StyleSheet,
  type ViewStyle,
} from 'react-native'
import {
  AppBar,
  Avatar,
  Banner,
  BottomSheet,
  BoxTrack,
  Button,
  Chip,
  Choice,
  Clock,
  clockSegmentsOf,
  EmptyState,
  IconButton,
  initials,
  ListItem,
  pipsOf,
  RatingDots,
  Screen,
  SectionHeader,
  Skeleton,
  Stepper,
  Tabs,
  Text,
  TextArea,
  TextField,
  ThemeProvider,
  TOAST_MS,
  TOAST_SCREEN_READER_MS,
  ToastProvider,
  tokens,
  useToast,
} from './index'

const HIT = tokens.size.hitSize
const styleOf = (el: { props: { style?: unknown } }): ViewStyle =>
  (StyleSheet.flatten(el.props.style as ViewStyle) ?? {}) as ViewStyle

describe('Text', () => {
  it('aplica a variante e a cor do tema', () => {
    render(
      <ThemeProvider preference="noite">
        <Text variant="title">Atributos</Text>
        <Text color="danger">erro</Text>
      </ThemeProvider>
    )
    expect(screen.getByText('Atributos')).toHaveStyle({
      fontSize: 17,
      color: tokens.color.noite.ink,
    })
    expect(screen.getByText('erro')).toHaveStyle({
      color: tokens.color.noite.danger,
    })
  })

  it('cor de accent do contexto', () => {
    render(
      <ThemeProvider preference="noite" accent="accent-1">
        <Text color="accent">Tremere</Text>
      </ThemeProvider>
    )
    expect(screen.getByText('Tremere')).toHaveStyle({
      color: tokens.accents['accent-1'].noite.text,
    })
  })

  it('o sobretítulo limita a ampliação da fonte', () => {
    render(<Text variant="overline">Sobre</Text>)
    expect(screen.getByText('Sobre').props.maxFontSizeMultiplier).toBe(1.3)
  })
})

describe('Button e IconButton', () => {
  it('botão com papel, rótulo e alvo de 44', () => {
    const onPress = jest.fn()
    render(<Button title="Salvar" onPress={onPress} />)
    const button = screen.getByRole('button', { name: 'Salvar' })
    fireEvent.press(button)
    expect(onPress).toHaveBeenCalledTimes(1)
    expect(styleOf(button).minHeight).toBeGreaterThanOrEqual(HIT)
  })

  it('desabilitado não dispara', () => {
    const onPress = jest.fn()
    render(<Button title="Salvar" onPress={onPress} disabled />)
    const button = screen.getByRole('button', { name: 'Salvar' })
    fireEvent.press(button)
    expect(onPress).not.toHaveBeenCalled()
    expect(button).toBeDisabled()
  })

  it('ocupado é anunciado e não aceita outro toque', () => {
    const onPress = jest.fn()
    render(<Button title="Salvar" onPress={onPress} busy />)
    const button = screen.getByRole('button', { name: 'Salvar' })
    expect(button).toBeBusy()
    expect(button).toBeDisabled()
    fireEvent.press(button)
    expect(onPress).not.toHaveBeenCalled()
  })

  it.each(['primary', 'secondary', 'danger', 'ghost'] as const)(
    'variante %s renderiza',
    variant => {
      render(<Button title="Ok" onPress={() => undefined} variant={variant} />)
      expect(screen.getByRole('button', { name: 'Ok' })).toBeOnTheScreen()
    }
  )

  it('IconButton: o nome acessível é o rótulo, não o glifo', () => {
    const onPress = jest.fn()
    render(<IconButton label="Mais opções" glyph="⋯" onPress={onPress} />)
    const button = screen.getByRole('button', { name: 'Mais opções' })
    fireEvent.press(button)
    expect(onPress).toHaveBeenCalled()
    expect(styleOf(button).minWidth).toBeGreaterThanOrEqual(HIT)
  })
})

describe('Chip e Tabs', () => {
  it('chip selecionado', () => {
    render(<Chip label="Só com pontos" selected onPress={() => undefined} />)
    expect(screen.getByRole('button', { name: 'Só com pontos' })).toBeSelected()
  })

  it('chip sem ação é desabilitado', () => {
    render(<Chip label="Sangue 9/15" />)
    expect(screen.getByRole('button', { name: 'Sangue 9/15' })).toBeDisabled()
  })

  it('abas: tablist com a aba ativa marcada', () => {
    const onSelect = jest.fn()
    render(
      <Tabs
        accessibilityLabel="Zonas da ficha"
        items={[
          { id: 'build', label: 'Ficha' },
          { id: 'powers', label: 'Vantagens' },
          { id: 'lore', label: 'Sobre' },
        ]}
        selected="build"
        onSelect={onSelect}
      />
    )
    expect(
      screen.getByLabelText('Zonas da ficha').props.accessibilityRole
    ).toBe('tablist')
    expect(screen.getByRole('tab', { name: 'Ficha' })).toBeSelected()
    fireEvent.press(screen.getByRole('tab', { name: 'Vantagens' }))
    expect(onSelect).toHaveBeenCalledWith('powers')
  })
})

describe('RatingDots e BoxTrack (só visual)', () => {
  it('pips ficam fora da árvore de acessibilidade', () => {
    render(<RatingDots value={3} max={5} testID="dots" />)
    // Escondido do leitor de tela: só aparece pedindo os elementos ocultos
    expect(screen.queryByTestId('dots')).toBeNull()
    const dots = screen.getByTestId('dots', { includeHiddenElements: true })
    expect(dots.props['aria-hidden']).toBe(true)
  })

  it('valor e segmentos viram pips', () => {
    expect(pipsOf({ value: 2, max: 5 })).toEqual([
      'on',
      'on',
      'off',
      'off',
      'off',
    ])
    expect(pipsOf({ value: 9, max: 3 })).toEqual(['on', 'on', 'on'])
    expect(
      pipsOf({
        segments: [
          { kind: 'on', n: 3 },
          { kind: 'bonus', n: 4 },
          { kind: 'off', n: -1 },
        ],
      })
    ).toEqual(['on', 'on', 'on', 'bonus', 'bonus', 'bonus', 'bonus'])
  })

  it.each(['circle', 'diamond', 'square'] as const)('forma %s', shape => {
    render(
      <RatingDots
        segments={[
          { kind: 'on', n: 1 },
          { kind: 'bonus', n: 1 },
          { kind: 'lost', n: 1 },
          { kind: 'off', n: 1 },
        ]}
        shape={shape}
        size="sm"
      />
    )
    for (const kind of ['on', 'bonus', 'lost', 'off'])
      expect(
        screen.getByTestId(`pip-${kind}`, { includeHiddenElements: true })
      ).toBeTruthy()
  })

  it('trilha de caixas com tons e glifos', () => {
    render(
      <BoxTrack
        testID="track"
        boxes={[{ glyph: '✱', tone: 'severe' }, { glyph: 'X' }, {}]}
      />
    )
    expect(screen.queryByTestId('track')).toBeNull()
    for (const id of ['track', 'box-severe', 'box-filled', 'box-empty'])
      expect(
        screen.getByTestId(id, { includeHiddenElements: true })
      ).toBeTruthy()
  })
})

describe('Clock (roda)', () => {
  const wheel = [
    { id: 'quintessence', n: 6, from: 'start', tone: 'accent' },
    { id: 'paradox', n: 2, from: 'end', tone: 'alt-cool' },
  ] as const

  it('início no sentido horário, fim no anti-horário, o resto livre', () => {
    const s = clockSegmentsOf({ segments: 10, fills: wheel })
    expect(s.map(x => x.fill)).toEqual([
      'quintessence',
      'quintessence',
      'quintessence',
      'quintessence',
      'quintessence',
      'quintessence',
      null,
      null,
      'paradox',
      'paradox',
    ])
  })

  it('nunca passa das casas, e casas fora da faixa são limitadas', () => {
    const full = clockSegmentsOf({
      segments: 4,
      fills: [
        { id: 'a', n: 3, from: 'start', tone: 'accent' },
        { id: 'b', n: 9, from: 'end', tone: 'alt-cool' },
      ],
    })
    expect(full.map(x => x.fill)).toEqual(['a', 'a', 'a', 'b'])
    expect(clockSegmentsOf({ segments: 99, fills: [] })).toHaveLength(24)
    expect(clockSegmentsOf({ segments: 0, fills: [] })).toHaveLength(2)
    expect(
      clockSegmentsOf({
        segments: 3,
        fills: [{ id: 'a', n: -2, from: 'start', tone: 'accent' }],
      }).every(x => x.fill === null)
    ).toBe(true)
  })

  it('com rótulo é uma imagem acessível; sem, fica fora da árvore', () => {
    render(
      <Clock
        segments={20}
        fills={wheel}
        accessibilityLabel="Quintessência 6, Paradoxo 2, de 20 casas"
      />
    )
    expect(
      screen.getByRole('image', {
        name: 'Quintessência 6, Paradoxo 2, de 20 casas',
      })
    ).toBeTruthy()
    screen.unmount()
    render(<Clock segments={20} fills={wheel} testID="clock" size={40} />)
    expect(screen.queryByTestId('clock')).toBeNull()
    expect(
      screen.getAllByTestId('clock-free', { includeHiddenElements: true })
    ).toHaveLength(12)
  })

  it.each(['alt-cool', 'alt-warm', 'neutral'] as const)(
    'tom %s desenha a casa',
    tone => {
      render(
        <Clock
          segments={4}
          fills={[{ id: 'x', n: 2, from: 'start', tone }]}
          testID="clock"
        />
      )
      expect(
        screen.getAllByTestId('clock-x', { includeHiddenElements: true })
      ).toHaveLength(2)
    }
  )
})

describe('Stepper', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  const renderStepper = (
    props: Partial<Parameters<typeof Stepper>[0]> = {}
  ) => {
    const onChange = jest.fn()
    render(
      <Stepper
        label="Sangue"
        value={9}
        min={0}
        max={13}
        onChange={onChange}
        valueText={n => `${n} de 13`}
        testID="stepper"
        {...props}
      />
    )
    return { onChange, el: screen.getByRole('adjustable', { name: 'Sangue' }) }
  }

  it('é adjustable, com valor e texto falado', () => {
    const { el } = renderStepper()
    expect(el).toHaveAccessibilityValue({
      min: 0,
      max: 13,
      now: 9,
      text: '9 de 13',
    })
    expect(el.props.accessibilityActions).toEqual([
      { name: 'increment' },
      { name: 'decrement' },
    ])
  })

  it('increment e decrement do leitor de tela mudam 1', () => {
    const { el, onChange } = renderStepper()
    fireEvent(el, 'accessibilityAction', {
      nativeEvent: { actionName: 'increment' },
    })
    fireEvent(el, 'accessibilityAction', {
      nativeEvent: { actionName: 'decrement' },
    })
    expect(onChange.mock.calls).toEqual([[10], [8]])
  })

  it('respeita os limites', () => {
    const { el, onChange } = renderStepper({ value: 13 })
    fireEvent(el, 'accessibilityAction', {
      nativeEvent: { actionName: 'increment' },
    })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('toque simples muda 1', () => {
    const { onChange } = renderStepper()
    const dec = screen.getByTestId('stepper-dec', {
      includeHiddenElements: true,
    })
    fireEvent.press(dec)
    fireEvent(dec, 'pressOut')
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(8)
  })

  it('segurar repete no visual e grava uma mudança ao soltar', () => {
    const { onChange } = renderStepper({ value: 2 })
    const inc = screen.getByTestId('stepper-inc', {
      includeHiddenElements: true,
    })
    fireEvent(inc, 'longPress')
    act(() => {
      jest.advanceTimersByTime(4 * 100)
    })
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByText('7')).toBeTruthy()
    fireEvent(inc, 'pressOut')
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(7)
  })

  it('desabilitado ignora as ações', () => {
    const { el, onChange } = renderStepper({ disabled: true })
    fireEvent(el, 'accessibilityAction', {
      nativeEvent: { actionName: 'increment' },
    })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('no app, os botões ficam fora do leitor de tela (quem ajusta é o controle)', () => {
    renderStepper()
    expect(screen.queryByTestId('stepper-inc')).toBeNull()
  })

  it('no web: grupo com botões Diminuir e Aumentar de verdade', () => {
    const os = Platform.OS
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true })
    try {
      const onChange = jest.fn()
      render(
        <Stepper
          label="Sangue"
          value={9}
          min={0}
          max={13}
          onChange={onChange}
          valueText={n => `${n} de 13`}
        />
      )
      const more = screen.getByRole('button', { name: 'Aumentar Sangue' })
      fireEvent.press(more)
      expect(onChange).toHaveBeenCalledWith(10)
      expect(
        screen.getByRole('button', { name: 'Diminuir Sangue' })
      ).toBeTruthy()
      expect(screen.getByLabelText('Sangue, 9 de 13')).toBeTruthy()
      expect(screen.queryByRole('adjustable')).toBeNull()
    } finally {
      Object.defineProperty(Platform, 'OS', { value: os, configurable: true })
    }
  })

  it('tocar no valor: ação "activate" no app e botão "Digitar" no web', () => {
    const onValuePress = jest.fn()
    const { el } = renderStepper({ onValuePress })
    expect(el.props.accessibilityActions).toEqual([
      { name: 'increment' },
      { name: 'decrement' },
      { name: 'activate', label: 'Digitar o valor' },
    ])
    fireEvent(el, 'accessibilityAction', {
      nativeEvent: { actionName: 'activate' },
    })
    fireEvent.press(
      screen.getByTestId('stepper-value', { includeHiddenElements: true })
    )
    expect(onValuePress).toHaveBeenCalledTimes(2)

    const os = Platform.OS
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true })
    try {
      const onWeb = jest.fn()
      render(
        <Stepper
          label="Força"
          value={2}
          min={1}
          max={5}
          onChange={jest.fn()}
          onValuePress={onWeb}
        />
      )
      fireEvent.press(screen.getByRole('button', { name: 'Digitar Força' }))
      expect(onWeb).toHaveBeenCalledTimes(1)
    } finally {
      Object.defineProperty(Platform, 'OS', { value: os, configurable: true })
    }
  })

  it('desabilitado, o valor não abre o teclado', () => {
    const onValuePress = jest.fn()
    const { el } = renderStepper({ onValuePress, disabled: true })
    expect(el.props.accessibilityActions).toHaveLength(2)
    expect(
      screen.queryByTestId('stepper-value', { includeHiddenElements: true })
    ).toBeNull()
  })

  it('no sheet, botões de 56', () => {
    renderStepper({ size: 'sheet' })
    expect(
      styleOf(
        screen.getByTestId('stepper-inc', { includeHiddenElements: true })
      ).width
    ).toBe(tokens.size.stepperSize)
  })
})

describe('BottomSheet', () => {
  it('título como heading, fecha pelo botão, pelo fundo e pelo voltar', () => {
    const onClose = jest.fn()
    render(
      <BottomSheet
        visible
        title="Pontos de Sangue"
        onClose={onClose}
        footer={<Button title="Aplicar" onPress={() => undefined} />}
      >
        <RNText>conteúdo</RNText>
      </BottomSheet>
    )
    expect(
      screen.getByRole('header', { name: 'Pontos de Sangue' })
    ).toBeTruthy()
    // O fundo fica fora do modal (inerte para o leitor de tela): só o botão
    // Fechar é acessível; o toque no fundo continua fechando.
    expect(screen.getAllByRole('button', { name: 'Fechar' })).toHaveLength(1)
    for (const button of screen.getAllByLabelText('Fechar', {
      includeHiddenElements: true,
    }))
      fireEvent.press(button)
    fireEvent(screen.UNSAFE_getByType(Modal), 'requestClose')
    expect(onClose).toHaveBeenCalledTimes(3)
    expect(screen.getByRole('button', { name: 'Aplicar' })).toBeTruthy()
  })

  it('com reduzir movimento, abre sem animar', () => {
    render(
      <ThemeProvider reduceMotion>
        <BottomSheet visible title="X" onClose={() => undefined}>
          <RNText>x</RNText>
        </BottomSheet>
      </ThemeProvider>
    )
    expect(screen.UNSAFE_getByType(Modal).props.animationType).toBe('none')
  })
})

describe('Toast', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
  })
  afterEach(() => jest.useRealTimers())

  function Trigger({ onUndo }: { onUndo: () => void }) {
    const toast = useToast()
    return (
      <Button
        title="Gastar"
        onPress={() =>
          toast.show({
            message: 'Sangue 10 → 9',
            action: { label: 'Desfazer', onPress: onUndo },
          })
        }
      />
    )
  }

  const setup = async (reader = false) => {
    jest
      .spyOn(AccessibilityInfo, 'isScreenReaderEnabled')
      .mockResolvedValue(reader)
    const onUndo = jest.fn()
    render(
      <ToastProvider>
        <Trigger onUndo={onUndo} />
      </ToastProvider>
    )
    await act(async () => undefined)
    fireEvent.press(screen.getByRole('button', { name: 'Gastar' }))
    return onUndo
  }

  it('mostra, anuncia e desfaz', async () => {
    const onUndo = await setup()
    expect(screen.getByText('Sangue 10 → 9')).toBeTruthy()
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
      'Sangue 10 → 9'
    )
    fireEvent.press(screen.getByRole('button', { name: 'Desfazer' }))
    expect(onUndo).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Sangue 10 → 9')).toBeNull()
  })

  it(`some em ${TOAST_MS / 1000} s`, async () => {
    await setup()
    act(() => jest.advanceTimersByTime(TOAST_MS - 1))
    expect(screen.getByText('Sangue 10 → 9')).toBeTruthy()
    act(() => jest.advanceTimersByTime(1))
    expect(screen.queryByText('Sangue 10 → 9')).toBeNull()
  })

  it('com leitor de tela, dura mais', async () => {
    await setup(true)
    act(() => jest.advanceTimersByTime(TOAST_MS + 1))
    expect(screen.getByText('Sangue 10 → 9')).toBeTruthy()
    act(() => jest.advanceTimersByTime(TOAST_SCREEN_READER_MS))
    expect(screen.queryByText('Sangue 10 → 9')).toBeNull()
  })

  it('useToast fora do provider é erro de programação', () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
    function Orphan() {
      useToast()
      return null
    }
    expect(() => render(<Orphan />)).toThrow('ToastProvider')
  })
})

describe('Banner, EmptyState e Skeleton', () => {
  it.each([
    ['danger', 'alert'],
    ['warning', 'alert'],
    ['info', 'summary'],
    ['success', 'summary'],
  ] as const)('banner %s tem papel %s', (tone, role) => {
    render(
      <Banner tone={tone} title="Offline" message="2 pendentes" testID="b" />
    )
    expect(screen.getByTestId('b').props.accessibilityRole).toBe(role)
    expect(screen.getByText('2 pendentes')).toBeTruthy()
  })

  it('estado vazio com título e ações', () => {
    render(
      <EmptyState
        title="Você ainda não participa de nenhuma crônica"
        message="Crie uma crônica ou entre com um convite."
        actions={<Button title="Criar crônica" onPress={() => undefined} />}
      />
    )
    expect(
      screen.getByRole('header', {
        name: 'Você ainda não participa de nenhuma crônica',
      })
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Criar crônica' })).toBeTruthy()
  })

  it('skeleton é um elemento ocupado', () => {
    render(<Skeleton testID="s" />)
    const s = screen.getByTestId('s')
    expect(s).toBeBusy()
    expect(s.props.accessibilityLabel).toBe('Carregando')
  })
})

describe('TextField, TextArea e Choice', () => {
  it('rótulo, contador e digitação', () => {
    const onChangeText = jest.fn()
    render(
      <TextField
        label="Nome"
        value="Helena"
        onChangeText={onChangeText}
        maxLength={80}
        testID="name"
      />
    )
    const input = screen.getByTestId('name')
    expect(input.props.accessibilityLabel).toBe('Nome')
    expect(screen.getByText('6/80')).toBeTruthy()
    fireEvent.changeText(input, 'Helena Varga')
    expect(onChangeText).toHaveBeenCalledWith('Helena Varga')
  })

  it('erro é anunciado e vira dica do campo', () => {
    render(
      <TextField
        label="Nome"
        value=""
        onChangeText={() => undefined}
        error="Informe o nome"
        testID="name"
      />
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Informe o nome')
    expect(screen.getByTestId('name').props.accessibilityHint).toBe(
      'Informe o nome'
    )
  })

  it('área de texto é multilinha', () => {
    render(
      <TextArea
        label="Notas"
        value=""
        onChangeText={() => undefined}
        testID="t"
        hint="Só você e o narrador leem"
      />
    )
    expect(screen.getByTestId('t').props.multiline).toBe(true)
    expect(screen.getByText('Só você e o narrador leem')).toBeTruthy()
  })

  it('escolha única: radiogroup com o marcado', () => {
    const onChange = jest.fn()
    render(
      <Choice
        label="Clã"
        value="tremere"
        onChange={onChange}
        options={[
          { id: 'brujah', label: 'Brujah' },
          { id: 'tremere', label: 'Tremere', meta: 'Feiticeiros' },
        ]}
      />
    )
    expect(screen.getByLabelText('Clã').props.accessibilityRole).toBe(
      'radiogroup'
    )
    expect(
      screen.getByRole('radio', { name: 'Tremere, Feiticeiros' })
    ).toBeChecked()
    const brujah = screen.getByRole('radio', { name: 'Brujah' })
    expect(brujah).not.toBeChecked()
    fireEvent.press(brujah)
    expect(onChange).toHaveBeenCalledWith('brujah')
    expect(styleOf(brujah).minHeight).toBeGreaterThanOrEqual(HIT)
    // Poucas opções: uma coluna
    expect(styleOf(screen.getByLabelText('Clã')).flexWrap).toBeUndefined()
  })

  it('a partir de 8 opções, duas colunas', () => {
    const options = Array.from({ length: 8 }, (_, i) => ({
      id: `c${i}`,
      label: `Clã ${i}`,
    }))
    render(
      <Choice label="Clã" value={null} onChange={jest.fn()} options={options} />
    )
    expect(styleOf(screen.getByLabelText('Clã')).flexWrap).toBe('wrap')
    expect(styleOf(screen.getByRole('radio', { name: 'Clã 0' })).width).toBe(
      '50%'
    )
  })
})

describe('listas e navegação', () => {
  it('cabeçalho de seção e de grupo', () => {
    render(
      <>
        <SectionHeader title="Atributos" subtitle="7/5/3" />
        <SectionHeader title="Físicos" level="group" />
      </>
    )
    expect(screen.getByRole('header', { name: 'Atributos' })).toBeTruthy()
    expect(screen.getByRole('header', { name: 'Físicos' })).toHaveStyle({
      fontSize: 17,
    })
  })

  it('item de lista tocável junta o texto no nome acessível', () => {
    const onPress = jest.fn()
    render(
      <ListItem
        title="Crônica da Liberdade"
        subtitle="Vampiro: A Máscara"
        meta="3 personagens"
        leading={<Avatar name="Crônica da Liberdade" />}
        onPress={onPress}
      />
    )
    const item = screen.getByRole('button', {
      name: 'Crônica da Liberdade, Vampiro: A Máscara, 3 personagens',
    })
    fireEvent.press(item)
    expect(onPress).toHaveBeenCalled()
  })

  it('item sem ação é um elemento só, sem papel de botão', () => {
    render(<ListItem title="Helena" testID="li" />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByTestId('li').props.accessibilityLabel).toBe('Helena')
  })

  it('app bar: título como heading e voltar com o destino', () => {
    const onBack = jest.fn()
    render(
      <AppBar
        title="Helena Varga"
        back={{ label: 'Crônica da Liberdade', onPress: onBack }}
        actions={
          <IconButton label="Mais opções" glyph="⋯" onPress={() => undefined} />
        }
      />
    )
    expect(screen.getByRole('header', { name: 'Helena Varga' })).toBeTruthy()
    fireEvent.press(
      screen.getByRole('button', { name: 'Voltar para Crônica da Liberdade' })
    )
    expect(onBack).toHaveBeenCalled()
  })

  it('avatar com iniciais, decorativo', () => {
    expect(initials('  helena   varga  silva')).toBe('HV')
    expect(initials('')).toBe('')
    render(<Avatar name="Beto Sombra" size="lg" />)
    expect(screen.queryByText('BS')).toBeNull()
    expect(screen.getByText('BS', { includeHiddenElements: true })).toBeTruthy()
  })

  it('tela com o fundo do tema', () => {
    render(
      <ThemeProvider preference="pergaminho">
        <Screen testID="screen" safe={false}>
          <RNText>x</RNText>
        </Screen>
      </ThemeProvider>
    )
    expect(screen.getByTestId('screen')).toHaveStyle({
      backgroundColor: tokens.color.pergaminho.bg,
    })
  })

  it('dentro de within', () => {
    render(
      <ListItem
        title="Helena"
        trailing={<Chip label="Tremere" />}
        testID="li"
      />
    )
    expect(within(screen.getByTestId('li')).getByText('Tremere')).toBeTruthy()
  })
})
