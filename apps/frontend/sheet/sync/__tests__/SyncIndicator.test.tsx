import {
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react-native'
import { ToastProvider } from '@tms/ui'
import { OfflineProvider } from '../../../lib/persist'
import { SessionProvider } from '../../../lib/session/SessionProvider'
import { Session } from '../../../lib/session/session'
import { json, memoryStore } from '../../../test/session'
import { createMemoryStorage, scopeStorage } from '../kv'
import type { QueuedBatch } from '../outbox'
import { createPersistedOutbox } from '../persistedOutbox'
import { describeSync, OfflineBanner, SyncIndicator } from '../SyncIndicator'
import { SyncProvider, useSync } from '../SyncProvider'
import type { PostOutcome } from '../sender'

// Etapa 20: o indicador no header e o banner de offline.

const USER = { id: '00000000-0000-4000-8000-0000000000a1', username: 'ana' }
const ID = '00000000-0000-4000-8000-00000000c001'
const batch = (n: number): QueuedBatch => ({
  clientBatchId: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  events: [{ path: 'values.blood', from: { current: 9 }, to: { current: 8 } }],
  label: `#${n}`,
})

afterEach(() => {
  act(() => onlineManager.setOnline(true))
})

describe('describeSync', () => {
  it.each([
    [{ pending: 0, failure: null }, true, 'saved', 'Salvo'],
    [{ pending: 2, failure: null }, true, 'saving', 'Salvando…'],
    [{ pending: 1, failure: null }, false, 'offline', 'Offline · 1 pendente'],
    [
      { pending: 3, failure: 'network' },
      true,
      'offline',
      'Offline · 3 pendentes',
    ],
    [{ pending: 0, failure: null }, false, 'offline', 'Offline'],
    [
      { pending: 1, failure: 'server' },
      true,
      'error',
      'Erro ao salvar · tentando de novo',
    ],
    // Fila vazia: o erro passou
    [{ pending: 0, failure: 'server' }, true, 'saved', 'Salvo'],
  ] as const)('%j online=%s: %s', (status, online, state, text) => {
    expect(describeSync(status, online)).toEqual({ state, text })
  })
})

function signedInSession() {
  return new Session({
    apiUrl: 'http://api.test',
    store: memoryStore(true, 'refresh'),
    fetch: jest.fn(async () =>
      json(200, { accessToken: 'a', refreshToken: 'r', user: USER })
    ),
  })
}

let syncRef: ReturnType<typeof useSync> | undefined
function Capture() {
  syncRef = useSync()
  return null
}

function renderApp(
  storage: ReturnType<typeof createMemoryStorage>,
  post: (id: string, b: QueuedBatch) => Promise<PostOutcome>
) {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <SessionProvider session={signedInSession()}>
        <OfflineProvider storage={storage}>
          <ToastProvider>
            <SyncProvider post={post}>
              <Capture />
              <SyncIndicator />
              <OfflineBanner />
            </SyncProvider>
          </ToastProvider>
        </OfflineProvider>
      </SessionProvider>
    </QueryClientProvider>
  )
}

describe('na tela', () => {
  it('abre com o que ficou na fila do usuário e envia; offline mostra o banner', async () => {
    const storage = createMemoryStorage()
    // O que ficou de uma sessão anterior, no storage do usuário
    const previous = createPersistedOutbox(scopeStorage(storage, USER.id))
    await previous.enqueue(ID, batch(1))
    await previous.enqueue(ID, batch(2))

    let online = false
    const post = jest.fn(
      async (): Promise<PostOutcome> =>
        online
          ? { status: 200, body: { sheetVersion: 4, sheet: { values: {} } } }
          : { status: 0, body: null }
    )
    act(() => onlineManager.setOnline(false))
    renderApp(storage, post)
    expect(
      await screen.findByLabelText('Sincronização: Offline · 2 pendentes')
    ).toBeTruthy()
    expect(screen.getByText('Sem conexão')).toBeTruthy()

    // A rede volta: o flush manda tudo, na ordem
    online = true
    act(() => onlineManager.setOnline(true))
    expect(await screen.findByLabelText('Sincronização: Salvo')).toBeTruthy()
    expect(screen.queryByText('Sem conexão')).toBeNull()
    const labels = post.mock.calls.map(c => (c as unknown[])[1] as QueuedBatch)
    expect(
      labels.filter((_, i) => i >= labels.length - 2).map(b => b.label)
    ).toEqual(['#1', '#2'])
    expect(await previous.characters()).toEqual([])
  })

  it('erro do servidor: "Erro ao salvar"; enquanto envia: "Salvando…"', async () => {
    const storage = createMemoryStorage()
    let answer: (o: PostOutcome) => void = () => undefined
    const post = jest.fn(
      () =>
        new Promise<PostOutcome>(resolve => {
          answer = resolve
        })
    )
    renderApp(storage, post)
    await screen.findByLabelText('Sincronização: Salvo')
    await waitFor(() => expect(syncRef).toBeDefined())
    act(() => {
      syncRef?.enqueue(ID, batch(1))
    })
    expect(
      await screen.findByLabelText('Sincronização: Salvando…')
    ).toBeTruthy()
    await waitFor(() => expect(post).toHaveBeenCalled())
    await act(async () => {
      answer({ status: 503, body: null })
    })
    expect(
      await screen.findByLabelText(
        'Sincronização: Erro ao salvar · tentando de novo'
      )
    ).toBeTruthy()
    // Sai antes do backoff: nenhum timer fica rodando
    screen.unmount()
  })
})
