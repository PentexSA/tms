import { AccessibilityInfo, type HostInstance, Platform } from 'react-native'

// Veio de sheet/layouts/anchor.ts (P05-D), que o reexporta: components/ não
// depende de sheet/layouts (P12, a confirmação de "Revogar").

/** O foco programático: no web, o elemento; no app, o leitor de tela. */
export function focusView(view: HostInstance | null) {
  if (!view) return
  if (Platform.OS === 'web') {
    ;(view as unknown as { focus?: (o?: object) => void }).focus?.({
      preventScroll: true,
    })
    return
  }
  AccessibilityInfo.sendAccessibilityEvent(view, 'focus')
}
