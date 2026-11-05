import type { CompiledGroup } from '@tms/sheet-core'
import {
  createContext,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react'

// A escolha das sub-abas por ficha e a seção que está no topo da tela
// (T-27, parte 2). No celular, a faixa fixa da ficha (SheetNav) mostra as
// sub-abas e o contador da seção com grupos que está no topo: Físicos |
// Sociais | Mentais perto dos Atributos, Talentos | Perícias | Conhecimentos
// nas Habilidades. As seções continuam filtrando o corpo pelo grupo
// escolhido. Sem provedor (prévias e testes), cada seção guarda a própria
// aba, como antes.
//
// O estado mora num store pequeno, fora do React: rolar a ficha e trocar a
// seção atual re-renderizam só a faixa, e trocar a sub-aba, só a seção dela
// e a faixa. A ficha inteira não re-renderiza a cada rolagem.

/** Uma seção com sub-abas ativas, que a faixa pode mostrar. */
export interface StripSection {
  readonly id: string
  readonly title: string
  /** O `id` das abas: o mesmo do painel no corpo (aria-controls). */
  readonly tabsId: string
  readonly groups: readonly CompiledGroup[]
}

export interface GroupTabsStore {
  /** Uma seção com sub-abas ativas entra na faixa; devolve a saída. */
  readonly register: (section: StripSection) => () => void
  readonly select: (sectionId: string, groupId: string) => void
  /** O `y` da seção dentro do painel da zona (onLayout). */
  readonly sectionAt: (sectionId: string, y: number) => void
  /** O `y` do painel da zona dentro da rolagem. */
  readonly panelAt: (y: number) => void
  /** A altura da faixa fixa. */
  readonly navHeight: (height: number) => void
  /** A posição da rolagem. */
  readonly scrolled: (y: number) => void
  readonly subscribe: (listener: () => void) => () => void
  /** O grupo escolhido na seção (sem escolha, o primeiro). */
  readonly selected: (sectionId: string) => string | undefined
  /** A seção com sub-abas que está no topo da tela (ou a primeira). */
  readonly current: () => StripSection | null
  /** A rolagem em que o painel da zona começa logo abaixo da faixa. */
  readonly panelTop: () => number
  /** A posição da rolagem. */
  readonly scrollY: () => number
  /**
   * Uma âncora do "ir ao grupo" (P05-D, R-18): o `y` dela dentro de `parent`
   * (outra âncora; sem ela, o painel da zona; `SCROLL_ROOT`, a própria
   * rolagem) e, se ela recebe o foco, a função que o põe nela.
   */
  readonly anchorAt: (
    id: string,
    y: number,
    focus?: (() => void) | null,
    parent?: string
  ) => void
  /** A âncora saiu da tela (a seção desmontou). */
  readonly dropAnchor: (id: string) => void
  /** Esquece o pedido pendente (a pessoa trocou de aba à mão). */
  readonly cancelJump: () => void
  /**
   * Ir à primeira âncora conhecida da lista (a do grupo, depois a da seção).
   * Se nenhuma foi medida ainda (a aba acabou de trocar), o pedido espera o
   * próximo `anchorAt`, sem timer; um pedido novo troca o velho.
   */
  readonly jumpTo: (ids: readonly string[]) => void
  /** Quem rola: recebe a rolagem de destino e o foco da âncora. */
  readonly onJump: (
    listener: (y: number, focus: (() => void) | null) => void
  ) => () => void
  /**
   * Quem mede a própria posição de novo quando o conteúdo da rolagem muda de
   * tamanho (A3: no web, o onLayout só dispara quando o tamanho da vista
   * muda, não quando ela desce porque algo acima cresceu).
   */
  readonly onRemeasure: (measure: () => void) => () => void
  /** Remede todas as posições (o conteúdo da rolagem mudou de tamanho). */
  readonly remeasure: () => void
}

/** O `parent` das âncoras medidas direto na rolagem (o "Em jogo"). */
export const SCROLL_ROOT = '@scroll'

interface AnchorNode {
  readonly y: number
  readonly focus: (() => void) | null
  readonly parent: string | undefined
}

// Um quadro depois da primeira âncora medida: as âncoras irmãs (o grupo
// dentro da seção) chegam no mesmo layout
// O pedido que não se resolve logo (a âncora não montou) expira: uma âncora
// que monta muito depois, sem ação da pessoa, não rola a ficha nem move o
// foco. A medida da aba nova chega em poucos quadros
export const JUMP_TTL_MS = 1500
// Depois do salto, a faixa fixa pode crescer (as sub-abas da seção nova):
// o destino é corrigido com a altura nova, sem mover o foco de novo
const SETTLE_MS = 1000
const SETTLE_FIXES = 2

const nextFrame = (run: () => void) =>
  typeof requestAnimationFrame === 'function'
    ? requestAnimationFrame(() => run())
    : setTimeout(run, 0)

export interface GroupTabsShared {
  /** A faixa fixa desenha as sub-abas: o corpo não desenha a barra. */
  readonly strip: boolean
  readonly store: GroupTabsStore
}

export const GroupTabsContext = createContext<GroupTabsShared | null>(null)

export const useGroupTabsContext = () => useContext(GroupTabsContext)

/**
 * As seções do painel da zona (as abas da ficha). Só elas sobem para a
 * faixa: a posição delas é medida dentro do painel. Uma seção com sub-abas
 * fora dele (no "Em jogo") fica com a barra no corpo.
 */
export const StripScope = createContext(false)

/**
 * Qual seção está no topo: a última cujo início já passou da faixa fixa.
 * No topo da zona (nenhuma passou), a primeira.
 */
export function currentSection(
  sections: readonly { readonly id: string; readonly y: number }[],
  line: number
): string | null {
  const ordered = [...sections].sort((a, b) => a.y - b.y)
  let at = ordered[0]?.id ?? null
  for (const s of ordered) if (s.y <= line) at = s.id
  return at
}

export function createGroupTabsStore(): GroupTabsStore {
  const sections = new Map<string, StripSection>()
  const chosen = new Map<string, string>()
  const ys = new Map<string, number>()
  const listeners = new Set<() => void>()
  let panel = 0
  let nav = 0
  let scroll = 0
  let currentId: string | null = null
  const anchors = new Map<string, AnchorNode>()
  const measurers = new Set<() => void>()
  const jumpListeners = new Set<
    (y: number, focus: (() => void) | null) => void
  >()
  let pending: readonly string[] | null = null
  let requestedAt = 0
  let scheduled = false
  // O último salto, para corrigir quando a faixa muda de altura logo depois
  let landed: {
    readonly id: string
    readonly at: number
    y: number
    fixes: number
  } | null = null
  // O `y` da âncora: relativo ao painel (`panel`) ou à rolagem (`scroll`)
  const place = (
    id: string,
    depth = 0
  ): { readonly y: number; readonly root: 'panel' | 'scroll' } | null => {
    const node = anchors.get(id)
    if (!node || depth > 8) return null
    if (node.parent === SCROLL_ROOT) return { y: node.y, root: 'scroll' }
    if (node.parent === undefined) return { y: node.y, root: 'panel' }
    const up = place(node.parent, depth + 1)
    return up ? { y: up.y + node.y, root: up.root } : null
  }
  const target = (id: string): number | null => {
    const at = place(id)
    if (!at) return null
    return Math.max(0, at.root === 'panel' ? panel + at.y - nav : at.y)
  }
  const expired = () => Date.now() - requestedAt > JUMP_TTL_MS
  const resolve = () => {
    if (!pending || scheduled) return
    if (expired()) {
      pending = null
      return
    }
    if (!pending.some(id => place(id) !== null)) return
    scheduled = true
    nextFrame(() => {
      scheduled = false
      const ids = pending
      const id = ids?.find(x => place(x) !== null)
      const y = id ? target(id) : null
      if (!id || y === null) return
      pending = null
      landed = { id, at: Date.now(), y, fixes: 0 }
      const focus = anchors.get(id)?.focus ?? null
      for (const listener of jumpListeners) listener(y, focus)
    })
  }
  // A faixa mudou de altura logo depois do salto: o começo do destino volta
  // a ficar logo abaixo dela
  const settle = () => {
    if (!landed || landed.fixes >= SETTLE_FIXES) return
    if (Date.now() - landed.at > SETTLE_MS) {
      landed = null
      return
    }
    const y = target(landed.id)
    if (y === null || y === landed.y) return
    landed.y = y
    landed.fixes += 1
    for (const listener of jumpListeners) listener(y, null)
  }
  const notify = () => {
    for (const listener of listeners) listener()
  }
  const recompute = () => {
    const list = [...sections.keys()].map(id => ({
      id,
      y: panel + (ys.get(id) ?? Number.POSITIVE_INFINITY),
    }))
    const next = currentSection(list, scroll + nav)
    if (next === currentId) return false
    currentId = next
    return true
  }
  return {
    register(section) {
      sections.set(section.id, section)
      recompute()
      notify()
      return () => {
        if (sections.get(section.id) !== section) return
        sections.delete(section.id)
        recompute()
        notify()
      }
    },
    select(sectionId, groupId) {
      if (chosen.get(sectionId) === groupId) return
      chosen.set(sectionId, groupId)
      notify()
    },
    sectionAt(sectionId, y) {
      ys.set(sectionId, y)
      if (recompute()) notify()
    },
    panelAt(y) {
      panel = y
      if (recompute()) notify()
    },
    navHeight(height) {
      if (height === nav) return
      nav = height
      if (recompute()) notify()
      settle()
    },
    scrolled(y) {
      scroll = y
      if (recompute()) notify()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    selected: sectionId => chosen.get(sectionId),
    current: () => (currentId ? (sections.get(currentId) ?? null) : null),
    panelTop: () => Math.max(0, panel - nav),
    scrollY: () => scroll,
    anchorAt(id, y, focus = null, parent) {
      anchors.set(id, { y, focus, parent })
      resolve()
    },
    dropAnchor(id) {
      anchors.delete(id)
    },
    cancelJump() {
      pending = null
      landed = null
    },
    jumpTo(ids) {
      pending = ids.length ? ids : null
      requestedAt = Date.now()
      landed = null
      resolve()
    },
    onJump(listener) {
      jumpListeners.add(listener)
      return () => jumpListeners.delete(listener)
    },
    onRemeasure(measure) {
      measurers.add(measure)
      return () => measurers.delete(measure)
    },
    remeasure() {
      for (const measure of [...measurers]) measure()
    },
  }
}

/** O valor do contexto, para o SheetView prover: o store é um por ficha. */
export function useGroupTabsState(strip: boolean): GroupTabsShared {
  const [store] = useState(createGroupTabsStore)
  return useMemo(() => ({ strip, store }), [strip, store])
}

const noSubscribe = () => () => undefined

/** O grupo escolhido numa seção; re-renderiza só quando ele muda. */
export function useSelectedGroup(
  store: GroupTabsStore | null | undefined,
  sectionId: string | undefined
): string | undefined {
  return useSyncExternalStore(
    store?.subscribe ?? noSubscribe,
    () => (store && sectionId ? store.selected(sectionId) : undefined),
    () => undefined
  )
}

/** A seção da faixa; re-renderiza só quando ela muda. */
export function useCurrentStripSection(
  store: GroupTabsStore | null | undefined
): StripSection | null {
  return useSyncExternalStore(
    store?.subscribe ?? noSubscribe,
    () => store?.current() ?? null,
    () => null
  )
}
