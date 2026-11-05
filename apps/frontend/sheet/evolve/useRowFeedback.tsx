import { type StepperAdvice, Text } from '@tms/ui'
import type { ReactNode } from 'react'
import { Platform, StyleSheet } from 'react-native'
import { useStepAdvice } from '../creation/useStepAdvice'
import { DraftNoticeText } from './DraftNoticeText'
import { useDraftNotice } from './hooks'

/**
 * O que uma linha numérica mostra da conta, antes e depois do toque (T-20,
 * T-55, R-17): o aviso do toque recusado, o custo ou o motivo escrito sob o
 * rótulo quando o cabeçalho do grupo não o diz (com o aviso aberto, o aviso
 * fala por ele) e a previsão do "+", que aponta o texto visível no web. O
 * "−" tem a previsão dele (T-85: não desce abaixo do inicial na criação).
 * Cada botão aponta o aviso só quando ele é do lado dele; senão, a própria
 * descrição (no web, o "−" bloqueado ganha um texto só para o leitor de
 * tela, porque o motivo não está escrito na linha).
 */
export function useRowFeedback(
  path: string,
  field: string
): {
  readonly notice: ReactNode
  readonly note: ReactNode
  readonly increase: StepperAdvice | undefined
  readonly decrease: StepperAdvice | undefined
} {
  const notice = useDraftNotice(path)
  const advice = useStepAdvice(path)
  const down = useStepAdvice(path, 'down')
  const written = !notice && advice?.inline && advice.text ? advice.text : null
  // O aviso aberto é do "−" quando a causa é a que o "−" prevê
  const downNotice =
    notice !== null && down?.blocked != null && notice.cause === down.blocked
  const upNotice = notice !== null && !downNotice
  const described =
    Platform.OS === 'web' && down?.blocked != null && !downNotice
      ? down.text
      : null
  return {
    notice: notice ? <DraftNoticeText notice={notice} field={field} /> : null,
    note:
      written || described ? (
        <>
          {written ? (
            <Text
              variant="caption"
              color="inkMuted"
              nativeID={`advice-${field}`}
              testID={`advice-${field}`}
            >
              {written}
            </Text>
          ) : null}
          {described ? (
            <Text
              nativeID={`advice-down-${field}`}
              testID={`advice-down-${field}`}
              aria-hidden
              style={styles.described}
            >
              {described}
            </Text>
          ) : null}
        </>
      ) : null,
    increase: advice
      ? {
          blocked: advice.blocked !== null,
          hint: advice.text,
          hintID: upNotice
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
          hintID: downNotice
            ? `notice-${field}`
            : described
              ? `advice-down-${field}`
              : null,
          ...(down.floor !== undefined ? { stop: down.floor } : {}),
        }
      : undefined,
  }
}

// Fora da tela e do leitor em navegação, mas lido como descrição pelo
// `aria-describedby` do "−"
const styles = StyleSheet.create({
  described: {
    position: 'absolute',
    width: 1,
    height: 1,
    overflow: 'hidden',
    opacity: 0,
  },
})
