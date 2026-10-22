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
    delete: jest.fn(),
    charactersGet: jest.fn(),
    charactersPost: jest.fn(),
    tableGet: jest.fn(),
    invitesGet: jest.fn(),
    invitesPost: jest.fn(),
    invitesDelete: jest.fn(),
  }
  const calls = {
    characterGet: jest.fn(),
    eventsPost: jest.fn(),
    historyGet: jest.fn(),
    rollsPost: jest.fn(),
    rollsGet: jest.fn(),
    // Ações do narrador (v3, Etapa 6)
    completePost: jest.fn(),
    statusPost: jest.fn(),
    lockPost: jest.fn(),
    lockDelete: jest.fn(),
    templateGet: jest.fn(),
    systemsGet: jest.fn(),
    chroniclesGet: jest.fn(),
    chroniclesPost: jest.fn(),
    acceptPost: jest.fn(),
    meDelete: jest.fn(),
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
      events: { post: (...a: unknown[]) => calls.eventsPost(id, ...a) },
      history: { get: (...a: unknown[]) => calls.historyGet(id, ...a) },
      rolls: {
        post: (...a: unknown[]) => calls.rollsPost(id, ...a),
        get: (...a: unknown[]) => calls.rollsGet(id, ...a),
      },
      creation: {
        complete: { post: (...a: unknown[]) => calls.completePost(id, ...a) },
      },
      status: { post: (...a: unknown[]) => calls.statusPost(id, ...a) },
      lock: {
        post: (...a: unknown[]) => calls.lockPost(id, ...a),
        delete: (...a: unknown[]) => calls.lockDelete(id, ...a),
      },
    }),
    chronicles: Object.assign(
      ({ id }: { id: string }) => {
        calls.chronicleIds.push(id)
        return {
          get: (...a: unknown[]) => chronicle.get(...a),
          delete: (...a: unknown[]) => chronicle.delete(id, ...a),
          characters: {
            get: (...a: unknown[]) => chronicle.charactersGet(...a),
            post: (...a: unknown[]) => chronicle.charactersPost(...a),
          },
          table: { get: (...a: unknown[]) => chronicle.tableGet(...a) },
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
    me: { delete: (...a: unknown[]) => calls.meDelete(...a) },
  }
  return { api, calls }
}
