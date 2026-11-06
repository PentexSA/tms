import {
  costOf,
  type FieldId,
  type SheetData,
  type SheetModel,
  type XpTarget,
} from '@tms/sheet-core'
import { createContext, useContext, useMemo } from 'react'
import { xpCandidates } from './candidates'

// U-01: o "Peça ao narrador." do Editar leva a "Solicitar evolução" com o
// traço já escolhido. O contexto só existe para a dona, com a ficha ativa e
// sem trava, num template com extrato de XP (o SheetScreen decide); fora
// disso (prévia, Mesa, `viewer`, narrador), ele é nulo, e os editores
// mostram só a frase. O servidor confere tudo de novo no pedido.

/** O que abrir: um traço marcado ou, numa lista, a busca pelo nome dela. */
export type XpShortcutTarget =
  | { readonly target: XpTarget }
  | { readonly query: string; readonly field: FieldId }

export interface XpShortcut {
  /** O traço tem regra de XP nesta ficha (o atalho só aparece assim). */
  readonly offers: (to: XpShortcutTarget) => boolean
  readonly open: (to: XpShortcutTarget) => void
}

export const XpShortcutContext = createContext<XpShortcut | null>(null)

export const useXpShortcut = (): XpShortcut | null =>
  useContext(XpShortcutContext)

/** O atalho sobre a ficha confirmada pelo servidor (a do pedido). */
export function useXpShortcutValue(
  enabled: boolean,
  model: SheetModel | null,
  sheet: SheetData | null,
  open: (to: XpShortcutTarget) => void
): XpShortcut | null {
  return useMemo(() => {
    if (!enabled || !model || !sheet) return null
    // Sob demanda: só o alvo do editor que mostra a nota, nunca a lista
    // inteira a cada ficha nova do Jogo. Só o que tem custo agora (no
    // máximo ou sem pré-requisito, o servidor recusaria)
    return {
      offers: to =>
        'target' in to
          ? costOf(model, sheet, to.target).ok
          : xpCandidates(model, sheet, to.field).some(c => c.cost.ok),
      open,
    }
  }, [enabled, model, sheet, open])
}
