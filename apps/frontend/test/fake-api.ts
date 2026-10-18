// Um Eden falso para os testes de tela: a mesma forma da API (rotas como
// propriedades e funções), com jest.fn só nas folhas. Cada teste define as
// respostas ({ data, error }) que precisa.

export const ok = <T>(data: T) => ({ data, error: null })
export const fail = (status: number, error = 'erro') => ({
  data: null,
  error: { status, value: { error } },
})

export function createFakeApi() {
  const chronicle = {
    get: jest.fn(),
    charactersGet: jest.fn(),
    charactersPost: jest.fn(),
    invitesGet: jest.fn(),
    invitesPost: jest.fn(),
    invitesDelete: jest.fn(),
  }
  const calls = {
    characterGet: jest.fn(),
    templateGet: jest.fn(),
    systemsGet: jest.fn(),
    chroniclesGet: jest.fn(),
    chroniclesPost: jest.fn(),
    acceptPost: jest.fn(),
    healthGet: jest.fn(),
    chronicle,
    chronicleIds: [] as string[],
  }
  const api = {
    health: { get: (...a: unknown[]) => calls.healthGet(...a) },
    systems: Object.assign(
      ({ code }: { code: string }) => ({
        template: { get: (...a: unknown[]) => calls.templateGet(code, ...a) },
      }),
      { get: (...a: unknown[]) => calls.systemsGet(...a) }
    ),
    characters: ({ id }: { id: string }) => ({
      get: (...a: unknown[]) => calls.characterGet(id, ...a),
    }),
    chronicles: Object.assign(
      ({ id }: { id: string }) => {
        calls.chronicleIds.push(id)
        return {
          get: (...a: unknown[]) => chronicle.get(...a),
          characters: {
            get: (...a: unknown[]) => chronicle.charactersGet(...a),
            post: (...a: unknown[]) => chronicle.charactersPost(...a),
          },
          invites: Object.assign(
            ({ inviteId }: { inviteId: string }) => ({
              delete: () => chronicle.invitesDelete(inviteId),
            }),
            {
              get: (...a: unknown[]) => chronicle.invitesGet(...a),
              post: (...a: unknown[]) => chronicle.invitesPost(...a),
            }
          ),
        }
      },
      {
        get: (...a: unknown[]) => calls.chroniclesGet(...a),
        post: (...a: unknown[]) => calls.chroniclesPost(...a),
      }
    ),
    invites: { accept: { post: (...a: unknown[]) => calls.acceptPost(...a) } },
  }
  return { api, calls }
}
