import type { QueryClient } from '@tanstack/react-query'

import { createQueryClient as create } from '../queryClient'
import { captureError } from '../telemetry'

jest.mock('../telemetry', () => ({ captureError: jest.fn() }))

// Sem observer, cada query e mutation arma um timer de GC real (5 min); com o
// arquivo no processo principal do Jest (sozinho, ou sob o turbo), ele
// esperava esses timers para sair. O MutationCache.clear() não os cancela:
// destroy() em cada uma.
const clients: QueryClient[] = []
const createQueryClient = () => {
  const client = create()
  clients.push(client)
  return client
}

beforeEach(() => jest.mocked(captureError).mockClear())
afterEach(() => {
  for (const client of clients.splice(0)) {
    for (const mutation of client.getMutationCache().getAll())
      mutation.destroy()
    client.clear()
  }
})

describe('createQueryClient: error tracking', () => {
  it('query que falhou de vez vai com a queryKey', async () => {
    const client = createQueryClient()
    const error = { status: 500, value: { requestId: 'x' } }
    await client
      .fetchQuery({
        queryKey: ['characters', 'abc'],
        queryFn: () => Promise.reject(error),
        retry: false,
      })
      .catch(() => undefined)
    expect(captureError).toHaveBeenCalledWith(error, {
      source: 'query',
      queryKey: ['characters', 'abc'],
    })
  })

  it('mutation que falhou vai com a mutationKey', async () => {
    const client = createQueryClient()
    const error = new Error('x')
    await client
      .getMutationCache()
      .build(client, {
        mutationKey: ['xp'],
        mutationFn: () => Promise.reject(error),
      })
      .execute(undefined)
      .catch(() => undefined)
    expect(captureError).toHaveBeenCalledWith(error, {
      source: 'mutation',
      queryKey: ['xp'],
    })
  })

  it('query que dá certo não envia nada', async () => {
    await createQueryClient().fetchQuery({
      queryKey: ['ok'],
      queryFn: async () => 1,
    })
    expect(captureError).not.toHaveBeenCalled()
  })
})
