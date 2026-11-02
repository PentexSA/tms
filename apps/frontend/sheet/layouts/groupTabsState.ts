import type { CompiledGroup } from '@tms/sheet-core'
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react'

// A escolha das sub-abas por ficha e a seção que está no topo da tela
// (T-27, parte 2). No celular, a faixa fixa da ficha (SheetNav) mostra as
// sub-abas e o contador da seção com grupos que está no topo: Físicos |
// Sociais | Mentais perto dos Atributos, Talentos | Perícias | Conhecimentos
// nas Habilidades. As seções continuam filtrando o corpo pelo grupo
// escolhido. Sem provedor (prévias e testes), cada seção guarda a própria
// aba, como antes.

/** Uma seção com sub-abas ativas, que a faixa pode mostrar. */
export interface StripSection {
  readonly id: string
  readonly title: string
  /** O `id` das abas: o mesmo do painel no corpo (aria-controls). */
  readonly tabsId: string
  readonly groups: readonly CompiledGroup[]
}

export interface GroupTabsState {
  /** A faixa fixa desenha as sub-abas: o corpo não desenha a barra. */
  readonly strip: boolean
  /** O grupo escolhido por seção. */
  readonly selected: Readonly<Record<string, string>>
  readonly select: (sectionId: string, groupId: string) => void
  /** A seção com sub-abas que está no topo da tela (ou a primeira). */
  readonly current: StripSection | null
  /** Uma seção com sub-abas ativas entra na faixa; devolve a saída. */
  readonly register: (section: StripSection) => () => void
  /** O `y` da seção dentro do painel da zona (onLayout). */
  readonly sectionAt: (sectionId: string, y: number) => void
  /** O `y` do painel da zona dentro da rolagem. */
  readonly panelAt: (y: number) => void
  /** A altura da faixa fixa. */
  readonly navHeight: (height: number) => void
  /** A posição da rolagem. */
  readonly scrolled: (y: number) => void
}

export const GroupTabsContext = createContext<GroupTabsState | null>(null)

export const useGroupTabsContext = () => useContext(GroupTabsContext)

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

/** O estado do contexto, para o SheetView prover. */
export function useGroupTabsState(strip: boolean): GroupTabsState {
  const [selected, setSelected] = useState<Record<string, string>>({})
  const [currentId, setCurrentId] = useState<string | null>(null)
  // As seções registradas mudam a faixa; posições e rolagem, não: só a
  // conta da seção atual as lê
  const sections = useRef(new Map<string, StripSection>())
  const [, changed] = useReducer((n: number) => n + 1, 0)
  const ys = useRef(new Map<string, number>())
  const panel = useRef(0)
  const nav = useRef(0)
  const scroll = useRef(0)

  const recompute = useCallback(() => {
    const list = [...sections.current.keys()].map(id => ({
      id,
      y: panel.current + (ys.current.get(id) ?? Number.POSITIVE_INFINITY),
    }))
    setCurrentId(currentSection(list, scroll.current + nav.current))
  }, [])

  const register = useCallback(
    (section: StripSection) => {
      sections.current.set(section.id, section)
      changed()
      recompute()
      return () => {
        if (sections.current.get(section.id) !== section) return
        sections.current.delete(section.id)
        changed()
        recompute()
      }
    },
    [recompute]
  )
  const select = useCallback((sectionId: string, groupId: string) => {
    setSelected(s =>
      s[sectionId] === groupId ? s : { ...s, [sectionId]: groupId }
    )
  }, [])
  const sectionAt = useCallback(
    (sectionId: string, y: number) => {
      ys.current.set(sectionId, y)
      recompute()
    },
    [recompute]
  )
  const panelAt = useCallback(
    (y: number) => {
      panel.current = y
      recompute()
    },
    [recompute]
  )
  const navHeight = useCallback(
    (height: number) => {
      nav.current = height
      recompute()
    },
    [recompute]
  )
  const scrolled = useCallback(
    (y: number) => {
      scroll.current = y
      recompute()
    },
    [recompute]
  )

  const current = currentId ? (sections.current.get(currentId) ?? null) : null
  return useMemo(
    () => ({
      strip,
      selected,
      select,
      current,
      register,
      sectionAt,
      panelAt,
      navHeight,
      scrolled,
    }),
    [
      strip,
      selected,
      select,
      current,
      register,
      sectionAt,
      panelAt,
      navHeight,
      scrolled,
    ]
  )
}
