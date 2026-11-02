import type { ReactNode } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  type ViewStyle,
} from 'react-native'

/**
 * Como a tela foge do teclado (T-10, T-26): `padding` no iOS e no Android,
 * nada no web (o navegador já rola o campo para a vista).
 *
 * No Android com edge-to-edge (RN 0.88, `targetSdk` ≥ 35) a janela não
 * redimensiona com o teclado: o `adjustResize` não age, e sem `behavior` o
 * `KeyboardAvoidingView` é uma `View` comum. Antes, o `behavior` só valia no
 * iOS, e o teclado cobria a folha e o campo focado.
 *
 * Lê a plataforma na hora (como o `hitTarget()`): use no render. Se um dia o
 * app adotar o `react-native-keyboard-controller`, a troca é só neste arquivo.
 */
export function keyboardBehavior(): 'padding' | undefined {
  return Platform.OS === 'ios' || Platform.OS === 'android'
    ? 'padding'
    : undefined
}

export interface KeyboardAreaProps {
  readonly children: ReactNode
  readonly style?: ViewStyle
  readonly testID?: string
}

/** Área que encolhe acima do teclado, com `flex: 1`. */
export function KeyboardArea({ children, style, testID }: KeyboardAreaProps) {
  return (
    <KeyboardAvoidingView
      testID={testID}
      behavior={keyboardBehavior()}
      style={[styles.area, style]}
    >
      {children}
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  area: { flex: 1 },
})
