import { type StepperIncrease, Text } from '@tms/ui'
import type { ReactNode } from 'react'
import { useStepAdvice } from '../creation/useStepAdvice'
import { DraftNoticeText } from './DraftNoticeText'
import { useDraftNotice } from './hooks'

/**
 * O que uma linha numérica mostra da conta, antes e depois do toque (T-20,
 * T-55, R-17): o aviso do toque recusado, o custo ou o motivo escrito sob o
 * rótulo quando o cabeçalho do grupo não o diz (com o aviso aberto, o aviso
 * fala por ele) e a previsão do "+", que aponta o texto visível no web. O
 * "−" tem a previsão dele (T-85: não desce abaixo do inicial na criação),
 * que só aponta o aviso aberto.
 */
export function useRowFeedback(
  path: string,
  field: string
): {
  readonly notice: ReactNode
  readonly note: ReactNode
  readonly increase: StepperIncrease | undefined
  readonly decrease: StepperIncrease | undefined
} {
  const notice = useDraftNotice(path)
  const advice = useStepAdvice(path)
  const down = useStepAdvice(path, 'down')
  const written = !notice && advice?.inline && advice.text ? advice.text : null
  return {
    notice: notice ? <DraftNoticeText notice={notice} field={field} /> : null,
    note: written ? (
      <Text
        variant="caption"
        color="inkMuted"
        nativeID={`advice-${field}`}
        testID={`advice-${field}`}
      >
        {written}
      </Text>
    ) : null,
    increase: advice
      ? {
          blocked: advice.blocked !== null,
          hint: advice.text,
          hintID: notice
            ? `notice-${field}`
            : written
              ? `advice-${field}`
              : null,
        }
      : undefined,
    decrease: down
      ? {
          blocked: down.blocked !== null,
          hint: down.text,
          hintID: notice ? `notice-${field}` : null,
        }
      : undefined,
  }
}
