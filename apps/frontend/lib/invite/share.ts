// "Compartilhar" o convite em qualquer navegador (P12, T-44). Sem Web Share
// API, o react-native-web rejeita a promessa ("Share is not supported in
// this browser"), e a rejeição sem tratamento virava pageerror. Aqui:
// - a detecção vem antes do toque: sem suporte, o botão já é "Copiar
//   mensagem";
// - com suporte, as três saídas são tratadas: sucesso, a pessoa fechou
//   (AbortError, nada a dizer) e qualquer outro erro (copia a mensagem).
// Nada da mensagem vai ao error tracking: o erro do compartilhar não é
// defeito do app, e a mensagem tem o código.

import * as Clipboard from 'expo-clipboard'
import { Platform, Share } from 'react-native'

interface WebShareNavigator {
  share?: (data: { text: string }) => Promise<void>
  canShare?: (data: { text: string }) => boolean
}

const webNavigator = (): WebShareNavigator | undefined =>
  (globalThis as { navigator?: WebShareNavigator }).navigator

/** Se o toque abre a folha do sistema: sempre no app; no web, com Web Share. */
export function canShareNatively(text = ''): boolean {
  if (Platform.OS !== 'web') return true
  const nav = webNavigator()
  if (typeof nav?.share !== 'function') return false
  try {
    return nav.canShare?.({ text }) !== false
  } catch {
    return false
  }
}

/** Copia; `false` quando nem a API nova nem o execCommand conseguiram. */
export async function copyText(text: string): Promise<boolean> {
  try {
    return (await Clipboard.setStringAsync(text)) !== false
  } catch {
    return false
  }
}

export type ShareOutcome = 'shared' | 'dismissed' | 'copied' | 'failed'

const isAbort = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  (error as { name?: unknown }).name === 'AbortError'

/**
 * Abre o compartilhar do sistema com a mensagem. Se o sistema recusar, copia
 * a mensagem ('copied') ou diz que não conseguiu ('failed'). Nunca rejeita.
 */
export async function shareMessage(message: string): Promise<ShareOutcome> {
  try {
    if (Platform.OS === 'web') {
      const nav = webNavigator()
      if (typeof nav?.share !== 'function') throw new Error('sem Web Share')
      // Só o texto: com `url` também, alguns alvos repetem o link
      await nav.share({ text: message })
      return 'shared'
    }
    const result = await Share.share({ message })
    return result.action === Share.dismissedAction ? 'dismissed' : 'shared'
  } catch (error) {
    if (isAbort(error)) return 'dismissed'
    return (await copyText(message)) ? 'copied' : 'failed'
  }
}
