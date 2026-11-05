import { useSheetSelector } from '../context'
import { type StepAdvice, type StepDirection, stepAdvice } from './creation'

const same = (a: StepAdvice | null, b: StepAdvice | null): boolean =>
  a === b ||
  (a !== null &&
    b !== null &&
    a.blocked === b.blocked &&
    a.text === b.text &&
    a.cost === b.cost &&
    a.inline === b.inline)

/**
 * A previsão do "+" (ou do "−", com `direction`, T-85) de um caminho (T-20,
 * R-17), só em Criação com a conta.
 * Igualdade rasa: a linha re-renderiza só quando a previsão dela muda, não a
 * cada ponto noutro grupo (arquitetura §6.5). Aceita caminho de item
 * (`values.<lista>#<item>`), para as folhas do P07-C.
 */
export const useStepAdvice = (
  path: string,
  direction: StepDirection = 'up'
): StepAdvice | null =>
  useSheetSelector(
    s =>
      s.mode === 'create' && s.check
        ? stepAdvice(
            s.model,
            s.check,
            s.creationPhase,
            path,
            s.resolved,
            direction
          )
        : null,
    same
  )
