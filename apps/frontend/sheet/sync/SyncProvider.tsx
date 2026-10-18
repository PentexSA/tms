import { onlineManager, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@tms/ui'
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from 'react'
import { useUserStorage } from '../../lib/persist'
import { useSession } from '../../lib/session/SessionProvider'
import { createMemoryOutbox, type Outbox, type QueuedBatch } from './outbox'
import { createPersistedOutbox } from './persistedOutbox'
import { postEvents } from './post'
import type { PostOutcome } from './sender'
import { createSync, type Sync, type SyncStatus } from './sync'

const SyncContext = createContext<Sync | null>(null)

/**
 * Uma fila por usuário. Com o OfflineProvider, a fila fica no storage do
 * usuário e sobrevive a reiniciar o app; sem ele, em memória. Ao abrir, conta
 * e retoma o que ficou; ao reconectar, tenta tudo já. O logout para o envio e
 * apaga a fila (§7.2).
 */
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
  const userStorage = useUserStorage()
  const sync = useMemo(
    () =>
      createSync({
        outbox:
          outbox ??
          (userStorage
            ? createPersistedOutbox(userStorage)
            : createMemoryOutbox()),
        post,
        queryClient,
        notify: message => toast.show({ message }),
      }),
    [outbox, userStorage, post, queryClient, toast]
  )
  useEffect(
    () =>
      session.onSignOut(() => {
        void sync.reset()
      }),
    [session, sync]
  )
  useEffect(() => {
    void sync.start()
    const unsubscribe = onlineManager.subscribe(online => {
      if (online) void sync.flush()
    })
    // Desmontou (troca de usuário, app fechando, testes): nenhum backoff fica
    return () => {
      unsubscribe()
      sync.sender.reset()
    }
  }, [sync])
  return <SyncContext.Provider value={sync}>{children}</SyncContext.Provider>
}

export function useSync(): Sync {
  const sync = useContext(SyncContext)
  if (!sync) throw new Error('useSync precisa de um SyncProvider')
  return sync
}

export function useSyncStatus(): SyncStatus {
  const { status } = useSync()
  return useSyncExternalStore(status.subscribe, status.getSnapshot)
}
