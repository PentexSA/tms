import * as apiModule from '../../../lib/api'
import type { createFakeApi } from '../../../test/fake-api'
import { postEvents } from '../post'

// O envio de um lote pelo Eden. Sem resposta HTTP, o Eden devolve 503 com o
// erro do fetch: para a fila isso é rede (0), e o indicador mostra "Offline".

jest.mock('../../../lib/api', () => {
  const { createFakeApi } = require('../../../test/fake-api')
  const fake = createFakeApi()
  return { ...jest.requireActual('../../../lib/api'), api: fake.api, fake }
})
const calls = (
  apiModule as unknown as { fake: ReturnType<typeof createFakeApi> }
).fake.calls

const batch = {
  clientBatchId: '00000000-0000-4000-8000-000000000001',
  events: [{ path: 'values.blood', from: null, to: { current: 9 } }],
  label: 'Sangue −1',
}
const response = {} as Response

it('só o lote vai para a API (o rótulo fica no aparelho)', async () => {
  calls.eventsPost.mockResolvedValue({
    data: { sheetVersion: 1 },
    error: null,
    status: 200,
    response,
    headers: {},
  })
  expect(await postEvents('c1', batch)).toEqual({
    status: 200,
    body: { sheetVersion: 1 },
    retryAfterMs: undefined,
  })
  expect(calls.eventsPost).toHaveBeenCalledWith('c1', {
    clientBatchId: batch.clientBatchId,
    events: batch.events,
  })
})

it('sem resposta (o 503 do Eden) é rede: status 0', async () => {
  calls.eventsPost.mockResolvedValue({
    data: null,
    error: { status: 503, value: new TypeError('Failed to fetch') },
    status: 503,
    response: undefined,
    headers: undefined,
  })
  expect(await postEvents('c1', batch)).toEqual({ status: 0, body: null })
})

it('503 e 429 do servidor ficam como estão, com o Retry-After', async () => {
  calls.eventsPost.mockResolvedValue({
    data: null,
    error: { status: 503, value: { error: 'Serviço indisponível' } },
    status: 503,
    response,
    headers: {},
  })
  expect(await postEvents('c1', batch)).toMatchObject({
    status: 503,
    body: { error: 'Serviço indisponível' },
  })
  calls.eventsPost.mockResolvedValue({
    data: null,
    error: { status: 429, value: { error: 'muitas requisições' } },
    status: 429,
    response,
    headers: { 'retry-after': '7' },
  })
  expect(await postEvents('c1', batch)).toMatchObject({
    status: 429,
    retryAfterMs: 7000,
  })
})
