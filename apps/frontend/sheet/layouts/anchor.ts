import { useCallback, useEffect, useRef } from 'react'
import {
  AccessibilityInfo,
  type LayoutChangeEvent,
  Platform,
  type ViewInstance,
} from 'react-native'
import { useGroupTabsContext } from './groupTabsState'

// As âncoras do "ir ao grupo" (P05-D, R-18): cada seção do painel (e cada
// grupo com título, e o "Em jogo") diz onde começa, e o título recebe o
// foco quando o toque num item do "O que falta" leva até ela. No web, o
// título é focável só por programa (`tabIndex={-1}`, `id="anchor-<id>"`);
// no app, o foco do leitor de tela vai para ele. Sem provedor (prévias e
// testes), nada é medido.

/** O `id` do alvo no DOM (`anchor-advantages-virtues`). */
export const anchorDomId = (id: string): string =>
  `anchor-${id.replace(/[^A-Za-z0-9_-]/g, '-')}`

/** O foco programático: no web, o elemento; no app, o leitor de tela. */
export function focusView(view: ViewInstance | null) {
  if (!view) return
  if (Platform.OS === 'web') {
    ;(view as unknown as { focus?: (o?: object) => void }).focus?.({
      preventScroll: true,
    })
    return
  }
  AccessibilityInfo.sendAccessibilityEvent(view, 'focus')
}

/**
 * `onLayout` vai na vista que dá a posição (relativa a `parent`, outra
 * âncora, ou ao painel); `target`, na vista que recebe o foco (o título).
 * Com `focusable` falso, a âncora só mede (um contêiner intermediário).
 */
export function useAnchor(
  id: string | null,
  { parent, focusable = true }: { parent?: string; focusable?: boolean } = {}
) {
  const store = useGroupTabsContext()?.store
  const ref = useRef<ViewInstance>(null)
  const focus = useCallback(() => focusView(ref.current), [])
  useEffect(() => {
    if (!store || !id) return
    return () => store.dropAnchor(id)
  }, [store, id])
  const onLayout =
    store && id
      ? (e: LayoutChangeEvent) =>
          store.anchorAt(
            id,
            e.nativeEvent.layout.y,
            focusable ? focus : null,
            parent
          )
      : undefined
  const target =
    id && focusable
      ? { ref, nativeID: anchorDomId(id), tabIndex: -1 as const }
      : {}
  return { onLayout, target }
}
