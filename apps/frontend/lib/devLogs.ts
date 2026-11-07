import { LogBox } from 'react-native'

// Avisos de desenvolvimento que não vêm do nosso código e não pedem ação,
// fora da tela do app (LogBox). Seguem no console e no logcat; o build de
// produção nem os emite. Cada um com a origem, para sair daqui quando a
// origem sair. Frase exata: nada além destes some da tela.
export const IGNORED_DEV_LOGS: readonly string[] = [
  // O NativeWind (react-native-css-interop 0.2.7, a última) lê
  // `ImageBackground` do react-native ao carregar, e o getter do RN avisa
  // que ele é obsoleto. O app não usa ImageBackground.
  'ImageBackground is deprecated and will be removed in a future release.',
  // iOS: o React Native (RCTEventEmitter) avisa quando uma animação nativa
  // de terceiros manda o valor depois que o listener do JS já saiu (a troca
  // de tela depois do login). O app não usa Animated.
  'Sending `onAnimatedValueUpdate` with no listeners registered.',
]

/**
 * Tira da tela (LogBox) os avisos de dev de IGNORED_DEV_LOGS. Roda no
 * index.ts, antes do roteador: o do NativeWind sai ao carregar o primeiro
 * módulo com JSX, e o LogBox só filtra o que chega depois do ignoreLogs.
 */
export function quietDevLogs(): void {
  // No build de produção o LogBox não existe, e isto não faz nada
  LogBox.ignoreLogs([...IGNORED_DEV_LOGS])
}

quietDevLogs()
