import { act, fireEvent, render, screen } from '@testing-library/react-native'
import {
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  Platform,
  Text as RNText,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native'
import { SafeAreaInsetsContext } from 'react-native-safe-area-context'
import {
  AppBar,
  BottomSheet,
  KeyboardArea,
  keyboardBehavior,
  Screen,
  TextField,
} from './index'

// P08 (onda 2): layout e teclado nos primitivos do @tms/ui. Cada caso é a
// regressão de um achado da matriz (doc/testes/2026-11-01/matriz-achados.md).

const styleOf = (el: { props: { style?: unknown } }): ViewStyle =>
  (StyleSheet.flatten(el.props.style as ViewStyle) ?? {}) as ViewStyle

type Node = { type: unknown; parent: Node | null; props: { style?: unknown } }
// O primeiro View hospedeiro acima de um elemento
const hostViewAbove = (el: Node): Node => {
  let at = el.parent
  while (at && at.type !== 'View') at = at.parent
  if (!at) throw new Error('sem View acima')
  return at
}

type OS = typeof Platform.OS
function withOS<T>(os: OS, run: () => T): T {
  const previous = Platform.OS
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true })
  try {
    return run()
  } finally {
    Object.defineProperty(Platform, 'OS', {
      value: previous,
      configurable: true,
    })
  }
}

const INSETS = { top: 47, right: 0, bottom: 34, left: 0 }

describe('T-37: a safe area aplicada uma vez', () => {
  it('o Screen soma o inset de cima e de baixo; a AppBar dentro dele não soma de novo', () => {
    render(
      <SafeAreaInsetsContext.Provider value={INSETS}>
        <Screen testID="screen">
          <AppBar title="Crônicas" />
          <RNText>conteúdo</RNText>
        </Screen>
      </SafeAreaInsetsContext.Provider>
    )
    const screenStyle = styleOf(screen.getByTestId('screen'))
    expect(screenStyle.paddingTop).toBe(47)
    expect(screenStyle.paddingBottom).toBe(34)
    // A barra: o primeiro View acima do título com a altura do cabeçalho
    let bar = hostViewAbove(
      screen.getByRole('header', { name: 'Crônicas' }) as unknown as Node
    )
    while (styleOf(bar).minHeight === undefined) bar = hostViewAbove(bar)
    const barStyle = styleOf(bar)
    expect(barStyle.paddingTop).toBeUndefined()
    expect(barStyle.minHeight).toBe(48)
  })
})

describe('T-64: contador do campo sem colar na dica nem sair da tela', () => {
  it('com dica e maxLength: a dica ocupa o resto e quebra, o contador não encolhe', () => {
    render(
      <TextField
        label="Nome de usuário"
        value="helena"
        onChangeText={() => undefined}
        hint="De 3 a 24 caracteres: letras minúsculas, números e _"
        maxLength={24}
        testID="username"
      />
    )
    const hint = screen.getByText(
      'De 3 a 24 caracteres: letras minúsculas, números e _'
    )
    expect(styleOf(hint).flex).toBe(1)
    const counter = screen.getByLabelText('6 de 24 caracteres')
    expect(styleOf(counter).flexShrink).toBe(0)
    const row = hostViewAbove(counter as unknown as Node)
    expect(styleOf(row).gap).toBe(8)
    expect(styleOf(row).alignItems).toBe('flex-start')
  })

  it('o erro também quebra ao lado do contador', () => {
    render(
      <TextField
        label="Retrato"
        value="http://x"
        onChangeText={() => undefined}
        error="Use um endereço https://"
        maxLength={2}
        testID="portrait"
      />
    )
    expect(styleOf(screen.getByRole('alert')).flex).toBe(1)
    expect(styleOf(screen.getByLabelText('8 de 2 caracteres')).flexShrink).toBe(
      0
    )
  })

  it('sem dica, só o contador, à direita como antes', () => {
    render(
      <TextField
        label="Nome"
        value=""
        onChangeText={() => undefined}
        maxLength={80}
      />
    )
    expect(screen.getByLabelText('0 de 80 caracteres')).toBeTruthy()
  })
})

