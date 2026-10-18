import { QueryClient } from '@tanstack/react-query'
import { applyBatch, type SheetData } from '@tms/sheet-core'
import { sheetFor } from '../../../test/fixtures'
import { sheetKeys } from '../../data'
import { createSheetStore } from '../../store/sheetStore'
import { createMemoryStorage, type KeyValueStorage, scopeStorage } from '../kv'
import type { QueuedBatch } from '../outbox'
import { createPersistedOutbox } from '../persistedOutbox'
import type { PostOutcome } from '../sender'
import { createSync } from '../sync'

// Etapa 20: o jogo continua sem rede e sincroniza ao voltar. Um servidor
// falso aplica com o mesmo applyBatch e é idempotente por clientBatchId,
// como a API (apps/api/src/sheets/events.ts).

const ID = '00000000-0000-4000-8000-00000000c001'
const USER = '00000000-0000-4000-8000-0000000000a1'
const { model, sheet: initial } = sheetFor('helena', ['owner'])

const flush = async () => {
  // O outbox persistido encadeia várias promessas por operação
  for (let i = 0; i < 300; i++) await Promise.resolve()
}

function fakeServer() {
  let sheet: SheetData = initial
  let version = 3
  const applied = new Set<string>()
  const order: string[] = []
  const state = { online: true, dropNextAnswer: false }
  const post = jest.fn(
    async (_id: string, b: QueuedBatch): Promise<PostOutcome> => {
      if (!state.online) throw new Error('Network request failed')
      if (applied.has(b.clientBatchId))
        return {
          status: 200,
          body: { sheetVersion: version, sheet, duplicate: true },
        }
      const r = applyBatch(model, sheet, b, ['owner'])
      if (!r.ok) return { status: 409, body: { issues: r.issues } }
      sheet = r.sheet
      version++
      applied.add(b.clientBatchId)
      order.push(b.label)
      // Gravou e a conexão caiu antes da resposta chegar
      if (state.dropNextAnswer) {
        state.dropNextAnswer = false
        throw new Error('Network request failed')
      }
      return {
        status: 200,
        body: { sheetVersion: version, sheet, duplicate: false },
      }
    }
  )
  return {
    post,
    state,
    sheet: () => sheet,
    version: () => version,
    order,
  }
}

// Ids únicos entre "apps" (o relógio está parado nos timers falsos)
let ids = 0
const nextId = () =>
  `00000000-0000-4000-8000-${String(++ids).padStart(12, '0')}`

/** Um "app": cache, fila no storage do usuário, store da ficha aberta. */
function openApp(
  storage: KeyValueStorage,
  server: ReturnType<typeof fakeServer>
) {
  const queryClient = new QueryClient()
  const outbox = createPersistedOutbox(scopeStorage(storage, USER))
  const sync = createSync({
    outbox,
    post: server.post,
    queryClient,
    notify: jest.fn(),
    random: () => 0,
  })
  const store = createSheetStore({
    characterId: ID,
    model,
    sheet: initial,
    sheetVersion: 3,
    roles: ['owner'],
    sync,
    uuid: nextId,
  })
  queryClient.setQueryData(sheetKeys.character(ID), {
    id: ID,
    sheet: initial,
    sheetVersion: 3,
  })
  const unregister = sync.register(ID, store)
  return { sync, store, outbox, queryClient, unregister }
}

const blood = (from: number, to: number) => ({
  path: 'values.blood',
  from: { current: from },
  to: { current: to },
})
const bloodOf = (s: SheetData) =>
  (s.values.blood as { current: number }).current

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

it('reiniciar o app mantém os pendentes e os envia em ordem', async () => {
  const storage = createMemoryStorage()
  const server = fakeServer()
  server.state.online = false

  const first = openApp(storage, server)
  await flush()
  first.store.getState().commit([blood(9, 8)], 'Sangue −1')
  first.store.getState().commit(
    [
      {
        path: 'values.health',
        from: { aggravated: 0, lethal: 1, bashing: 1 },
        to: { aggravated: 0, lethal: 2, bashing: 1 },
      },
    ],
    'Vitalidade +1 letal'
  )
  await flush()
  expect(bloodOf(first.store.getState().values)).toBe(8)
  // O app morre sem sincronizar (o backoff morre junto)
  first.sync.sender.reset()
  first.unregister()

  // Abre de novo, ainda sem rede: a ficha mostra o que foi feito
  const second = openApp(storage, server)
  await flush()
  expect(bloodOf(second.store.getState().values)).toBe(8)
  expect(second.store.getState().pending.map(b => b.label)).toEqual([
    'Sangue −1',
    'Vitalidade +1 letal',
  ])

  // A rede volta
  server.state.online = true
  await second.sync.start()
  await flush()
  expect(server.order).toEqual(['Sangue −1', 'Vitalidade +1 letal'])
  expect(server.version()).toBe(5)
  expect(bloodOf(server.sheet())).toBe(8)
  expect(second.store.getState().pending).toEqual([])
  expect(second.store.getState().sheetVersion).toBe(5)
  // O servidor ficou igual à tela
  expect(second.store.getState().snapshot).toEqual(server.sheet())
  expect(await second.outbox.characters()).toEqual([])
  second.sync.sender.reset()
})

