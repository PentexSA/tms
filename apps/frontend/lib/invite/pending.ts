// O código de um convite que chegou por link (D-14, P12), enquanto a pessoa
// entra ou cria a conta. Só na memória do processo: nada no SecureStore, no
// IndexedDB, no sessionStorage nem no cache do TanStack. Recarregar a página
// no meio do login perde o código, e a pessoa abre o link de novo: é o custo
// de não gravar um segredo no aparelho. Nenhum console.* aqui.

/** Depois disso o código pendente some, mesmo sem uso. */
export const PENDING_INVITE_TTL_MS = 30 * 60 * 1000

let pending: string | null = null
let expiry: ReturnType<typeof setTimeout> | undefined
const listeners = new Set<() => void>()

const notify = () => {
  for (const listener of listeners) listener()
}

/** Guarda o código (o mais novo substitui o anterior) e avisa quem assina. */
export function setPendingInvite(code: string): void {
  pending = code
  clearTimeout(expiry)
  // A validade apaga e avisa: a leitura (peek) fica pura
  expiry = setTimeout(clearPendingInvite, PENDING_INVITE_TTL_MS)
  notify()
}

/**
 * O código pendente, sem consumir nem mudar nada: é o getSnapshot do
 * useSyncExternalStore, e ler duas vezes devolve o mesmo.
 */
export const peekPendingInvite = (): string | null => pending

export const hasPendingInvite = (): boolean => pending !== null

/** No aceite, ao sair de Entrar com convite, na validade e ao sair da conta. */
export function clearPendingInvite(): void {
  clearTimeout(expiry)
  expiry = undefined
  if (pending === null) return
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
