import { render, screen } from '@testing-library/react-native'
import { Text as RNText, StyleSheet, type ViewStyle } from 'react-native'
import { SafeAreaInsetsContext } from 'react-native-safe-area-context'
import { AppBar, Screen, TextField } from './index'

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
