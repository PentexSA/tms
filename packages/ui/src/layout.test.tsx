import { render, screen } from '@testing-library/react-native'
import { Text as RNText, StyleSheet, type ViewStyle } from 'react-native'
import { SafeAreaInsetsContext } from 'react-native-safe-area-context'
import { AppBar, Screen } from './index'

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
    // A barra é o pai do título (heading)
    const bar = hostViewAbove(
      screen.getByRole('header', { name: 'Crônicas' }) as unknown as Node
    )
    const barStyle = styleOf(bar)
    expect(barStyle.paddingTop).toBeUndefined()
    expect(barStyle.minHeight).toBe(48)
  })
})
