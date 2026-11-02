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
}

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
      nav = height
      if (recompute()) notify()
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
