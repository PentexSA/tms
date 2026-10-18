import { QueryClient } from '@tanstack/react-query'
import { sheetFor } from '../../../test/fixtures'
import { sheetKeys } from '../../data'
import { createSheetStore } from '../../store/sheetStore'
import { createMemoryOutbox, type Outbox, type QueuedBatch } from '../outbox'
import type { PostOutcome } from '../sender'
import { createSync, rejectionMessage } from '../sync'

// Etapa 16: fila + envio + store + cache, sem tela.

const ID = '00000000-0000-4000-8000-00000000c001'
const { model, sheet } = sheetFor('helena', ['owner'])

const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve()
}

function setup(
  respond: (batch: QueuedBatch) => PostOutcome,
  outbox: Outbox = createMemoryOutbox()
) {
  const queryClient = new QueryClient()
  queryClient.setQueryData(sheetKeys.character(ID), {
    id: ID,
    name: 'Helena Varga',
    sheet,
    sheetVersion: 3,
  })
  const invalidate = jest.spyOn(queryClient, 'invalidateQueries')
  const notify = jest.fn()
  const post = jest.fn(async (_id: string, b: QueuedBatch) => respond(b))
  const sync = createSync({
    outbox,
    post,
    queryClient,
    notify,
    random: () => 0,
  })
  let n = 0
  const store = createSheetStore({
    characterId: ID,
    model,
    sheet,
    sheetVersion: 3,
    roles: ['owner'],
    sync,
    uuid: () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
  })
  const unregister = sync.register(ID, store)
  return {
    queryClient,
    invalidate,
    notify,
    post,
    sync,
    store,
    outbox,
    unregister,
  }
}

const blood = (from: number, to: number) => ({
  path: 'values.blood',
  from: { current: from },
  to: { current: to },
})
const withBlood = (current: number) => ({
  ...sheet,
  values: { ...sheet.values, blood: { current } },
})

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

it('confirmado: a ficha do servidor vira snapshot e atualiza o cache', async () => {
  const { store, queryClient, post, invalidate } = setup(() => ({
    status: 200,
    body: { sheetVersion: 4, sheet: withBlood(8), duplicate: false },
  }))
  await flush()
  store.getState().commit([blood(9, 8)], 'Sangue −1')
  await flush()
  expect(post).toHaveBeenCalledTimes(1)
  // Só o lote vai para a API: o rótulo fica no aparelho
  expect(post.mock.calls[0]?.[1]).toMatchObject({ events: [blood(9, 8)] })
  expect(store.getState().pending).toEqual([])
  expect(store.getState().sheetVersion).toBe(4)
  expect(
    queryClient.getQueryData<{ sheetVersion: number }>(sheetKeys.character(ID))
      ?.sheetVersion
  ).toBe(4)
  // Não mexeu no nome: a lista da crônica não precisa rebuscar
  expect(invalidate).not.toHaveBeenCalled()
})

it('mudou o nome: rebusca a ficha e a lista da crônica', async () => {
  const renamed = { ...sheet, values: { ...sheet.values, name: 'Helena V.' } }
  const { store, invalidate } = setup(() => ({
    status: 200,
    body: { sheetVersion: 4, sheet: renamed },
  }))
  await flush()
  store
    .getState()
    .commit(
      [{ path: 'values.name', from: 'Helena Varga', to: 'Helena V.' }],
      'Nome'
    )
  await flush()
  expect(invalidate).toHaveBeenCalledWith({ queryKey: sheetKeys.character(ID) })
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['chronicles'] })
})

it('cache mais novo que a resposta não volta atrás', async () => {
  const { store, queryClient } = setup(() => ({
    status: 200,
    body: { sheetVersion: 4, sheet: withBlood(8) },
  }))
  queryClient.setQueryData(sheetKeys.character(ID), {
    id: ID,
    sheet: withBlood(1),
    sheetVersion: 9,
  })
  await flush()
  store.getState().commit([blood(9, 8)], 'Sangue −1')
  await flush()
  expect(
    queryClient.getQueryData<{ sheetVersion: number }>(sheetKeys.character(ID))
      ?.sheetVersion
  ).toBe(9)
})

it('409: o store guarda o conflito e a ficha é rebuscada', async () => {
  const { store, invalidate } = setup(() => ({
    status: 409,
    body: { current: { 'values.blood': { current: 2 } }, sheetVersion: 5 },
  }))
  await flush()
  store.getState().commit([blood(9, 8)], 'Sangue −1')
  await flush()
  expect(store.getState().conflict?.paths).toEqual(['values.blood'])
  expect(invalidate).toHaveBeenCalledWith({ queryKey: sheetKeys.character(ID) })
})

