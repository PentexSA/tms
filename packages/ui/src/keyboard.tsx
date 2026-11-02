import { type ReactNode, useCallback, useRef, useState } from 'react'
import {
  type HostInstance,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
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

/**
 * Área que encolhe acima do teclado, com `flex: 1`.
 *
 * O `KeyboardAvoidingView` compara o próprio `onLayout` (relativo ao pai) com
 * a posição do teclado na janela: dentro de uma tela com cabeçalho e safe
 * area, ele encolhia de menos, pela altura de tudo o que fica acima dele, e
 * o fim da rolagem continuava atrás do teclado. O invólucro mede a própria
 * posição na janela e a passa como `keyboardVerticalOffset`.
 */
export function KeyboardArea({ children, style, testID }: KeyboardAreaProps) {
  const ref = useRef<HostInstance>(null)
  const [offset, setOffset] = useState(0)
  const behavior = keyboardBehavior()
  const measure = useCallback(() => {
    ref.current?.measureInWindow((_x, y) => {
      if (Number.isFinite(y)) setOffset(y)
    })
  }, [])
  return (
    <View
      ref={ref}
      testID={testID}
      style={[styles.area, style]}
      onLayout={behavior ? measure : undefined}
    >
      <KeyboardAvoidingView
        behavior={behavior}
        keyboardVerticalOffset={offset}
        style={styles.area}
      >
        {children}
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = StyleSheet.create({
  area: { flex: 1 },
})
