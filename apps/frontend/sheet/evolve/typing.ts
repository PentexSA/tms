import { useSyncExternalStore } from 'react'

// "Digitar" do Editar (T-25): um campo de número aberto por vez. Abrir outro
// faz o anterior sair como se perdesse o foco (aplica o que foi digitado, ou
// fecha com a mensagem se o valor não vale). Um store global basta: há um
// editor de ficha por vez na tela.

interface Open {
  readonly id: string
  // O que o campo faz ao sair (o mesmo do onBlur)
  readonly leave: () => void
}

let current: Open | null = null
const listeners = new Set<() => void>()
const emit = () => {
  for (const listener of listeners) listener()
}
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const typingStore = {
  /** Abre o campo `id`; o que estava aberto sai antes (`leave`). */
  open(id: string, leave: () => void) {
    const previous = current
    current = { id, leave }
    if (previous && previous.id !== id) previous.leave()
    emit()
  },
  /** Fecha o campo `id`, se for ele o aberto. */
  close(id: string) {
    if (current?.id !== id) return
    current = null
    emit()
  },
  /** O id aberto agora (testes). */
  current: (): string | null => current?.id ?? null,
}

/** O campo `id` está aberto para digitar? */
export function useTyping(id: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => current?.id === id,
    () => false
  )
}

/**
 * O número digitado, ou `null` se não vale: só inteiro (sem decimal, sem
 * espaço no meio), dentro da faixa do template.
 */
export function parseTyped(
  text: string,
  min: number,
  max: number
): number | null {
  const clean = text.trim()
  if (!/^-?\d+$/.test(clean)) return null
  const n = Number(clean)
  return n >= min && n <= max ? n : null
}