it.each([
  [403, 'Sem permissão para “Sangue −1”. A alteração foi desfeita.'],
  [422, 'O servidor recusou “Sangue −1”. A alteração foi desfeita.'],
  [400, 'O servidor recusou “Sangue −1”. A alteração foi desfeita.'],
  [404, 'A ficha não está mais disponível. “Sangue −1” não foi salva.'],
])(
  '%i: o otimista volta atrás e a pessoa é avisada',
  async (status, message) => {
    const { store, notify } = setup(() => ({ status, body: { error: 'x' } }))
    await flush()
    store.getState().commit([blood(9, 8)], 'Sangue −1')
    expect(store.getState().values.values.blood).toEqual({ current: 8 })
    await flush()
    expect(store.getState().values.values.blood).toEqual({ current: 9 })
    expect(notify).toHaveBeenCalledWith(message)
    expect(rejectionMessage('Sangue −1', status)).toBe(message)
  }
)

it('sem rede: fica otimista, tenta de novo e confirma', async () => {
  let online = false
  const { store, post } = setup(() =>
    online
      ? { status: 200, body: { sheetVersion: 4, sheet: withBlood(8) } }
      : { status: 0, body: null }
  )
  await flush()
  store.getState().commit([blood(9, 8)], 'Sangue −1')
  await flush()
  expect(store.getState().pending).toHaveLength(1)
  expect(store.getState().values.values.blood).toEqual({ current: 8 })
  online = true
  jest.advanceTimersByTime(500)
  await flush()
  expect(post).toHaveBeenCalledTimes(2)
  expect(store.getState().pending).toEqual([])
  expect(store.getState().sheetVersion).toBe(4)
})

it('reabrir a ficha antes de sincronizar traz o otimista de volta', async () => {
  const outbox = createMemoryOutbox()
  await outbox.enqueue(ID, {
    clientBatchId: '00000000-0000-4000-8000-0000000000aa',
    events: [blood(9, 4)],
    label: 'Sangue −5',
  })
  const { store } = setup(() => ({ status: 0, body: null }), outbox)
  await flush()
  expect(store.getState().values.values.blood).toEqual({ current: 4 })
})

it('ficha fechada: a resposta ainda atualiza o cache', async () => {
  const { store, unregister, queryClient } = setup(() => ({
    status: 200,
    body: { sheetVersion: 4, sheet: withBlood(8) },
  }))
  await flush()
  unregister()
  store.getState().commit([blood(9, 8)], 'Sangue −1')
  await flush()
  expect(
    queryClient.getQueryData<{ sheetVersion: number }>(sheetKeys.character(ID))
      ?.sheetVersion
  ).toBe(4)
  // O store desligado não recebeu a confirmação
  expect(store.getState().pending).toHaveLength(1)
})

it('falha ao guardar na fila: o otimista volta atrás', async () => {
  const real = createMemoryOutbox()
  const outbox: Outbox = {
    ...real,
    enqueue: async () => {
      throw new Error('disco cheio')
    },
  }
  const { store, notify, post } = setup(
    () => ({ status: 200, body: null }),
    outbox
  )
  await flush()
  store.getState().commit([blood(9, 8)], 'Sangue −1')
  await flush()
  expect(store.getState().values.values.blood).toEqual({ current: 9 })
  expect(notify).toHaveBeenCalledWith(
    'Não foi possível guardar “Sangue −1” no aparelho.'
  )
  expect(post).not.toHaveBeenCalled()
})

it('logout: para o envio e apaga a fila', async () => {
  const { store, sync, outbox, post } = setup(() => ({
    status: 503,
    body: null,
  }))
  await flush()
  store.getState().commit([blood(9, 8)], 'Sangue −1')
  await flush()
  expect(await outbox.characters()).toEqual([ID])
  await sync.reset()
  expect(await outbox.characters()).toEqual([])
  jest.advanceTimersByTime(60_000)
  await flush()
  expect(post).toHaveBeenCalledTimes(1)
})

it('flush: reconectou, tenta já', async () => {
  const { store, sync, post } = setup(() => ({ status: 0, body: null }))
  await flush()
  store.getState().commit([blood(9, 8)], 'Sangue −1')
  await flush()
  void sync.flush()
  await flush()
  expect(post).toHaveBeenCalledTimes(2)
})
