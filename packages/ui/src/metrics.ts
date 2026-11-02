import { Platform } from 'react-native'
import { tokens } from './tokens'

/**
 * Alvo mínimo de toque da plataforma (T-70): 48 dp no Android (Material) e
 * 44 no iOS e no web (`hit-size`). Lê a plataforma na hora da chamada: use
 * no render, não num StyleSheet de módulo.
 */
export function hitTarget(): number {
  return Platform.OS === 'android'
    ? tokens.size.hitSizeAndroid
    : tokens.size.hitSize
}