describe('T-10: a folha acompanha o teclado no Android', () => {
  it('keyboardBehavior: padding no iOS e no Android; nada no web', () => {
    expect(withOS('ios', keyboardBehavior)).toBe('padding')
    expect(withOS('android', keyboardBehavior)).toBe('padding')
    expect(withOS('web', keyboardBehavior)).toBeUndefined()
  })

  const sheetRootBehavior = () => {
    render(
      <BottomSheet visible title="Conceito" onClose={() => undefined}>
        <TextField label="Conceito" value="" onChangeText={() => undefined} />
      </BottomSheet>
    )
    return screen.UNSAFE_getByType(KeyboardAvoidingView).props.behavior
  }

  it.each([
    ['android', 'padding'],
    ['ios', 'padding'],
    ['web', undefined],
  ] as const)('no %s, a raiz da folha usa behavior %s', (os, expected) => {
    expect(withOS(os, sheetRootBehavior)).toBe(expected)
  })

  it('KeyboardArea: flex 1, sem padding com o teclado fechado', () => {
    withOS('android', () =>
      render(
        <KeyboardArea testID="area" style={{ padding: 4 }}>
          <RNText>campo</RNText>
        </KeyboardArea>
      )
    )
    expect(styleOf(screen.getByTestId('area'))).toEqual({
      flex: 1,
      padding: 4,
    })
    expect(screen.getByText('campo')).toBeTruthy()
  })

  // A área está a 95 da janela (cabeçalho e safe area acima), com 700 de
  // altura; o teclado começa em 500: cobre 295 dela
  const keyboardOn = (os: OS) => {
    const listeners = new Map<string, (e: unknown) => void>()
    const add = jest.spyOn(Keyboard, 'addListener').mockImplementation(((
      event: string,
      fn: (e: unknown) => void
    ) => {
      listeners.set(event, fn)
      return { remove: () => listeners.delete(event) }
    }) as never)
    const measure = jest
      .spyOn(View.prototype as never, 'measureInWindow' as never)
      .mockImplementation(((
        cb: (x: number, y: number, w: number, h: number) => void
      ) => cb(0, 95, 390, 700)) as never)
    const { unmount } = withOS(os, () =>
      render(
        <KeyboardArea testID="area">
          <RNText>campo</RNText>
        </KeyboardArea>
      )
    )
    return {
      emit: (event: string, e: unknown = {}) =>
        act(() => listeners.get(event)?.(e)),
      listeners,
      unmount,
      restore: () => {
        add.mockRestore()
        measure.mockRestore()
      },
    }
  }

  it('KeyboardArea no Android: encolhe o que o teclado cobre, medido quando ele abre', () => {
    const k = keyboardOn('android')
    try {
      k.emit('keyboardDidShow', { endCoordinates: { screenY: 500 } })
      expect(styleOf(screen.getByTestId('area')).paddingBottom).toBe(295)
      k.emit('keyboardDidHide')
      expect(styleOf(screen.getByTestId('area')).paddingBottom).toBeUndefined()
      k.unmount()
      expect(k.listeners.size).toBe(0)
    } finally {
      k.restore()
    }
  })

  it('KeyboardArea no iOS: antes de o teclado abrir, com a animação dele', () => {
    const configure = jest
      .spyOn(LayoutAnimation, 'configureNext')
      .mockImplementation(() => undefined)
    const k = keyboardOn('ios')
    try {
      k.emit('keyboardWillShow', {
        endCoordinates: { screenY: 900 },
        duration: 250,
      })
      // O teclado não cobre a área: nada a encolher
      expect(styleOf(screen.getByTestId('area')).paddingBottom).toBeUndefined()
      expect(configure).toHaveBeenCalled()
      k.emit('keyboardWillHide')
    } finally {
      k.restore()
      configure.mockRestore()
    }
  })

  it('KeyboardArea no web: não escuta o teclado', () => {
    const add = jest.spyOn(Keyboard, 'addListener')
    try {
      withOS('web', () =>
        render(
          <KeyboardArea testID="area">
            <RNText>campo</RNText>
          </KeyboardArea>
        )
      )
      expect(add).not.toHaveBeenCalled()
    } finally {
      add.mockRestore()
    }
  })

  it('o Esc no web continua fechando a folha (T-71)', () => {
    const onClose = jest.fn()
    withOS('web', () => {
      render(
        <BottomSheet visible title="Conceito" onClose={onClose}>
          <RNText>x</RNText>
        </BottomSheet>
      )
      fireEvent(screen.getByTestId('bottom-sheet-root'), 'keyDownCapture', {
        nativeEvent: { key: 'Escape' },
        preventDefault: () => undefined,
      })
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('T-69: folha como diálogo central a partir de 600', () => {
  const PHONE = { width: 390, height: 844, scale: 3, fontScale: 1 }
  const DESKTOP = { width: 1280, height: 800, scale: 1, fontScale: 1 }
  const TABLET = { width: 750, height: 1334, scale: 2, fontScale: 1 }
  afterEach(() => {
    act(() => Dimensions.set({ window: TABLET, screen: TABLET }))
  })

  const renderSheet = (onClose = jest.fn()) => {
    render(
      <SafeAreaInsetsContext.Provider value={INSETS}>
        <BottomSheet visible title="Convidar" onClose={onClose} testID="sheet">
          <RNText>conteúdo</RNText>
        </BottomSheet>
      </SafeAreaInsetsContext.Provider>
    )
    return {
      root: styleOf(screen.UNSAFE_getByType(KeyboardAvoidingView)),
      sheet: styleOf(screen.getByTestId('sheet')),
      animation: screen.UNSAFE_getByType(Modal).props.animationType,
    }
  }

  it('a 1280: raiz centralizada, folha de até 560 com cantos redondos, fade e sem o inset de baixo', () => {
    Dimensions.set({ window: DESKTOP, screen: DESKTOP })
    const { root, sheet, animation } = renderSheet()
    expect(root).toMatchObject({
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    })
    expect(sheet).toMatchObject({
      width: '100%',
      maxWidth: 560,
      maxHeight: '85%',
      borderRadius: 16,
      paddingBottom: 20,
    })
    expect(animation).toBe('fade')
  })

  it('a 390: presa embaixo, cantos de cima, slide e com o inset de baixo', () => {
    Dimensions.set({ window: PHONE, screen: PHONE })
    const { root, sheet, animation } = renderSheet()
    expect(root.justifyContent).toBe('flex-end')
    expect(root.alignItems).toBeUndefined()
    expect(sheet.maxWidth).toBeUndefined()
    expect(sheet).toMatchObject({
      maxHeight: '90%',
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      paddingBottom: 20 + 34,
    })
    expect(animation).toBe('slide')
  })

  it.each([
    ['390', PHONE],
    ['1280', DESKTOP],
  ])('a %s, o Esc no web continua fechando (T-71)', (_, size) => {
    Dimensions.set({ window: size, screen: size })
    const onClose = jest.fn()
    withOS('web', () => {
      renderSheet(onClose)
      fireEvent(screen.getByTestId('bottom-sheet-root'), 'keyDownCapture', {
        nativeEvent: { key: 'Escape' },
        preventDefault: () => undefined,
      })
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('T-11: cabeçalho que cabe, com o lugar do estado', () => {
  const PHONE = { width: 390, height: 844, scale: 3, fontScale: 1 }
  const TABLET = { width: 750, height: 1334, scale: 2, fontScale: 1 }
  afterEach(() => {
    act(() => Dimensions.set({ window: TABLET, screen: TABLET }))
  })

  it('subtitle: uma linha sob o título, na mesma coluna, que encolhe', () => {
    render(
      <AppBar
        title="Helena Varga"
        subtitle={<RNText>Aguardando aprovação</RNText>}
      />
    )
    const title = screen.getByRole('header', { name: 'Helena Varga' })
    const subtitle = screen.getByTestId('app-bar-subtitle')
    const column = hostViewAbove(title as unknown as Node)
    expect(hostViewAbove(subtitle as unknown as Node)).toBe(column)
    expect(styleOf(column)).toMatchObject({ flex: 1, minWidth: 0 })
    expect(screen.getByText('Aguardando aprovação')).toBeTruthy()
  })

  it('sem subtitle, nada a mais', () => {
    render(<AppBar title="Crônicas" />)
    expect(screen.queryByTestId('app-bar-subtitle')).toBeNull()
  })

  it('o voltar fica com até 96 no celular e 160 fora dele; o nome acessível é o mesmo', () => {
    const back = { label: 'Crônica da Liberdade', onPress: () => undefined }
    act(() => Dimensions.set({ window: PHONE, screen: PHONE }))
    render(<AppBar title="Helena" back={back} />)
    const link = screen.getByRole('button', {
      name: 'Voltar para Crônica da Liberdade',
    })
    expect(styleOf(link).maxWidth).toBe(96)
    screen.unmount()
    act(() => Dimensions.set({ window: TABLET, screen: TABLET }))
    render(<AppBar title="Helena" back={back} />)
    expect(
      styleOf(
        screen.getByRole('button', { name: 'Voltar para Crônica da Liberdade' })
      ).maxWidth
    ).toBe(160)
  })
})

describe('BottomSheet.onClosed: a folha seguinte abre depois que esta sai', () => {
  const sheet = (visible: boolean, onClosed: () => void) => (
    <BottomSheet
      visible={visible}
      title="Mais opções"
      onClose={() => undefined}
      onClosed={onClosed}
    >
      <RNText>itens</RNText>
    </BottomSheet>
  )

  it('iOS e web: no onDismiss do Modal, depois de um tick', async () => {
    const onClosed = jest.fn()
    const { rerender } = render(sheet(true, onClosed))
    rerender(sheet(false, onClosed))
    expect(onClosed).not.toHaveBeenCalled()
    fireEvent(screen.UNSAFE_getByType(Modal), 'dismiss')
    expect(onClosed).not.toHaveBeenCalled()
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    expect(onClosed).toHaveBeenCalledTimes(1)
  })

  it('Android: sem onDismiss, assim que fica invisível', () => {
    const onClosed = jest.fn()
    withOS('android', () => {
      const { rerender } = render(sheet(true, onClosed))
      rerender(sheet(false, onClosed))
    })
    expect(onClosed).toHaveBeenCalledTimes(1)
  })
})
