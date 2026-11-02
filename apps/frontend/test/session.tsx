import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react-native'
import { ToastProvider } from '@tms/ui'
import type { ReactElement } from 'react'
import { SessionProvider } from '../lib/session/SessionProvider'
import { Session, type SessionDeps } from '../lib/session/session'
import type { TokenStore } from '../lib/session/tokenStore'
import type { DraftStore } from '../sheet/sync/draftStore'
import type { Outbox, QueuedBatch } from '../sheet/sync/outbox'
import { SyncProvider } from '../sheet/sync/SyncProvider'
import type { PostOutcome } from '../sheet/sync/sender'

export const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })

export const tokens = (n = 1) => ({
  accessToken: `access-${n}`,
  refreshToken: `refresh-${n}`,
  expiresIn: 900,
  user: { id: '00000000-0000-4000-8000-000000000001', username: 'ana' },
})

export function memoryStore(
  native = true,
  initial: string | null = null,
  pending: readonly string[] = []
) {
  let value = initial
  let pendingValue: readonly string[] = pending
  const store: TokenStore & {
    value(): string | null
    pending(): readonly string[]
  } = {
    refreshInBody: native,
    read: jest.fn(async () => (native ? value : null)),
    write: jest.fn(async (t: string) => {
      value = t
    }),
    clear: jest.fn(async () => {
      value = null
    }),
    // As revogações pendentes do logout sem rede (T-14), à parte do ativo
    pendingLogout: {
      read: jest.fn(async () => (native ? [...pendingValue] : [])),
      write: jest.fn(async (tokens: readonly string[]) => {
        pendingValue = [...tokens]
      }),
    },
    value: () => value,
    pending: () => pendingValue,
  }
  return store
}

export function testSession(
  responses: (url: string, init: RequestInit) => Response | Promise<Response>,
  store = memoryStore(),
  deps: Omit<Partial<SessionDeps>, 'apiUrl' | 'store' | 'fetch'> = {}
) {
  const fetch = jest.fn(async (url: string, init: RequestInit) =>
    responses(url, init)
  )
  const session = new Session({
    apiUrl: 'http://api.test',
    store,
    fetch,
    ...deps,
  })
  return { session, fetch, store }
}

export interface SyncOptions {
  readonly outbox?: Outbox
  // Os rascunhos guardados: o mesmo entre dois renders simula reabrir o app
  readonly drafts?: DraftStore
  readonly post?: (id: string, batch: QueuedBatch) => Promise<PostOutcome>
}

/** Renderiza com QueryClient, sessão, toast e fila de sincronização. */
export function renderWithSession(
  ui: ReactElement,
  session: Session,
  sync: SyncOptions = {}
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Number.POSITIVE_INFINITY },
      mutations: { retry: false, gcTime: Number.POSITIVE_INFINITY },
    },
  })
  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <SessionProvider session={session}>
          <ToastProvider>
            <SyncProvider
              outbox={sync.outbox}
              drafts={sync.drafts}
              post={sync.post}
            >
              {ui}
            </SyncProvider>
          </ToastProvider>
        </SessionProvider>
      </QueryClientProvider>
    ),
  }
}
