// Acessibilidade dos componentes compartilhados (P06 da onda 1). Os ramos do
// web e do Android rodam com o Platform.OS trocado, como em components.test.
import {
  fireEvent,
  render,
  renderHook,
  screen,
} from '@testing-library/react-native'
import { createRef, useLayoutEffect } from 'react'
import {
  Modal,
  Platform,
  Text as RNText,
  StyleSheet,
  type TextInputInstance,
  type ViewStyle,
} from 'react-native'
import {
  BottomSheet,
  Button,
  Chip,
  Choice,
  hitTarget,
  ListItem,
  Pressable,
  rovingTarget,
  Skeleton,
  Stepper,
  TabPanel,
  Tabs,
  TextField,
  tokens,
  useRovingFocus,
} from './index'
import { joinHints, markSoftDisabled } from './Stepper'

const realOS = Platform.OS
const setOS = (os: string) =>
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true })
afterEach(() => setOS(realOS))

const key = (
  k: string,
  extra: {
    repeat?: boolean
    altKey?: boolean
    ctrlKey?: boolean
    metaKey?: boolean
    shiftKey?: boolean
    // Tecla que sobe de um descendente: alvo diferente do elemento
    fromChild?: boolean
  } = {}
) => {
  const preventDefault = jest.fn()
  const { fromChild, ...mods } = extra
  const self = {}
  return {
    event: {
      nativeEvent: { key: k, repeat: false, ...mods },
      preventDefault,
      ...(fromChild ? { target: {}, currentTarget: self } : {}),
    },
    preventDefault,
  }
}

