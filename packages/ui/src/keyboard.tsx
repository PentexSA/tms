import { type ReactNode, useEffect, useRef, useState } from 'react'
import {
  type HostInstance,
  Keyboard,
  LayoutAnimation,
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
 * iOS, e o teclado cobria a folha e o campo focado. A `BottomSheet` usa este
 * valor na raiz (o Modal ocupa a janela inteira); as telas usam o
 * `KeyboardArea`.
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
 * area, ele encolhia de menos, pela altura de tudo o que fica acima dele.
 * Uma posição medida antes (no layout) também envelhece: a animação de
 * entrada da tela ou um aviso acima mudam o lugar da área sem mudar o
 * layout dela. Aqui a área mede onde está na janela a cada vez que o
 * teclado abre e encolhe o que ele cobre de verdade.
 */
export function KeyboardArea({ children, style, testID }: KeyboardAreaProps) {
  const ref = useRef<HostInstance>(null)
  const [bottom, setBottom] = useState(0)
  const active = keyboardBehavior() !== undefined
  useEffect(() => {
    if (!active) return
    const ios = Platform.OS === 'ios'
    const subscriptions = [
      Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', e => {
        const top = e.endCoordinates.screenY
        ref.current?.measureInWindow((_x, y, _width, height) => {
          if (ios && e.duration)
            LayoutAnimation.configureNext({
              duration: e.duration,
              update: { duration: e.duration, type: 'keyboard' },
            })
          setBottom(Math.max(0, y + height - top))
        })
      }),
      Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () =>
        setBottom(0)
      ),
    ]
    return () => {
      for (const s of subscriptions) s.remove()
    }
  }, [active])
  return (
    <View
      ref={ref}
      testID={testID}
      style={[styles.area, style, bottom > 0 && { paddingBottom: bottom }]}
    >
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  area: { flex: 1 },
})
