import { tokens } from '@tms/ui'
import { createContext, useContext } from 'react'

// Célula densa (T-68; DS Grid / Cell: "container ≤ 400: padding menor").
// Com a grade estreita, a célula de 1/3 tem 86 a 96 dp úteis para os pips
// (76), o espaço e o número: o número colava ou saía da célula. O GridLayout
// liga o contexto; a célula usa padding e espaço menores.
const Dense = createContext(false)

export const DenseCells = Dense.Provider
export const useDenseCells = () => useContext(Dense)

/** Largura da grade até a qual as células ficam densas (DS: ≤ 400). */
export const DENSE_GRID_MAX = 400

/** A largura útil da grade numa janela: o conteúdo menos as margens. */
export const gridWidthOf = (windowWidth: number) =>
  Math.min(windowWidth, tokens.layout.contentMaxExpanded) -
  2 * tokens.layout.gutter
