import {
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'
import { SessionProvider } from '../../../lib/session/SessionProvider'
import {
  createMemoryDraftStore,
  type DraftStore,
} from '../../../sheet/sync/draftStore'
import {
  createMemoryOutbox,
  type QueuedBatch,
} from '../../../sheet/sync/outbox'
import type { PostOutcome } from '../../../sheet/sync/sender'
import {
  json,
  memoryStore,
  renderWithSession,
  testSession,
  tokens,
} from '../../../test/session'
import { LogoutButton } from '../LogoutButton'

// T-14 (QAW-33): sair com o Sangue gasto offline ainda na fila apagava a
// fila sem aviso. Agora o "Sair" tenta enviar e, se sobrar, pergunta.

const CHARACTER = '00000000-0000-4000-8000-00000000c001'
const batch = (n: number): QueuedBatch => ({
  clientBatchId: `00000000-0000-4000-8000-0000000000b${n}`,
  label: 'Sangue −1',
  events: [{ path: 'values.blood', from: { current: 9 }, to: { current: 8 } }],
})

async function signedIn() {
  const result = testSession(
    url =>
      url.endsWith('/auth/logout')
        ? new Response(null, { status: 204 })
        : json(200, tokens()),
    memoryStore(true, 'refresh-0')
  )
  await result.session.restore()
  return result
}

async function outboxWith(count: number) {
  const outbox = createMemoryOutbox()
  for (let n = 1; n <= count; n++) await outbox.enqueue(CHARACTER, batch(n))
  return outbox
}

const offline: () => Promise<PostOutcome> = async () => ({
  status: 0,
  body: null,
})

const pressSair = () =>
  act(async () => {
    fireEvent.press(screen.getByRole('button', { name: 'Sair' }))
  })

afterEach(() => {
  onlineManager.setOnline(true)
})

describe('LogoutButton', () => {
  it('sem pendência, sai direto', async () => {
    const { session, fetch } = await signedIn()
    renderWithSession(<LogoutButton />, session, {
      outbox: createMemoryOutbox(),
      post: offline,
    })
    await pressSair()
    await waitFor(() => expect(session.getState().status).toBe('signedOut'))
    expect(screen.queryByText('Sair e descartar?')).toBeNull()
    expect(fetch.mock.calls.map(c => c[0])).toContain(
      'http://api.test/auth/logout'
    )
  })

  it('com pendência no outbox, avisa e só sai com "Sair e descartar"', async () => {
    onlineManager.setOnline(false)
    const { session } = await signedIn()
    renderWithSession(<LogoutButton />, session, {
      outbox: await outboxWith(2),
      post: offline,
    })
    // A fila conta o que ficou no aparelho ao abrir
    await act(() => new Promise(r => setTimeout(r, 0)))
    await pressSair()
    expect(await screen.findByText('Sair e descartar?')).toBeTruthy()
    expect(
      screen.getByText(
        '2 alterações ainda não foram enviadas e serão descartadas neste aparelho.'
      )
    ).toBeTruthy()
    expect(session.getState().status).toBe('signedIn')
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Sair e descartar' }))
    })
    await waitFor(() => expect(session.getState().status).toBe('signedOut'))
  })

  it('"Continuar conectado" não sai', async () => {
    onlineManager.setOnline(false)
    const { session } = await signedIn()
    renderWithSession(<LogoutButton />, session, {
      outbox: await outboxWith(1),
      post: offline,
    })
    await act(() => new Promise(r => setTimeout(r, 0)))
    await pressSair()
    expect(
      await screen.findByText(
        '1 alteração ainda não foi enviada e será descartada neste aparelho.'
      )
    ).toBeTruthy()
    await act(async () => {
      fireEvent.press(
        screen.getByRole('button', { name: 'Continuar conectado' })
      )
    })
    expect(session.getState().status).toBe('signedIn')
    await waitFor(() =>
      expect(screen.queryByText('Sair e descartar?')).toBeNull()
    )
  })

  it('com rede, envia a fila antes; se ela esvazia, sai sem perguntar', async () => {
    const { session } = await signedIn()
    const post = jest.fn(
      async (): Promise<PostOutcome> => ({
        status: 200,
        body: { sheetVersion: 1, sheet: { values: {} } },
      })
    )
    renderWithSession(<LogoutButton />, session, {
      outbox: await outboxWith(1),
      post,
    })
    await pressSair()
    await waitFor(() => expect(session.getState().status).toBe('signedOut'))
    expect(post).toHaveBeenCalled()
    expect(screen.queryByText('Sair e descartar?')).toBeNull()
  })

  it('sem SyncProvider (só a sessão), sai direto', async () => {
    const { session } = await signedIn()
    render(
      <QueryClientProvider client={new QueryClient()}>
        <SessionProvider session={session}>
          <LogoutButton />
        </SessionProvider>
      </QueryClientProvider>
    )
    await pressSair()
    await waitFor(() => expect(session.getState().status).toBe('signedOut'))
  })
})

