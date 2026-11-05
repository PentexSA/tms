import type { CreationAdvice } from '@tms/sheet-core'
import { useSheetSelector } from '../context'
import { adviceOf } from '../evolve/recommend'
import { type AdviceNotice, adviceNotices } from './creation'

export const sameNotices = (
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

const NONE: readonly AdviceNotice[] = []

// As frases de cada lista de avisos (a mesma enquanto a ficha não muda)
const textCache = new WeakMap<
  readonly CreationAdvice[],
  readonly AdviceNotice[]
>()

/**
 * O que a criação só avisa (D-07, D-09), com a ficha mostrada (o rascunho):
 * Dom acima do Posto 1, Disciplina fora do clã, Esfera fora da Tradição.
 * Fora de `problems`: não conta no "Faltam" nem muda o "Concluir". Só com
 * `enabled` (a ficha em criação); a conta é feita uma vez por ficha
 * resolvida (`adviceOf`), a mesma que as linhas leem. Quem chama: o painel
 * de pontos; o `useCreationNotices` do P05-D, no rebase. Igualdade rasa:
 * só re-renderiza quando um aviso muda.
 */
export const useCreationAdvice = (enabled: boolean): readonly AdviceNotice[] =>
  useSheetSelector(s => {
    if (!enabled) return NONE
    const advice = adviceOf(s.model, s.resolved)
    const cached = textCache.get(advice)
    if (cached) return cached
    const notices = adviceNotices(s.model, advice)
    textCache.set(advice, notices)
    return notices
  }, sameNotices)
