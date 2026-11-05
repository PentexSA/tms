import { creationAdvice } from '@tms/sheet-core'
import { useSheetSelector } from '../context'
import { type AdviceNotice, adviceNotices } from './creation'

const same = (
  a: readonly AdviceNotice[],
  b: readonly AdviceNotice[]
): boolean =>
  a === b ||
  (a.length === b.length &&
    a.every(
      (x, i) =>
        x.key === b[i]?.key &&
        x.text === b[i]?.text &&
        x.paths.join(',') === b[i]?.paths.join(',')
    ))

/**
 * O que a criação só avisa (D-07, D-09), com a ficha mostrada (o rascunho):
 * Dom acima do Posto 1, Disciplina fora do clã, Esfera fora da Tradição.
 * Fora de `problems`: não conta no "Faltam" nem muda o "Concluir". Quem
 * chama já está na criação (o painel de pontos; o `useCreationNotices` do
 * P05-D, no rebase). Igualdade rasa: só re-renderiza quando um aviso muda.
 */
export const useCreationAdvice = (): readonly AdviceNotice[] =>
  useSheetSelector(
    s => adviceNotices(s.model, creationAdvice(s.model, s.resolved)),
    same
  )
