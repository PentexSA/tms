import { createQueryClient } from '../queryClient'
import { captureError } from '../telemetry'

jest.mock('../telemetry', () => ({ captureError: jest.fn() }))

beforeEach(() => jest.mocked(captureError).mockClear())

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
