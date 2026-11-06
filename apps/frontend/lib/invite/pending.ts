// O código de um convite que chegou por link (D-14, P12), enquanto a pessoa
// entra ou cria a conta. Só na memória do processo: nada no SecureStore, no
// IndexedDB, no sessionStorage nem no cache do TanStack. Recarregar a página
// no meio do login perde o código, e a pessoa abre o link de novo: é o custo
// de não gravar um segredo no aparelho. Nenhum console.* aqui.

/** Depois disso o código pendente some, mesmo sem uso. */
export const PENDING_INVITE_TTL_MS = 30 * 60 * 1000

let pending: { readonly code: string; readonly at: number } | null = null
const listeners = new Set<() => void>()

const notify = () => {
  for (const listener of listeners) listener()
}

/** Guarda o código (o mais novo substitui o anterior) e avisa quem assina. */
export function setPendingInvite(code: string): void {
  pending = { code, at: Date.now() }
  notify()
}

/**
 * O código pendente, sem consumir: ler duas vezes devolve o mesmo (o
 * StrictMode chama o inicializador do useState duas vezes).
 */
export function peekPendingInvite(): string | null {
  if (!pending) return null
  if (Date.now() - pending.at > PENDING_INVITE_TTL_MS) {
    pending = null
    return null
  }
  return pending.code
}

export const hasPendingInvite = (): boolean => peekPendingInvite() !== null

/** No aceite, no "‹" de Entrar com convite e no logout explícito. */
export function clearPendingInvite(): void {
  if (!pending) return
  pending = null
  notify()
}

/** Avisa quando um código novo chega com a tela aberta (link colado, deep link). */
export function subscribePendingInvite(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
