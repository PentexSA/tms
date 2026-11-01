import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react-native'
import { ToastProvider } from '@tms/ui'
import type { ReactElement } from 'react'
import { SessionProvider } from '../lib/session/SessionProvider'
import { Session, type SessionDeps } from '../lib/session/session'
import type { TokenStore } from '../lib/session/tokenStore'
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
  pending: string | null = null
) {
  let value = initial
  let pendingValue = pending
  const store: TokenStore & {
    value(): string | null
    pending(): string | null
  } = {
    refreshInBody: native,
    read: jest.fn(async () => (native ? value : null)),
    write: jest.fn(async (t: string) => {
      value = t
    }),
    clear: jest.fn(async () => {
      value = null
    }),
    // A revogação pendente do logout sem rede (T-14), à parte do token ativo
    pendingLogout: {
      read: jest.fn(async () => (native ? pendingValue : null)),
      write: jest.fn(async (t: string) => {
        pendingValue = t
      }),
      clear: jest.fn(async () => {
        pendingValue = null
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
            <SyncProvider outbox={sync.outbox} post={sync.post}>
              {ui}
            </SyncProvider>
          </ToastProvider>
        </SessionProvider>
      </QueryClientProvider>
    ),
  }
}
