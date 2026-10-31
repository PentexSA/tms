import type { PriorityBudget } from '@tms/sheet-core'
import { useToast } from '@tms/ui'

import { messageOf } from '../../lib/errors'
import { useSaveCreation } from '../../lib/queries/creation'
import { useCreation } from './CreationContext'
import {
  creationRefusalOf,
  errorBodyOf,
  REFUSAL_TEXT,
  rankLabel,
  reorder,
} from './creation'

export interface PriorityChoice {
  // A posição do grupo na ordem salva, ou -1 sem ordem
  readonly rank: number
  readonly values: readonly number[]
  readonly options: readonly {
    readonly id: string
    readonly label: string
    readonly spoken: string
  }[]
  readonly choose: (rank: number) => void
  readonly busy: boolean
}

/**
 * A prioridade de um grupo de um `priority-budget`, escolhida no cabeçalho do
 * próprio grupo ("Físicos: 7 · 5 · 3"). Escolher uma posição ocupada troca
 * os dois grupos de lugar. Só em `creating`: depois, a escolha fica fixa.
 */
export function usePriorityChoice(
  budget: PriorityBudget | null,
  group: string | null
): PriorityChoice | null {
  const creation = useCreation()
  const toast = useToast()
  const save = useSaveCreation(creation?.characterId ?? '')
  const info = creation?.info
  if (!budget || !group || !info || creation?.status !== 'creating') return null
  const label = budget.groups.find(g => g.id === group)?.label ?? group
  const order = info.choices.priorities?.[budget.id]
  const values =
    (info.effective.budgets?.[budget.id] as number[] | undefined) ??
    budget.budgets
  const choose = (rank: number) =>
    save.mutate(
      {
        revision: info.revision,
        choices: {
          priorities: {
            ...(info.choices.priorities ?? {}),
            [budget.id]: reorder(
              order,
              budget.groups.map(g => g.id),
              group,
              rank
            ),
          },
        },
      },
      {
        onError: error => {
          const code = creationRefusalOf(errorBodyOf(error))
          toast.show({
            message: code
              ? REFUSAL_TEXT[code]
              : messageOf(error, 'Não foi possível salvar as prioridades.'),
          })
        },
      }
    )
  return {
    rank: order ? order.indexOf(group) : -1,
    values,
    options: values.map((n, i) => ({
      id: String(i),
      label: String(n),
      spoken: `${label}, ${rankLabel(i)}, ${n} pontos`,
    })),
    choose,
    busy: save.isPending,
  }
}
