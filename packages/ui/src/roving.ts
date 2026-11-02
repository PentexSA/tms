import { useRef } from 'react'
import { type KeyDownEvent, Platform } from 'react-native'

// Teclado nos grupos (design system, Choice e SectionTabs): tabindex
// itinerante e setas. Só no web: no app, quem anda pelo grupo é o leitor de
// tela, e o react-native-web é o único que liga o teclado ao DOM.

interface KeyFields {
  key?: string
  repeat?: boolean
  altKey?: boolean
  ctrlKey?: boolean
  metaKey?: boolean
  shiftKey?: boolean
}

export interface KeyInfo {
  readonly key: string
  readonly repeat: boolean
  readonly alt: boolean
  readonly ctrl: boolean
  readonly meta: boolean
  readonly shift: boolean
}

/** Tecla de um evento de teclado no web (o React DOM e o RN têm formas diferentes). */
export function keyOf(e: KeyDownEvent): KeyInfo {
  const native = (e.nativeEvent ?? {}) as KeyFields
  const top = e as unknown as KeyFields
  return {
    key: native.key ?? top.key ?? '',
    repeat: Boolean(native.repeat ?? top.repeat),
    alt: Boolean(native.altKey ?? top.altKey),
    ctrl: Boolean(native.ctrlKey ?? top.ctrlKey),
    meta: Boolean(native.metaKey ?? top.metaKey),
    shift: Boolean(native.shiftKey ?? top.shiftKey),
  }
}

/**
 * A tecla é do próprio elemento, não de um descendente focável (um campo
 * dentro da linha, por exemplo): no web o keydown sobe pela árvore.
 */
export function fromSelf(e: KeyDownEvent): boolean {
  const { target, currentTarget } = e as unknown as {
    target?: unknown
    currentTarget?: unknown
  }
  return target == null || currentTarget == null || target === currentTarget
}

const ARROWS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'])

export interface RovingFocusOptions {
  /** Quantos itens o grupo tem. */
  readonly count: number
  /** O item que recebe o Tab: o selecionado, ou −1 (vira o primeiro). */
  readonly active: number
  /**
   * `horizontal`: ← e →; `vertical`: ↑ e ↓; `both` (padrão): as quatro
   * (grupo de rádio, que pode ser uma grade).
   */
  readonly orientation?: 'horizontal' | 'vertical' | 'both'
  /**
   * `focus`: a seta já seleciona (abas, como o DS manda). `manual`: a seta só
   * move o foco; Espaço, Enter ou toque escolhem (rádios que aplicam na hora).
   */
  readonly activate?: 'focus' | 'manual'
  /** Chamado com o índice do item que recebeu o foco, quando `activate` é `focus`. */
  readonly onActivate?: (index: number) => void
}

export interface RovingItemProps {
  readonly ref?: (node: unknown) => void
  readonly tabIndex?: 0 | -1
  readonly onKeyDown?: (e: KeyDownEvent) => void
}

const PREV: Record<string, readonly string[]> = {
  horizontal: ['ArrowLeft'],
  vertical: ['ArrowUp'],
  both: ['ArrowLeft', 'ArrowUp'],
}
const NEXT: Record<string, readonly string[]> = {
  horizontal: ['ArrowRight'],
  vertical: ['ArrowDown'],
  both: ['ArrowRight', 'ArrowDown'],
}

/** Índice para onde a tecla leva, dando a volta; `null` se a tecla não é do grupo. */
export function rovingTarget(
  key: string,
  from: number,
  count: number,
  orientation: 'horizontal' | 'vertical' | 'both' = 'both'
): number | null {
  if (count <= 0) return null
  if (key === 'Home') return 0
  if (key === 'End') return count - 1
  if (PREV[orientation]?.includes(key)) return (from - 1 + count) % count
  if (NEXT[orientation]?.includes(key)) return (from + 1) % count
  return null
}

/**
 * Foco itinerante: devolve as props do item `i` (`ref`, `tabIndex` e
 * `onKeyDown`). Só o item ativo fica no Tab; as setas, Home e End movem o
 * foco do DOM. No app, devolve `{}`.
 */
export function useRovingFocus({
  count,
  active,
  orientation = 'both',
  activate = 'manual',
  onActivate,
}: RovingFocusOptions): (index: number) => RovingItemProps {
  const nodes = useRef<unknown[]>([])
  if (Platform.OS !== 'web') return () => ({})
  const current = active >= 0 && active < count ? active : 0
  return (index: number) => ({
    ref: (node: unknown) => {
      nodes.current[index] = node
    },
    tabIndex: index === current ? 0 : -1,
    onKeyDown: (e: KeyDownEvent) => {
      const k = keyOf(e)
      // Atalhos do navegador e do sistema (Alt+← volta a página, Cmd+← vai
      // ao início da linha) e Shift+seta não são do grupo; nem a tecla de um
      // descendente. Nesses casos, nada de preventDefault.
      if (k.alt || k.ctrl || k.meta || (k.shift && ARROWS.has(k.key))) return
      if (!fromSelf(e)) return
      const next = rovingTarget(k.key, index, count, orientation)
      if (next === null) return
      e.preventDefault()
      const node = nodes.current[next] as { focus?: () => void } | null
      node?.focus?.()
      if (activate === 'focus' && next !== index) onActivate?.(next)
    },
  })
}