describe('Pressable: Espaço nos papéis que não são botão (T-35)', () => {
  it.each(['radio', 'tab', 'switch', 'checkbox'] as const)(
    'no web, %s ativa com Espaço e a página não rola',
    role => {
      setOS('web')
      const onPress = jest.fn()
      render(
        <Pressable
          accessibilityRole={role}
          accessibilityLabel="Item"
          onPress={onPress}
        />
      )
      const { event, preventDefault } = key(' ')
      fireEvent(screen.getByLabelText('Item'), 'keyDown', event)
      expect(onPress).toHaveBeenCalledTimes(1)
      expect(preventDefault).toHaveBeenCalled()
    }
  )

  it('o papel também vem de `role`', () => {
    setOS('web')
    const onPress = jest.fn()
    render(
      <Pressable role="switch" accessibilityLabel="Oculta" onPress={onPress} />
    )
    fireEvent(screen.getByLabelText('Oculta'), 'keyDown', key(' ').event)
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('botão fica com o react-native-web (sem disparo duplo)', () => {
    setOS('web')
    const onPress = jest.fn()
    render(
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Salvar"
        onPress={onPress}
      />
    )
    fireEvent(screen.getByLabelText('Salvar'), 'keyDown', key(' ').event)
    expect(onPress).not.toHaveBeenCalled()
  })

  it('tecla repetida, desabilitado e outras teclas não ativam', () => {
    setOS('web')
    const onPress = jest.fn()
    const onKeyDown = jest.fn()
    const { rerender } = render(
      <Pressable
        accessibilityRole="radio"
        accessibilityLabel="Opção"
        onPress={onPress}
        onKeyDown={onKeyDown}
      />
    )
    const el = () => screen.getByLabelText('Opção')
    fireEvent(el(), 'keyDown', key(' ', { repeat: true }).event)
    fireEvent(el(), 'keyDown', key('a').event)
    expect(onKeyDown).toHaveBeenCalledTimes(2)
    rerender(
      <Pressable
        accessibilityRole="radio"
        accessibilityLabel="Opção"
        onPress={onPress}
        disabled
      />
    )
    fireEvent(el(), 'keyDown', key(' ').event)
    expect(onPress).not.toHaveBeenCalled()
  })

  it('tecla presa: a página não rola, mas a ação não repete', () => {
    setOS('web')
    const onPress = jest.fn()
    render(
      <Pressable
        accessibilityRole="switch"
        accessibilityLabel="Oculta"
        onPress={onPress}
      />
    )
    const { event, preventDefault } = key(' ', { repeat: true })
    fireEvent(screen.getByLabelText('Oculta'), 'keyDown', event)
    expect(preventDefault).toHaveBeenCalled()
    expect(onPress).not.toHaveBeenCalled()
  })

  it('Espaço de um descendente focável não é do Pressable', () => {
    setOS('web')
    const onPress = jest.fn()
    render(
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel="Linha"
        onPress={onPress}
      />
    )
    const { event, preventDefault } = key(' ', { fromChild: true })
    fireEvent(screen.getByLabelText('Linha'), 'keyDown', event)
    expect(preventDefault).not.toHaveBeenCalled()
    expect(onPress).not.toHaveBeenCalled()
  })

  it('no app, nada muda: o Espaço é do sistema', () => {
    setOS('ios')
    const onPress = jest.fn()
    render(
      <Pressable
        accessibilityRole="radio"
        accessibilityLabel="Opção"
        onPress={onPress}
      />
    )
    expect(screen.getByLabelText('Opção').props.onKeyDown).toBeUndefined()
  })
})

describe('useRovingFocus (T-35)', () => {
  it.each([
    ['Alt+←', { altKey: true }],
    ['Cmd+←', { metaKey: true }],
    ['Ctrl+←', { ctrlKey: true }],
    ['Shift+←', { shiftKey: true }],
    ['← de um descendente', { fromChild: true }],
  ] as const)(
    '%s não é do grupo: sem preventDefault, sem mover',
    (_, extra) => {
      setOS('web')
      const onActivate = jest.fn()
      const { result } = renderHook(() =>
        useRovingFocus({ count: 3, active: 1, activate: 'focus', onActivate })
      )
      const items = [0, 1, 2].map(i => result.current(i))
      const nodes = items.map(() => ({ focus: jest.fn() }))
      items.forEach((p, i) => p.ref?.(nodes[i]))
      const { event, preventDefault } = key('ArrowLeft', extra)
      items[1]?.onKeyDown?.(event as never)
      expect(preventDefault).not.toHaveBeenCalled()
      expect(nodes[0]?.focus).not.toHaveBeenCalled()
      expect(onActivate).not.toHaveBeenCalled()
    }
  )

  it('Shift não bloqueia Home e End (só as setas)', () => {
    setOS('web')
    const { result } = renderHook(() => useRovingFocus({ count: 2, active: 0 }))
    const items = [0, 1].map(i => result.current(i))
    const node = { focus: jest.fn() }
    items[1]?.ref?.(node)
    items[0]?.onKeyDown?.(key('End', { shiftKey: true }).event as never)
    expect(node.focus).toHaveBeenCalled()
  })

  it('rovingTarget: setas dão a volta; Home e End vão às pontas', () => {
    expect(rovingTarget('ArrowRight', 2, 3)).toBe(0)
    expect(rovingTarget('ArrowLeft', 0, 3)).toBe(2)
    expect(rovingTarget('ArrowDown', 0, 3)).toBe(1)
    expect(rovingTarget('ArrowUp', 1, 3)).toBe(0)
    expect(rovingTarget('Home', 2, 3)).toBe(0)
    expect(rovingTarget('End', 0, 3)).toBe(2)
    expect(rovingTarget('ArrowDown', 0, 3, 'horizontal')).toBeNull()
    expect(rovingTarget('ArrowRight', 0, 3, 'vertical')).toBeNull()
    expect(rovingTarget('ArrowDown', 0, 3, 'vertical')).toBe(1)
    expect(rovingTarget('Tab', 0, 3)).toBeNull()
    expect(rovingTarget('ArrowRight', 0, 0)).toBeNull()
  })

  it('no web: tabIndex 0 só no ativo; a seta move o foco e, com `focus`, seleciona', () => {
    setOS('web')
    const onActivate = jest.fn()
    const { result } = renderHook(() =>
      useRovingFocus({ count: 3, active: 1, activate: 'focus', onActivate })
    )
    const items = [0, 1, 2].map(i => result.current(i))
    expect(items.map(p => p.tabIndex)).toEqual([-1, 0, -1])
    const nodes = items.map(() => ({ focus: jest.fn() }))
    items.forEach((p, i) => p.ref?.(nodes[i]))
    const { event, preventDefault } = key('ArrowRight')
    items[1]?.onKeyDown?.(event as never)
    expect(nodes[2]?.focus).toHaveBeenCalled()
    expect(preventDefault).toHaveBeenCalled()
    expect(onActivate).toHaveBeenCalledWith(2)
  })

  it('com `manual`, a seta só move o foco; tecla de fora não faz nada', () => {
    setOS('web')
    const onActivate = jest.fn()
    const { result } = renderHook(() =>
      useRovingFocus({ count: 2, active: -1, onActivate })
    )
    const items = [0, 1].map(i => result.current(i))
    expect(items.map(p => p.tabIndex)).toEqual([0, -1])
    const node = { focus: jest.fn() }
    items[1]?.ref?.(node)
    items[0]?.onKeyDown?.(key('End').event as never)
    expect(node.focus).toHaveBeenCalled()
    const other = key('a')
    items[0]?.onKeyDown?.(other.event as never)
    expect(other.preventDefault).not.toHaveBeenCalled()
    expect(onActivate).not.toHaveBeenCalled()
  })

  it('no app, não devolve nada', () => {
    setOS('android')
    const { result } = renderHook(() => useRovingFocus({ count: 2, active: 0 }))
    expect(result.current(0)).toEqual({})
  })
})

const CLANS = [
  { id: 'brujah', label: 'Brujah' },
  { id: 'tremere', label: 'Tremere' },
  { id: 'ventrue', label: 'Ventrue' },
]

describe('Choice: título visível, setas e disabled (T-09, T-35)', () => {
  it('mostra o título acima do grupo; com showLabel={false}, não', () => {
    const { rerender } = render(
      <Choice label="Clã" options={CLANS} value={null} onChange={jest.fn()} />
    )
    expect(screen.getByText('Clã')).toBeTruthy()
    expect(screen.getByLabelText('Clã')).toBeTruthy()
    rerender(
      <Choice
        label="Clã"
        options={CLANS}
        value={null}
        onChange={jest.fn()}
        showLabel={false}
      />
    )
    expect(screen.queryByText('Clã')).toBeNull()
    expect(screen.getByLabelText('Clã')).toBeTruthy()
  })

  it('no web, o grupo é nomeado pelo título (aria-labelledby)', () => {
    setOS('web')
    render(
      <Choice label="Clã" options={CLANS} value={null} onChange={jest.fn()} />
    )
    const title = screen.getByText('Clã')
    const group = screen.getByLabelText('Clã')
    expect(title.props.nativeID).toBeTruthy()
    expect(group.props['aria-labelledby']).toBe(title.props.nativeID)
  })

  it('no Android, o título fica fora da árvore (o TalkBack já lê o grupo)', () => {
    setOS('android')
    render(
      <Choice label="Clã" options={CLANS} value={null} onChange={jest.fn()} />
    )
    const title = screen.getByText('Clã', { includeHiddenElements: true })
    expect(title.props['aria-hidden']).toBe(true)
    expect(
      screen.getByLabelText('Clã').props['aria-labelledby']
    ).toBeUndefined()
  })

  it('no web: tabindex itinerante; a seta não escolhe, o Espaço escolhe', () => {
    setOS('web')
    const onChange = jest.fn()
    render(
      <Choice label="Clã" options={CLANS} value="tremere" onChange={onChange} />
    )
    const radios = screen.getAllByRole('radio')
    expect(radios.map(r => r.props.tabIndex)).toEqual([-1, 0, -1])
    fireEvent(
      screen.getByRole('radio', { name: 'Tremere' }),
      'keyDown',
      key('ArrowDown').event
    )
    expect(onChange).not.toHaveBeenCalled()
    fireEvent(
      screen.getByRole('radio', { name: 'Ventrue' }),
      'keyDown',
      key(' ').event
    )
    expect(onChange).toHaveBeenCalledWith('ventrue')
  })

  it('sem nada marcado, o primeiro fica no Tab', () => {
    setOS('web')
    render(
      <Choice label="Clã" options={CLANS} value={null} onChange={jest.fn()} />
    )
    expect(screen.getAllByRole('radio').map(r => r.props.tabIndex)).toEqual([
      0, -1, -1,
    ])
  })

  it('disabled: as opções ficam sem toque', () => {
    const onChange = jest.fn()
    render(
      <Choice
        label="Clã"
        options={CLANS}
        value="brujah"
        onChange={onChange}
        disabled
      />
    )
    const radio = screen.getByRole('radio', { name: 'Tremere' })
    expect(radio).toBeDisabled()
    fireEvent.press(radio)
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('Stepper: o número falado e o rótulo visível (T-34, T-09)', () => {
  it('sem valueText, o texto é o número (o iOS não calcula porcentagem)', () => {
    render(
      <Stepper
        label="Primária"
        value={7}
        min={0}
        max={1000}
        onChange={jest.fn()}
      />
    )
    expect(
      screen.getByRole('adjustable', { name: 'Primária' })
    ).toHaveAccessibilityValue({ text: '7', min: 0, max: 1000, now: 7 })
  })

  it('com valueText, o texto dele', () => {
    render(
      <Stepper
        label="Sangue"
        value={9}
        min={0}
        max={13}
        onChange={jest.fn()}
        valueText={n => `${n} de 13`}
      />
    )
    expect(
      screen.getByRole('adjustable', { name: 'Sangue' })
    ).toHaveAccessibilityValue({ text: '9 de 13' })
  })

  it('showLabel: rótulo visível acima, fora da árvore; o padrão não mostra', () => {
    const { rerender } = render(
      <Stepper label="Dados" value={3} min={1} max={50} onChange={jest.fn()} />
    )
    expect(
      screen.queryByText('Dados', { includeHiddenElements: true })
    ).toBeNull()
    rerender(
      <Stepper
        label="Dados"
        value={3}
        min={1}
        max={50}
        onChange={jest.fn()}
        showLabel
      />
    )
    const title = screen.getByText('Dados', { includeHiddenElements: true })
    expect(title.props['aria-hidden']).toBe(true)
    expect(screen.queryByText('Dados')).toBeNull()
    expect(screen.getByRole('adjustable', { name: 'Dados' })).toBeTruthy()
  })
})

// T-20 (P05-C): o "+" mostra a trava antes do toque, sem tirar o toque. A
// previsão da conta pode errar para o lado bloqueado; quem decide é o toque.
describe('Stepper: "+" indisponível e dica (T-20)', () => {
  const renderBlocked = (increase = {}, onChange = jest.fn()) => {
    render(
      <Stepper
        label="Raciocínio"
        value={4}
        min={1}
        max={5}
        onChange={onChange}
        testID="wits"
        increase={{
          blocked: true,
          hint: 'Mentais: os 3 pontos básicos já foram usados.',
          hintID: 'notice-wits',
          ...increase,
        }}
      />
    )
    return onChange
  }
  const flat = (el: { props: { style?: unknown } }): ViewStyle =>
    StyleSheet.flatten(
      typeof el.props.style === 'function'
        ? (el.props.style as (s: { pressed: boolean }) => ViewStyle)({
            pressed: false,
          })
        : (el.props.style as ViewStyle)
    ) ?? {}

  it('no web: o "+" bloqueado é aria-disabled, apagado, aponta a dica e continua tocável', () => {
    setOS('web')
    const onChange = renderBlocked()
    const more = screen.getByRole('button', { name: 'Aumentar Raciocínio' })
    // Nenhuma prop que o react-native-web transforme em `disabled` no
    // <button>: o aria-disabled vai direto no elemento (markSoftDisabled)
    expect(more.props.accessibilityDisabled).toBeUndefined()
    expect(more.props.accessibilityState).toMatchObject({ disabled: false })
    expect(more.props['aria-describedby']).toBe('notice-wits')
    expect(flat(more).opacity).toBe(0.5)
    fireEvent.press(more)
    expect(onChange).toHaveBeenCalledWith(5)
    // O "−" não muda
    const less = screen.getByRole('button', { name: 'Diminuir Raciocínio' })
    expect(less.props.accessibilityDisabled).toBeUndefined()
    expect(less.props['aria-describedby']).toBeUndefined()
  })

  it('segurar o "+" bloqueado não repete nem grava; o "−" continua', () => {
    setOS('web')
    const onChange = renderBlocked()
    const more = screen.getByRole('button', { name: 'Aumentar Raciocínio' })
    fireEvent(more, 'longPress')
    fireEvent(more, 'pressOut')
    expect(onChange).not.toHaveBeenCalled()
    const less = screen.getByRole('button', { name: 'Diminuir Raciocínio' })
    fireEvent(less, 'longPress')
    fireEvent(less, 'pressOut')
    expect(onChange).toHaveBeenCalledWith(3)
  })

  it('no app: a dica vai para o controle ajustável, e o incremento chega ao onChange', () => {
    setOS('ios')
    const onChange = renderBlocked()
    const control = screen.getByRole('adjustable', { name: 'Raciocínio' })
    expect(control.props.accessibilityHint).toBe(
      'Mentais: os 3 pontos básicos já foram usados.'
    )
    fireEvent(control, 'accessibilityAction', {
      nativeEvent: { actionName: 'increment' },
    })
    expect(onChange).toHaveBeenCalledWith(5)
    // O botão visual também fica apagado, e o toque chega
    const more = screen.getByTestId('wits-inc', { includeHiddenElements: true })
    expect(flat(more).opacity).toBe(0.5)
  })

  it('só o custo: o "+" fica normal e a dica diz quanto custa', () => {
    setOS('android')
    renderBlocked({ blocked: false, hint: '+1 = 2 bônus', hintID: null })
    const control = screen.getByRole('adjustable', { name: 'Raciocínio' })
    expect(control.props.accessibilityHint).toBe('+1 = 2 bônus')
    const more = screen.getByTestId('wits-inc', { includeHiddenElements: true })
    expect(flat(more).opacity).toBeUndefined()
  })

  it('no máximo, o "+" fica desabilitado de verdade, com ou sem previsão', () => {
    setOS('web')
    render(
      <Stepper
        label="Raciocínio"
        value={5}
        min={1}
        max={5}
        onChange={jest.fn()}
        increase={{ blocked: true }}
      />
    )
    const more = screen.getByRole('button', { name: 'Aumentar Raciocínio' })
    expect(more).toBeDisabled()
    expect(more.props.accessibilityDisabled).toBeUndefined()
  })

  it('sem `increase`, nada muda', () => {
    setOS('web')
    render(
      <Stepper
        label="Raciocínio"
        value={4}
        min={1}
        max={5}
        onChange={jest.fn()}
      />
    )
    const more = screen.getByRole('button', { name: 'Aumentar Raciocínio' })
    expect(more).toBeEnabled()
    expect(more.props.accessibilityDisabled).toBeUndefined()
    expect(more.props['aria-describedby']).toBeUndefined()
  })
})

// T-85 (P10-C): o "−" ganha a mesma previsão do "+". Sem `decrease`, nada
// muda; com ele, tocável, apagado, sem repetir, e a dica junta os dois lados.
describe('Stepper: "−" indisponível e dica (T-85)', () => {
  const DOWN = 'na criação, não fica abaixo de 5 (vem de Augúrio: Ahroun).'
  const renderDown = (props: Partial<Parameters<typeof Stepper>[0]> = {}) => {
    const onChange = jest.fn()
    render(
      <Stepper
        label="Fúria permanente"
        value={5}
        min={1}
        max={10}
        onChange={onChange}
        testID="rage"
        decrease={{ blocked: true, hint: DOWN, hintID: 'notice-rage' }}
        {...props}
      />
    )
    return onChange
  }
  const opacity = (el: { props: { style?: unknown } }) =>
    StyleSheet.flatten(
      typeof el.props.style === 'function'
        ? (el.props.style as (s: { pressed: boolean }) => ViewStyle)({
            pressed: false,
          })
        : (el.props.style as ViewStyle)
    )?.opacity

  it('no web: o "−" bloqueado fica tocável, apagado e aponta a dica; o "+" não muda', () => {
    setOS('web')
    const onChange = renderDown()
    const less = screen.getByRole('button', {
      name: 'Diminuir Fúria permanente',
    })
    expect(less.props.accessibilityDisabled).toBeUndefined()
    expect(less.props.accessibilityState).toMatchObject({ disabled: false })
    expect(less.props['aria-describedby']).toBe('notice-rage')
    expect(opacity(less)).toBe(0.5)
    fireEvent.press(less)
    expect(onChange).toHaveBeenCalledWith(4)
    const more = screen.getByRole('button', {
      name: 'Aumentar Fúria permanente',
    })
    expect(more.props['aria-describedby']).toBeUndefined()
    expect(opacity(more)).toBeUndefined()
  })

  it('segurar o "−" bloqueado não repete nem grava', () => {
    setOS('web')
    const onChange = renderDown()
    const less = screen.getByRole('button', {
      name: 'Diminuir Fúria permanente',
    })
    fireEvent(less, 'longPress')
    fireEvent(less, 'pressOut')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('no app: as duas previsões numa dica só, com o lado de cada uma', () => {
    setOS('ios')
    const onChange = renderDown({
      increase: { blocked: false, hint: '+1 = 1 bônus' },
    })
    const control = screen.getByRole('adjustable', { name: 'Fúria permanente' })
    expect(control.props.accessibilityHint).toBe(
      `Aumentar: +1 = 1 bônus. Diminuir: ${DOWN}`
    )
    fireEvent(control, 'accessibilityAction', {
      nativeEvent: { actionName: 'decrement' },
    })
    expect(onChange).toHaveBeenCalledWith(4)
    const less = screen.getByTestId('rage-dec', { includeHiddenElements: true })
    expect(opacity(less)).toBe(0.5)
  })

  it('só o "−" com dica: ela sozinha, sem prefixo', () => {
    setOS('android')
    renderDown()
    expect(
      screen.getByRole('adjustable', { name: 'Fúria permanente' }).props
        .accessibilityHint
    ).toBe(DOWN)
  })

  it('no mínimo, o "−" fica desabilitado de verdade, com ou sem previsão', () => {
    setOS('web')
    renderDown({ value: 1 })
    expect(
      screen.getByRole('button', { name: 'Diminuir Fúria permanente' })
    ).toBeDisabled()
  })

  it('sem `decrease`, nada muda no "−"', () => {
    setOS('web')
    render(
      <Stepper label="Fúria" value={5} min={1} max={10} onChange={jest.fn()} />
    )
    const less = screen.getByRole('button', { name: 'Diminuir Fúria' })
    expect(less).toBeEnabled()
    expect(less.props['aria-describedby']).toBeUndefined()
    expect(opacity(less)).toBeUndefined()
  })
})

describe('joinHints', () => {
  it('junta com ponto, não duplica o ponto e deixa só o que houver', () => {
    expect(joinHints('+1 = 1 bônus', 'não desce')).toBe(
      'Aumentar: +1 = 1 bônus. Diminuir: não desce'
    )
    expect(joinHints('cheio.', 'não desce')).toBe(
      'Aumentar: cheio. Diminuir: não desce'
    )
    expect(joinHints('só o +', null)).toBe('só o +')
    expect(joinHints(undefined, 'só o −')).toBe('só o −')
    expect(joinHints(null, '')).toBeNull()
  })
})

// T-21 (P05-C): com o React 19, o ref é prop; o TextField o leva ao campo
describe('Stepper: o "+" bloqueado continua tocável no web (R-20)', () => {
  // Elemento falso com a API do DOM que o markSoftDisabled usa
  const element = () => {
    const attrs = new Map<string, string>()
    return {
      attrs,
      setAttribute: (name: string, value: string) => attrs.set(name, value),
      removeAttribute: (name: string) => attrs.delete(name),
    }
  }

  it('põe aria-disabled no elemento sem o `disabled` e tira quando a trava sai', () => {
    const el = element()
    markSoftDisabled(el, true)
    expect(el.attrs.get('aria-disabled')).toBe('true')
    // O `disabled` do <button> (que tiraria o toque e o foco) nunca entra
    expect(el.attrs.has('disabled')).toBe(false)
    markSoftDisabled(el, false)
    expect(el.attrs.has('aria-disabled')).toBe(false)
  })

  it('sem elemento do DOM (app, teste), não faz nada', () => {
    expect(() => markSoftDisabled(null, true)).not.toThrow()
    expect(() => markSoftDisabled({}, true)).not.toThrow()
  })
})

describe('TextField: ref até o campo (T-21)', () => {
  it('quem chama recebe o TextInput e pode focá-lo', () => {
    const ref = createRef<TextInputInstance>()
    render(
      <TextField label="Nome" value="" onChangeText={jest.fn()} ref={ref} />
    )
    expect(ref.current?.focus).toEqual(expect.any(Function))
  })
})

const ZONES = [
  { id: 'sheet', label: 'Ficha' },
  { id: 'powers', label: 'Poderes' },
  { id: 'notes', label: 'Notas' },
]

describe('Tabs e TabPanel: teclado, painel e posição no iOS (T-35)', () => {
  const renderTabs = (onSelect = jest.fn(), id?: string) =>
    render(
      <>
        <Tabs
          id={id}
          accessibilityLabel="Partes da ficha"
          items={ZONES}
          selected="powers"
          onSelect={onSelect}
        />
        {id ? (
          <TabPanel tabsId={id} tab="powers" testID="panel">
            {null}
          </TabPanel>
        ) : null}
      </>
    )

  it('no web: só a aba ativa no Tab; a seta seleciona (ativação automática)', () => {
    setOS('web')
    const onSelect = jest.fn()
    renderTabs(onSelect)
    const tabs = screen.getAllByRole('tab')
    expect(tabs.map(t => t.props.tabIndex)).toEqual([-1, 0, -1])
    fireEvent(
      screen.getByRole('tab', { name: 'Poderes' }),
      'keyDown',
      key('ArrowRight').event
    )
    expect(onSelect).toHaveBeenLastCalledWith('notes')
    fireEvent(
      screen.getByRole('tab', { name: 'Poderes' }),
      'keyDown',
      key('Home').event
    )
    expect(onSelect).toHaveBeenLastCalledWith('sheet')
    // ↓ não é das abas horizontais
    onSelect.mockClear()
    fireEvent(
      screen.getByRole('tab', { name: 'Poderes' }),
      'keyDown',
      key('ArrowDown').event
    )
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('no web: o Espaço ativa a aba', () => {
    setOS('web')
    const onSelect = jest.fn()
    renderTabs(onSelect)
    fireEvent(
      screen.getByRole('tab', { name: 'Notas' }),
      'keyDown',
      key(' ').event
    )
    expect(onSelect).toHaveBeenCalledWith('notes')
  })

  it('no web, com id: a aba ativa controla o painel, que é nomeado por ela', () => {
    setOS('web')
    renderTabs(jest.fn(), 'parts')
    const active = screen.getByRole('tab', { name: 'Poderes' })
    expect(active.props.nativeID).toBe('parts-tab-powers')
    expect(active.props['aria-controls']).toBe('parts-panel')
    expect(
      screen.getByRole('tab', { name: 'Ficha' }).props['aria-controls']
    ).toBeUndefined()
    const panel = screen.getByTestId('panel')
    expect(panel.props.role).toBe('tabpanel')
    expect(panel.props.nativeID).toBe('parts-panel')
    expect(panel.props['aria-labelledby']).toBe('parts-tab-powers')
  })

  it('sem id, nada de aria-controls; no app, o painel não ganha papel', () => {
    renderTabs(jest.fn(), 'parts')
    expect(screen.getByTestId('panel').props.role).toBeUndefined()
    expect(
      screen.getByRole('tab', { name: 'Poderes' }).props['aria-controls']
    ).toBeUndefined()
  })

  it('no iOS, cada aba diz a posição ("aba 2 de 3")', () => {
    setOS('ios')
    renderTabs()
    expect(
      screen.getByRole('tab', { name: 'Poderes' })
    ).toHaveAccessibilityValue({ text: 'aba 2 de 3' })
    expect(screen.getByRole('tab', { name: 'Ficha' })).toHaveAccessibilityValue(
      { text: 'aba 1 de 3' }
    )
  })

  it('no Android, sem a posição (o papel tab já é lido)', () => {
    setOS('android')
    renderTabs()
    expect(
      screen.getByRole('tab', { name: 'Poderes' }).props.accessibilityValue
        ?.text
    ).toBeUndefined()
  })
})

describe('BottomSheet: um Fechar só, escape no iOS e foco de volta (T-71, T-35)', () => {
  const sheet = (visible: boolean, onClose = jest.fn()) => (
    <BottomSheet
      visible={visible}
      title="Antecedentes"
      onClose={onClose}
      testID="sheet"
    >
      <RNText>conteúdo</RNText>
    </BottomSheet>
  )

  it('o fundo fecha no clique, mas fica fora da árvore e não é focável', () => {
    setOS('web')
    const onClose = jest.fn()
    render(sheet(true, onClose))
    expect(screen.getAllByRole('button', { name: 'Fechar' })).toHaveLength(1)
    const scrim = screen.getByTestId('bottom-sheet-scrim', {
      includeHiddenElements: true,
    })
    expect(scrim.props['aria-hidden']).toBe(true)
    // Sem tabindex: nem o Tab nem o trap do modal o focam (um Pressable
    // sempre tem tabindex, e o trap focava o fundo oculto ao entrar)
    expect(scrim.props.tabIndex).toBeUndefined()
    expect(scrim.props.accessibilityRole).toBeUndefined()
    fireEvent(scrim, 'click')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('web: Esc fecha pela raiz da folha, a qualquer momento (um caminho só)', () => {
    setOS('web')
    const onClose = jest.fn()
    render(sheet(true, onClose))
    // O Modal do react-native-web não recebe onRequestClose no web: o Esc
    // dele só valia depois da animação de entrada
    expect(screen.UNSAFE_getByType(Modal).props.onRequestClose).toBeUndefined()
    const preventDefault = jest.fn()
    // Na captura: o Esc de um campo de texto (que não deixa o evento subir)
    // também chega
    fireEvent(
      screen.getByRole('button', { name: 'Fechar' }),
      'keyDownCapture',
      {
        nativeEvent: { key: 'Escape' },
        preventDefault,
      }
    )
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(preventDefault).toHaveBeenCalled()
    fireEvent(screen.getByTestId('bottom-sheet-root'), 'keyDownCapture', {
      nativeEvent: { key: 'a' },
      preventDefault: jest.fn(),
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('app: o voltar do Android fecha pelo onRequestClose; sem Esc de teclado', () => {
    setOS('android')
    const onClose = jest.fn()
    render(sheet(true, onClose))
    expect(
      screen.getByTestId('bottom-sheet-root').props.onKeyDownCapture
    ).toBeUndefined()
    fireEvent(screen.UNSAFE_getByType(Modal), 'requestClose')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('iOS: o gesto de escape do VoiceOver fecha', () => {
    const onClose = jest.fn()
    render(sheet(true, onClose))
    fireEvent(screen.getByTestId('sheet'), 'accessibilityEscape')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  describe('no web, o foco volta a quem abriu', () => {
    const doc = globalThis as { document?: unknown }
    let trigger: { focus: jest.Mock; isConnected: boolean }
    let fake: { activeElement: unknown; body: object }
    beforeEach(() => {
      jest.useFakeTimers()
      setOS('web')
      trigger = { focus: jest.fn(), isConnected: true }
      fake = { activeElement: trigger, body: {} }
      doc.document = fake
    })
    afterEach(() => {
      jest.useRealTimers()
      delete doc.document
    })

    it('ao fechar (onDismiss do modal), mesmo com o foco perdido no body', () => {
      const { rerender } = render(sheet(true))
      fake.activeElement = fake.body
      rerender(sheet(false))
      fireEvent(screen.UNSAFE_getByType(Modal), 'dismiss')
      jest.runAllTimers()
      expect(trigger.focus).toHaveBeenCalledTimes(1)
    })

    it('com um campo em autoFocus na folha (QAW-28): volta ao gatilho, não ao campo', () => {
      // O autoFocus do React foca o campo na fase de layout da mesma
      // montagem. O ModalFocusTrap do react-native-web lê o foco depois
      // (efeito passivo) e guardaria o campo, que some ao fechar. Um layout
      // effect da folha também leria tarde: os do filho rodam antes.
      const field = { focus: jest.fn(), isConnected: true }
      function AutoFocused() {
        useLayoutEffect(() => {
          fake.activeElement = field
        }, [])
        return null
      }
      const sheetWith = (visible: boolean) => (
        <BottomSheet visible={visible} title="Antecedente" onClose={jest.fn()}>
          {visible ? <AutoFocused /> : null}
        </BottomSheet>
      )
      const { rerender } = render(sheetWith(false))
      rerender(sheetWith(true))
      expect(fake.activeElement).toBe(field)
      // Fechou: o campo saiu da tela e o foco ficou no body
      field.isConnected = false
      fake.activeElement = fake.body
      rerender(sheetWith(false))
      fireEvent(screen.UNSAFE_getByType(Modal), 'dismiss')
      jest.runAllTimers()
      expect(trigger.focus).toHaveBeenCalledTimes(1)
      expect(field.focus).not.toHaveBeenCalled()
    })

    it('gatilho que perdeu o foco ao ficar ocupado ("Sair"): volta ao último focado', () => {
      // O botão ocupado é desabilitado, e o navegador tira o foco dele: na
      // abertura da folha o foco está no body
      let onFocusIn: ((e: { target?: unknown }) => void) | undefined
      const tracking = {
        ...fake,
        addEventListener: (_: string, listener: typeof onFocusIn) => {
          onFocusIn = listener
        },
      }
      doc.document = tracking
      const { rerender } = render(sheet(false))
      onFocusIn?.({ target: trigger })
      tracking.activeElement = tracking.body
      rerender(sheet(true))
      rerender(sheet(false))
      fireEvent(screen.UNSAFE_getByType(Modal), 'dismiss')
      jest.runAllTimers()
      expect(trigger.focus).toHaveBeenCalledTimes(1)
    })

    it('Esc logo depois de abrir (QAW-28): fecha e o foco volta ao gatilho', () => {
      // O fluxo do E2E: Enter abre, o campo em autoFocus pega o foco, e o Esc
      // chega antes do fim da animação de entrada
      const field = { focus: jest.fn(), isConnected: true }
      function AutoFocus({ field: f }: { readonly field: object }) {
        useLayoutEffect(() => {
          fake.activeElement = f
        }, [f])
        return null
      }
      const onClose = jest.fn()
      const sheetWith = (visible: boolean) => (
        <BottomSheet visible={visible} title="Antecedente" onClose={onClose}>
          {visible ? <AutoFocus field={field} /> : null}
        </BottomSheet>
      )
      const { rerender } = render(sheetWith(false))
      rerender(sheetWith(true))
      expect(fake.activeElement).toBe(field)
      fireEvent(screen.getByTestId('bottom-sheet-root'), 'keyDownCapture', {
        nativeEvent: { key: 'Escape' },
        preventDefault: jest.fn(),
      })
      expect(onClose).toHaveBeenCalledTimes(1)
      // Quem chama fecha a folha
      rerender(sheetWith(false))
      field.isConnected = false
      fake.activeElement = fake.body
      fireEvent(screen.UNSAFE_getByType(Modal), 'dismiss')
      jest.runAllTimers()
      expect(trigger.focus).toHaveBeenCalledTimes(1)
      expect(field.focus).not.toHaveBeenCalled()
    })

    it('ao desmontar aberta (quem chama some com a folha)', () => {
      const { unmount } = render(sheet(true))
      fake.activeElement = null
      unmount()
      jest.runAllTimers()
      expect(trigger.focus).toHaveBeenCalledTimes(1)
    })

    it('não rouba o foco de outro elemento nem foca quem saiu da tela', () => {
      const first = render(sheet(true))
      fake.activeElement = { isConnected: true }
      first.unmount()
      jest.runAllTimers()
      expect(trigger.focus).not.toHaveBeenCalled()

      fake.activeElement = trigger
      const second = render(sheet(true))
      trigger.isConnected = false
      second.unmount()
      jest.runAllTimers()
      expect(trigger.focus).not.toHaveBeenCalled()
    })
  })

  it('no app, não mexe no foco', () => {
    const { rerender } = render(sheet(true))
    rerender(sheet(false))
    fireEvent(screen.UNSAFE_getByType(Modal), 'dismiss')
    expect(screen.queryByText('conteúdo')).toBeNull()
  })
})

/** Algum ancestral do elemento é um elemento acessível (engole os filhos no app)? */
const insideAccessible = (el: { parent: unknown }): boolean => {
  let node = el.parent as {
    props?: { accessible?: boolean }
    parent: unknown
  } | null
  while (node) {
    // Só os elementos de host (View) contam: é o que vira nó nativo
    if (
      typeof (node as { type?: unknown }).type === 'string' &&
      node.props?.accessible === true
    )
      return true
    node = node.parent as typeof node
  }
  return false
}

describe('ListItem sem ação não engole o trailing (T-41)', () => {
  it('o texto é um elemento; o botão fica fora dele', () => {
    const onPress = jest.fn()
    render(
      <ListItem
        title="Criado em 18/10"
        subtitle="8 usos restantes"
        trailing={<Button title="Revogar" variant="ghost" onPress={onPress} />}
      />
    )
    const revoke = screen.getByRole('button', { name: 'Revogar' })
    expect(insideAccessible(revoke)).toBe(false)
    expect(
      screen.getByLabelText('Criado em 18/10, 8 usos restantes')
    ).toBeTruthy()
    fireEvent.press(revoke)
    expect(onPress).toHaveBeenCalled()
  })

  it('sem trailing, continua um elemento só', () => {
    render(<ListItem title="Helena" subtitle="Tremere" testID="row" />)
    const row = screen.getByTestId('row')
    expect(row.props.accessible).toBe(true)
    expect(row.props.accessibilityLabel).toBe('Helena, Tremere')
  })

  it('com selos, continua um elemento só e o selo entra no nome (P04-D)', () => {
    render(
      <ListItem
        title="Helena"
        meta="de dona"
        badges={[{ label: 'Aguardando aprovação', testID: 'badge' }]}
        trailing={
          <Button title="Revogar" variant="ghost" onPress={jest.fn()} />
        }
      />
    )
    expect(
      screen.getByLabelText('Helena, de dona, Aguardando aprovação')
    ).toBeTruthy()
    // O selo fica dentro do elemento da linha, e o botão, fora
    expect(insideAccessible(screen.getByTestId('badge'))).toBe(true)
    expect(
      insideAccessible(screen.getByRole('button', { name: 'Revogar' }))
    ).toBe(false)
  })
})

describe('Chip: alternância e interruptor anunciados (T-42)', () => {
  it('toggle no web: aria-pressed, sem aria-selected (inválido em botão)', () => {
    setOS('web')
    render(<Chip label="Ocultas" selected onPress={jest.fn()} />)
    const chip = screen.getByRole('button', { name: 'Ocultas' })
    expect(chip.props['aria-pressed']).toBe(true)
    expect(chip.props['aria-selected']).toBeUndefined()
  })

  it('toggle no app: continua "selecionado"', () => {
    render(<Chip label="Ocultas" selected onPress={jest.fn()} />)
    expect(screen.getByRole('button', { name: 'Ocultas' })).toBeSelected()
  })

  it.each(['ios', 'android', 'web'])(
    'switch (%s): papel switch, ligado ou desligado',
    os => {
      setOS(os)
      const onPress = jest.fn()
      const { rerender } = render(
        <Chip kind="switch" label="Rolagem oculta" selected onPress={onPress} />
      )
      expect(
        screen.getByRole('switch', { name: 'Rolagem oculta' })
      ).toBeChecked()
      rerender(
        <Chip
          kind="switch"
          label="Rolagem oculta"
          selected={false}
          onPress={onPress}
        />
      )
      const off = screen.getByRole('switch', { name: 'Rolagem oculta' })
      expect(off).not.toBeChecked()
      fireEvent.press(off)
      expect(onPress).toHaveBeenCalled()
    }
  )
})

describe('Button: nome acessível próprio (T-61)', () => {
  it('padrão: o título; com accessibilityLabel, ele', () => {
    const { rerender } = render(
      <Button title="Escolher da lista" onPress={jest.fn()} />
    )
    expect(screen.getByRole('button').props.accessibilityLabel).toBe(
      'Escolher da lista'
    )
    rerender(
      <Button
        title="Escolher da lista"
        accessibilityLabel="Escolher da lista: Natureza"
        onPress={jest.fn()}
      />
    )
    expect(screen.getByRole('button').props.accessibilityLabel).toBe(
      'Escolher da lista: Natureza'
    )
  })
})

describe('Skeleton: carregamento anunciado no web (T-72)', () => {
  it('no web: role="status" anunciável (sem aria-busy), "Carregando" em texto; linhas fora da árvore', () => {
    setOS('web')
    render(<Skeleton testID="s" lines={2} />)
    const s = screen.getByTestId('s')
    expect(s.props.role).toBe('status')
    // Uma região viva ocupada não é anunciada
    expect(s.props['aria-busy']).toBeUndefined()
    expect(s).not.toBeBusy()
    expect(screen.getByText('Carregando')).toBeTruthy()
    const hidden = screen
      .getAllByTestId('skeleton-line', { includeHiddenElements: true })
      .filter(line => line.props['aria-hidden'] === true)
    expect(hidden).toHaveLength(2)
  })

  it('no app, continua um elemento só com o rótulo', () => {
    render(<Skeleton testID="s" label="Carregando a mesa" />)
    const s = screen.getByTestId('s')
    expect(s.props.accessible).toBe(true)
    expect(s.props.accessibilityLabel).toBe('Carregando a mesa')
    expect(screen.queryByText('Carregando a mesa')).toBeNull()
  })
})

describe('Alvo mínimo por plataforma: 48 dp no Android (T-70)', () => {
  const minHeight = (el: { props: { style?: unknown } }) =>
    (StyleSheet.flatten(el.props.style as ViewStyle) ?? {}).minHeight

  it.each([
    ['android', 48],
    ['ios', 44],
    ['web', 44],
  ] as const)('%s: Pressable e TextField com %i', (os, size) => {
    setOS(os)
    expect(hitTarget()).toBe(size)
    render(
      <>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ok"
          onPress={jest.fn()}
        />
        <TextField
          label="Nome"
          value=""
          onChangeText={jest.fn()}
          testID="field"
        />
      </>
    )
    const button = screen.getByLabelText('Ok')
    expect(minHeight(button)).toBe(size)
    expect(
      (StyleSheet.flatten(button.props.style as ViewStyle) ?? {}).minWidth
    ).toBe(size)
    expect(minHeight(screen.getByTestId('field'))).toBe(size)
  })

  it('o token do Android vem do tokens.json; o hit-size continua 44', () => {
    expect(tokens.size.hitSizeAndroid).toBe(48)
    expect(tokens.size.hitSize).toBe(44)
  })
})
