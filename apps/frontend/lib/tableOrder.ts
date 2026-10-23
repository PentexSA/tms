import { create } from 'zustand'

// A ordem da Mesa, para navegar entre as fichas em Leitura deslizando
// (doc/plano-v3.md, Etapa 9; C-19 do avaliacao-ui-ux.md). A Mesa grava a
// ordem que está na tela (filtro e ordenação) quando o narrador abre uma
// ficha; a ficha só lê. Fica no aparelho, nunca vai ao servidor.

interface TableOrder {
  readonly chronicleId: string | null
  readonly ids: readonly string[]
  remember(chronicleId: string, ids: readonly string[]): void
}

export const useTableOrder = create<TableOrder>(set => ({
  chronicleId: null,
  ids: [],
  remember: (chronicleId, ids) => set({ chronicleId, ids: [...ids] }),
}))

export interface Neighbors {
  readonly prev: string | null
  readonly next: string | null
  // 1 a total; 0 quando a ficha não está na ordem
  readonly position: number
  readonly total: number
}

/** A ficha anterior e a próxima na ordem da Mesa. */
export function neighborsOf(ids: readonly string[], id: string): Neighbors {
  const i = ids.indexOf(id)
  if (i < 0) return { prev: null, next: null, position: 0, total: ids.length }
  return {
    prev: ids[i - 1] ?? null,
    next: ids[i + 1] ?? null,
    position: i + 1,
    total: ids.length,
  }
}

// O gesto começa a 24 px da borda, para não brigar com o voltar do iOS
export const EDGE = 24
const DISTANCE = 60

/**
 * Para onde vai um gesto horizontal: arrastar para a esquerda é a próxima
 * ficha; para a direita, a anterior. Vertical, curto ou da borda: nada.
 */
export function swipeTo(
  g: { readonly x0: number; readonly dx: number; readonly dy: number },
  width: number
): 'next' | 'prev' | null {
  if (g.x0 < EDGE || g.x0 > width - EDGE) return null
  if (Math.abs(g.dx) < DISTANCE || Math.abs(g.dx) < 2 * Math.abs(g.dy))
    return null
  return g.dx < 0 ? 'next' : 'prev'
}
