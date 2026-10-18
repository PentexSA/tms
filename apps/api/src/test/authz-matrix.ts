// Matriz de AuthZ (doc/plano-v0.md §4): cada rota protegida diz, para cada
// ator, o status esperado. Rota nova sem linha aqui falha o teste da matriz
// (o mesmo fail secure da API, aplicado aos testes).

export type Actor =
  // narrador da crônica do cenário
  | 'storyteller'
  // jogador da crônica (membro)
  | 'player'
  // narrador de outra crônica
  | 'otherStoryteller'
  // usuário sem vínculo
  | 'stranger'
  | 'anonymous'

export interface MatrixRow {
  readonly method: string
  // Caminho do Elysia, com :id e afins
  readonly route: string
  readonly expect: Readonly<Record<Actor, number>>
}

const denied = { otherStoryteller: 404, stranger: 404, anonymous: 401 } as const

export const MATRIX: readonly MatrixRow[] = [
  {
    method: 'GET',
    route: '/chronicles/:id',
    expect: { storyteller: 200, player: 200, ...denied },
  },
  {
    method: 'POST',
    route: '/chronicles/:id/invites',
    expect: { storyteller: 201, player: 403, ...denied },
  },
  {
    method: 'GET',
    route: '/chronicles/:id/invites',
    expect: { storyteller: 200, player: 403, ...denied },
  },
  {
    method: 'DELETE',
    route: '/chronicles/:id/invites/:inviteId',
    expect: { storyteller: 204, player: 403, ...denied },
  },
]

// Rotas fora da matriz: públicas, ou só do próprio usuário (sem recurso de
// outra pessoa no caminho). Elas têm os próprios testes.
export const NOT_IN_MATRIX = new Set([
  'GET /health',
  'POST /auth/register',
  'POST /auth/login',
  'POST /auth/refresh',
  'POST /auth/logout',
  'GET /me',
  'GET /systems',
  'POST /chronicles',
  'GET /chronicles',
  'POST /invites/accept',
])
