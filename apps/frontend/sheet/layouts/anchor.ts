import { type RefObject, useCallback, useEffect, useRef } from 'react'
import {
  AccessibilityInfo,
  type HostInstance,
  type LayoutChangeEvent,
  Platform,
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

/**
 * O alvo do foco: o texto do título (AnchorHeader), um elemento de
 * acessibilidade, para o leitor de tela do app ir até ele.
 */
export interface AnchorTarget {
  readonly ref?: RefObject<HostInstance | null>
  readonly nativeID?: string
  readonly tabIndex?: -1
}

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

/**
 * O `y` de uma vista dentro da vista-mãe, lido na hora. Só no web: lá, o
 * onLayout só dispara quando o tamanho muda, e a posição fica velha quando
 * algo acima cresce (A3). As vistas do react-native-web têm `position:
 * relative`, então o `offsetTop` é relativo à vista-mãe, como o onLayout.
 * No app, o onLayout já dispara quando a posição muda: null.
 */
export function offsetTopOf(view: HostInstance | null): number | null {
  if (Platform.OS !== 'web' || !view) return null
  const top = (view as unknown as { offsetTop?: unknown }).offsetTop
  return typeof top === 'number' ? top : null
}

/**
 * No web, registra a vista para ser remedida quando o conteúdo da rolagem
 * muda de tamanho (A3). `report` recebe o `y` relativo à vista-mãe.
 */
export function useRemeasure(
  ref: RefObject<HostInstance | null>,
  report: ((y: number) => void) | null
) {
  const store = useGroupTabsContext()?.store
  const latest = useRef(report)
  latest.current = report
  const on = Boolean(report)
  useEffect(() => {
    if (!store || !on || Platform.OS !== 'web') return
    return store.onRemeasure(() => {
      const y = offsetTopOf(ref.current)
      if (y !== null) latest.current?.(y)
    })
  }, [store, on, ref])
}

/**
 * `onLayout` e `layoutRef` vão na vista que dá a posição (relativa a
 * `parent`, outra âncora, ou ao painel); `target`, no texto do título que
 * recebe o foco (AnchorHeader). Com `focusable` falso, a âncora só mede (um
 * contêiner intermediário). `onY` recebe a mesma posição (a seção da faixa).
 */
export function useAnchor(
  id: string | null,
  {
    parent,
    focusable = true,
    onY,
  }: {
    parent?: string
    focusable?: boolean
    onY?: ((y: number) => void) | null
  } = {}
) {
  const store = useGroupTabsContext()?.store
  const ref = useRef<HostInstance>(null)
  const layoutRef = useRef<HostInstance>(null)
  const focus = useCallback(() => focusView(ref.current), [])
  useEffect(() => {
    if (!store || !id) return
    return () => store.dropAnchor(id)
  }, [store, id])
  const report =
    store && (id || onY)
      ? (y: number) => {
          if (id) store.anchorAt(id, y, focusable ? focus : null, parent)
          onY?.(y)
        }
      : null
  useRemeasure(layoutRef, report)
  const onLayout = report
    ? (e: LayoutChangeEvent) => report(e.nativeEvent.layout.y)
    : undefined
  const target: AnchorTarget =
    id && focusable ? { ref, nativeID: anchorDomId(id), tabIndex: -1 } : {}
  return { onLayout, layoutRef, target }
}
