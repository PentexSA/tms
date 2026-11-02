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
import {
  createMemoryDraftStore,
  createPersistedDraftStore,
  type DraftStore,
} from './draftStore'
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
  drafts,
  post = postEvents,
}: {
  readonly children: ReactNode
  readonly outbox?: Outbox
  readonly drafts?: DraftStore
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
        // O rascunho de Criação/Editar fica no mesmo storage do usuário
        // (cifrado no app, IndexedDB no web) e sai com ele no logout
        drafts:
          drafts ??
          (userStorage
            ? createPersistedDraftStore(userStorage)
            : createMemoryDraftStore()),
        post,
        queryClient,
        notify: message => toast.show({ message }),
      }),
    [outbox, drafts, userStorage, post, queryClient, toast]
  )
  // O logout espera a fila parar e ser apagada (T-14)
  useEffect(() => session.onSignOut(() => sync.reset()), [session, sync])
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

/** A fila, se houver SyncProvider (telas e testes que montam só a sessão). */
export function useOptionalSync(): Sync | null {
  return useContext(SyncContext)
}

export function useSyncStatus(): SyncStatus {
  const { status } = useSync()
  return useSyncExternalStore(status.subscribe, status.getSnapshot)
}

export interface LocalChanges {
  // Lotes no outbox, esperando o servidor
  readonly pending: number
  // Fichas com rascunho de Criação/Editar guardado no aparelho
  readonly drafts: number
}

/** Sem SyncProvider não há nada guardado no aparelho. */
const NOTHING = () => 0
const NO_SUBSCRIPTION = () => () => undefined

/**
 * O que só existe neste aparelho e o logout apaga: a fila e os rascunhos. É a
 * conta do aviso de "Sair" (P02, T-14). Sem SyncProvider, zero e zero.
 */
export function useLocalChanges(): LocalChanges {
  const sync = useOptionalSync()
  const pending = useSyncExternalStore(
    sync?.status.subscribe ?? NO_SUBSCRIPTION,
    () => sync?.status.getSnapshot().pending ?? 0
  )
  const drafts = useSyncExternalStore(
    sync?.drafts.count.subscribe ?? NO_SUBSCRIPTION,
    sync?.drafts.count.getSnapshot ?? NOTHING
  )
  useEffect(() => {
    // A primeira contagem lê o disco (os rascunhos de antes de abrir o app)
    void sync?.drafts.characters().catch(() => undefined)
  }, [sync])
  return { pending, drafts }
}
