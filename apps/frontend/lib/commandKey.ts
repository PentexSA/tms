import { randomUUID } from 'expo-crypto'
import { useRef } from 'react'

import { isNetworkError, statusOf } from './errors'

// Comandos idempotentes (criação por pontos, Nova ficha, Nova crônica). Cada
// intenção leva uma chave (`clientCommandId`): depois de um timeout ou resposta
// perdida, a nova tentativa reusa a mesma chave e o servidor devolve o
// resultado gravado, sem aplicar duas vezes. A chave só muda quando a intenção
// termina: sucesso ou recusa terminal (4xx). Um 5xx (502/504 do proxy), 408,
// 429 ou erro de rede não dizem se o servidor gravou: a chave fica.

/** O resultado da intenção é desconhecido: a próxima tentativa é a mesma. */
export function outcomeUnknown(error: unknown): boolean {
  if (isNetworkError(error)) return true
  const status = statusOf(error)
  return (
    status === undefined || status >= 500 || status === 408 || status === 429
  )
}

/** Uma chave por intenção, mantida enquanto o resultado é desconhecido. */
export function useCommandKey() {
  const key = useRef<string | null>(null)
  return {
    current: () => {
      key.current ??= randomUUID()
      return key.current
    },
    settle: (error: unknown) => {
      if (!error || !outcomeUnknown(error)) key.current = null
    },
  }
}