// P03-C (T-03): o rascunho de Criação/Editar guardado no aparelho também se
// perde no logout; o aviso de "Sair" passa a contá-lo
describe('LogoutButton com rascunho guardado', () => {
  async function draftsWith(count: number): Promise<DraftStore> {
    const drafts = createMemoryDraftStore()
    for (let n = 1; n <= count; n++)
      await drafts.write({
        v: 1,
        characterId: `00000000-0000-4000-8000-00000000c00${n}`,
        templateVersion: '1.0.0',
        baseVersion: 1,
        mode: 'evolve',
        savedAt: Date.now(),
        edits: [{ path: 'values.sire', from: 'Anônimo', to: 'Etrius' }],
      })
    return drafts
  }

  it('só com rascunho, avisa; "Sair e descartar" sai e apaga o rascunho', async () => {
    const { session } = await signedIn()
    const drafts = await draftsWith(1)
    renderWithSession(<LogoutButton />, session, {
      outbox: createMemoryOutbox(),
      drafts,
      post: offline,
    })
    await pressSair()
    expect(await screen.findByText('Sair e descartar?')).toBeTruthy()
    expect(
      screen.getByText(
        'O rascunho não salvo de 1 ficha será descartado neste aparelho.'
      )
    ).toBeTruthy()
    // Nenhum valor de campo no aviso
    expect(screen.queryByText(/Etrius|Anônimo/)).toBeNull()
    expect(session.getState().status).toBe('signedIn')
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Sair e descartar' }))
    })
    await waitFor(() => expect(session.getState().status).toBe('signedOut'))
    expect(await drafts.characters()).toEqual([])
  })

  it('com fila pendente e rascunhos, diz as duas coisas', async () => {
    onlineManager.setOnline(false)
    const { session } = await signedIn()
    renderWithSession(<LogoutButton />, session, {
      outbox: await outboxWith(1),
      drafts: await draftsWith(2),
      post: offline,
    })
    await act(() => new Promise(r => setTimeout(r, 0)))
    await pressSair()
    expect(
      await screen.findByText(
        '1 alteração ainda não foi enviada e será descartada neste aparelho. Os rascunhos não salvos de 2 fichas serão descartados neste aparelho.'
      )
    ).toBeTruthy()
  })

  it('"Continuar conectado" mantém o rascunho', async () => {
    const { session } = await signedIn()
    const drafts = await draftsWith(1)
    renderWithSession(<LogoutButton />, session, {
      outbox: createMemoryOutbox(),
      drafts,
      post: offline,
    })
    await pressSair()
    await act(async () => {
      fireEvent.press(
        await screen.findByRole('button', { name: 'Continuar conectado' })
      )
    })
    expect(session.getState().status).toBe('signedIn')
    expect(await drafts.characters()).toHaveLength(1)
  })
})
