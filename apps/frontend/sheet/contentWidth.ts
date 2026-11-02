import { tokens } from '@tms/ui'

/**
 * A largura útil do conteúdo da ficha numa janela: até a largura máxima do
 * conteúdo, menos as margens da página. A identidade em colunas (T-65) e a
 * célula densa da grade (T-68) medem pela mesma conta.
 */
export const contentWidthOf = (windowWidth: number) =>
  Math.min(windowWidth, tokens.layout.contentMaxExpanded) -
  2 * tokens.layout.gutter
