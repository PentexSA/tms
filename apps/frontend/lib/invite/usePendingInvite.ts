import { useSyncExternalStore } from 'react'

import { peekPendingInvite, subscribePendingInvite } from './pending'

/** O código pendente do link (ou null), atualizado quando outro chega. */
export function usePendingInvite(): string | null {
  return useSyncExternalStore(
    subscribePendingInvite,
    peekPendingInvite,
    peekPendingInvite
  )
}
