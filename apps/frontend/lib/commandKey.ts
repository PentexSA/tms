import { randomUUID } from 'expo-crypto'
import { useRef } from 'react'

import { isNetworkError } from './errors'

// Comandos idempotentes (criação por pontos, Nova ficha, Nova crônica). Cada
// intenção leva uma chave (`clientCommandId`): depois de um timeout ou resposta
// perdida, a nova tentativa reusa a mesma chave e o servidor devolve o
// resultado gravado, sem aplicar duas vezes. A chave só muda quando a intenção
// termina (sucesso ou recusa com resposta).

/** Uma chave por intenção, mantida enquanto o resultado é desconhecido. */
export function useCommandKey() {
  const key = useRef<string | null>(null)
  return {
    current: () => {
      key.current ??= randomUUID()
      return key.current
    },
    settle: (error: unknown) => {
      // Sem resposta: a próxima tentativa é a mesma intenção
      if (!error || !isNetworkError(error)) key.current = null
    },
  }
}