it('a conexão cai entre a gravação no servidor e o ack: o reenvio é 200 idempotente', async () => {
  const server = fakeServer()
  server.state.dropNextAnswer = true
  const app = openApp(createMemoryStorage(), server)
  await flush()
  app.store.getState().commit([blood(9, 8)], 'Sangue −1')
  await flush()
  // O servidor já gravou, o aparelho não sabe
  expect(server.version()).toBe(4)
  expect(app.store.getState().pending).toHaveLength(1)
  expect(app.sync.status.getSnapshot()).toEqual({
    pending: 1,
    failure: 'network',
  })

  jest.advanceTimersByTime(500)
  await flush()
  expect(server.post).toHaveBeenCalledTimes(2)
  // Mesmo clientBatchId: aplicado uma vez só
  expect(server.post.mock.calls[0]?.[1].clientBatchId).toBe(
    server.post.mock.calls[1]?.[1].clientBatchId
  )
  expect(server.version()).toBe(4)
  expect(bloodOf(server.sheet())).toBe(8)
  expect(app.store.getState().pending).toEqual([])
  expect(app.store.getState().sheetVersion).toBe(4)
  expect(app.sync.status.getSnapshot()).toEqual({ pending: 0, failure: null })
  app.sync.sender.reset()
})

describe('estado da sincronização', () => {
  it('conta o que ficou na fila ao abrir, e erro do servidor é "server"', async () => {
    const storage = createMemoryStorage()
    const server = fakeServer()
    server.state.online = false
    const first = openApp(storage, server)
    await flush()
    first.store.getState().commit([blood(9, 8)], 'Sangue −1')
    await flush()
    first.sync.sender.reset()

    const second = openApp(storage, server)
    await second.sync.start()
    expect(second.sync.status.getSnapshot()).toEqual({
      pending: 1,
      failure: 'network',
    })

    const listener = jest.fn()
    const unsubscribe = second.sync.status.subscribe(listener)
    server.state.online = true
    server.post.mockResolvedValueOnce({ status: 503, body: null })
    await second.sync.flush()
    await flush()
    expect(second.sync.status.getSnapshot()).toEqual({
      pending: 1,
      failure: 'server',
    })
    expect(listener).toHaveBeenCalled()

    jest.advanceTimersByTime(1000)
    await flush()
    expect(second.sync.status.getSnapshot()).toEqual({
      pending: 0,
      failure: null,
    })
    unsubscribe()
    second.sync.sender.reset()
  })

  it('logout zera o estado e apaga a fila do usuário', async () => {
    const storage = createMemoryStorage()
    const server = fakeServer()
    server.state.online = false
    const app = openApp(storage, server)
    await flush()
    app.store.getState().commit([blood(9, 8)], 'Sangue −1')
    await flush()
    expect(app.sync.status.getSnapshot().pending).toBe(1)
    await app.sync.reset()
    expect(app.sync.status.getSnapshot()).toEqual({ pending: 0, failure: null })
    expect(await storage.keys('')).toEqual([])
  })

  it('rejeitado (422) também tira da contagem', async () => {
    const server = fakeServer()
    server.post.mockResolvedValueOnce({ status: 422, body: { issues: [] } })
    const app = openApp(createMemoryStorage(), server)
    await flush()
    app.store.getState().commit([blood(9, 8)], 'Sangue −1')
    await flush()
    expect(app.sync.status.getSnapshot()).toEqual({ pending: 0, failure: null })
    app.sync.sender.reset()
  })

  it('outbox que falha ao contar não derruba o estado', async () => {
    const queryClient = new QueryClient()
    const sync = createSync({
      outbox: {
        enqueue: async () => undefined,
        pending: async () => [],
        characters: async () => {
          throw new Error('disco')
        },
        ack: async () => undefined,
        drop: async () => undefined,
        clear: async () => {
          throw new Error('disco')
        },
      },
      post: async () => ({ status: 200, body: null }),
      queryClient,
      notify: jest.fn(),
    })
    await sync.start().catch(() => undefined)
    expect(sync.status.getSnapshot()).toEqual({ pending: 0, failure: null })
    await sync.reset()
    expect(sync.status.getSnapshot()).toEqual({ pending: 0, failure: null })
  })
})
