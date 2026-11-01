// Acessibilidade dos componentes compartilhados (P06 da onda 1). Os ramos do
// web e do Android rodam com o Platform.OS trocado, como em components.test.
import {
  fireEvent,
  render,
  renderHook,
  screen,
} from '@testing-library/react-native'
import { Platform } from 'react-native'
import { Pressable, rovingTarget, useRovingFocus } from './index'

const realOS = Platform.OS
const setOS = (os: string) =>
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true })
afterEach(() => setOS(realOS))

const key = (k: string, extra: { repeat?: boolean } = {}) => {
  const preventDefault = jest.fn()
  return {
    event: {
      nativeEvent: { key: k, repeat: extra.repeat ?? false },
      preventDefault,
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
