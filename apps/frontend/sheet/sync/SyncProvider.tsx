import { useQueryClient } from '@tanstack/react-query'
import { useToast } from '@tms/ui'
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react'
import { useSession } from '../../lib/session/SessionProvider'
import { createMemoryOutbox, type Outbox, type QueuedBatch } from './outbox'
import { postEvents } from './post'
import type { PostOutcome } from './sender'
import { createSync, type Sync } from './sync'

const SyncContext = createContext<Sync | null>(null)

/** Uma fila por app. O logout para o envio e apaga a fila (§7.2). */
export function SyncProvider({
  children,
  outbox,
  post = postEvents,
}: {
  readonly children: ReactNode
  readonly outbox?: Outbox
  readonly post?: (
    characterId: string,
    batch: QueuedBatch
  ) => Promise<PostOutcome>
}) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const { session } = useSession()
  const [sync] = useState(() =>
    createSync({
      outbox: outbox ?? createMemoryOutbox(),
      post,
      queryClient,
      notify: message => toast.show({ message }),
    })
  )
  useEffect(
    () =>
      session.onSignOut(() => {
        void sync.reset()
      }),
    [session, sync]
  )
  // Desmontou (app fechando, testes): nenhum backoff fica rodando
  useEffect(() => () => sync.sender.reset(), [sync])
  return <SyncContext.Provider value={sync}>{children}</SyncContext.Provider>
}

export function useSync(): Sync {
  const sync = useContext(SyncContext)
  if (!sync) throw new Error('useSync precisa de um SyncProvider')
  return sync
}
