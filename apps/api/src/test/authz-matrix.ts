import type { SystemCase } from './matrix-systems'

// Matriz de AuthZ (doc/plano-v0.md §4): cada rota protegida diz, para cada
// ator, o status esperado. Rota nova sem linha aqui falha o teste da matriz
// (o mesmo fail secure da API, aplicado aos testes). Roda nos três sistemas
// do produto (doc/plano-v3.md, Etapa 3): o corpo que cita campo sai do caso
// do sistema, nunca de um nome escrito aqui.

export type Actor =
  // narrador da crônica do cenário
  | 'storyteller'
  // jogador da crônica, dono da ficha do cenário
  | 'owner'
  // outro jogador da mesma crônica: sem papel na ficha da dona (v3, Etapa 2)
  | 'player'
  // ex-membro: saiu (ou foi removido) e tem ficha na crônica (v3, Etapa 7)
  | 'former'
  // narrador de outra crônica
  | 'otherStoryteller'
  // usuário sem vínculo
  | 'stranger'
  | 'anonymous'

export interface MatrixRow {
  readonly method: string
  // Caminho do Elysia, com :id e afins (:id é a crônica ou a ficha)
  readonly route: string
  readonly expect: Readonly<Record<Actor, number>>
  // O caso do sistema e a ficha da dona no cenário
  readonly body?: (
    s: SystemCase,
    ids: { readonly characterId: string }
  ) => unknown
  // A linha muda o cenário (excluir, gravar): monta um cenário por ator
  readonly mutates?: true
  // Estado da ficha antes da requisição (travar pede `active`; aprovar e
  // devolver pedem `pending`)
  readonly sheet?: {
    readonly status: 'active' | 'pending'
    readonly locked?: true
  }
}

// O ex-membro responde como quem não tem vínculo, salvo onde a linha diz
const denied = {
  former: 404,
  otherStoryteller: 404,
  stranger: 404,
  anonymous: 401,
} as const

export const MATRIX: readonly MatrixRow[] = [
  {
    // O ex-membro lê o nome, o sistema e o narrador, sem os membros
    method: 'GET',
    route: '/chronicles/:id',
    expect: {
      storyteller: 200,
      owner: 200,
      player: 200,
      ...denied,
      former: 200,
    },
  },
  {
    // O cenário tem a ficha da dona: só sai com o nome da crônica digitado
    method: 'DELETE',
    route: '/chronicles/:id',
    body: () => ({ confirm: 'Crônica da Liberdade' }),
    mutates: true,
    expect: { storyteller: 204, owner: 403, player: 403, ...denied },
  },
  {
    method: 'POST',
    route: '/chronicles/:id/invites',
    expect: { storyteller: 201, owner: 403, player: 403, ...denied },
  },
  {
    method: 'GET',
    route: '/chronicles/:id/invites',
    expect: { storyteller: 200, owner: 403, player: 403, ...denied },
  },
  {
    method: 'DELETE',
    route: '/chronicles/:id/invites/:inviteId',
    mutates: true,
    expect: { storyteller: 204, owner: 403, player: 403, ...denied },
  },
  {
    // O jogador recebe só as fichas dele (o corpo é conferido em characters.test.ts)
    method: 'GET',
    route: '/chronicles/:id/characters',
    expect: {
      storyteller: 200,
      owner: 200,
      player: 200,
      ...denied,
      former: 200,
    },
  },
  // Membros (v3, Etapa 7): o narrador remove; o membro sai
  {
    method: 'DELETE',
    route: '/chronicles/:id/members/:userId',
    mutates: true,
    expect: { storyteller: 204, owner: 403, player: 403, ...denied },
  },
  {
    method: 'DELETE',
    route: '/chronicles/:id/members/me',
    mutates: true,
    expect: { storyteller: 403, owner: 204, player: 204, ...denied },
  },
  // Operações em grupo (v3, Etapa 11): só o narrador. A ficha do cenário tem
  // um lote (as Notas do Narrador): a prévia leu a versão 1
  {
    method: 'POST',
    route: '/chronicles/:id/operations/preview',
    body: (_, { characterId }) => ({
      kind: 'damage',
      amount: 1,
      targets: [{ characterId }],
    }),
    expect: { storyteller: 200, owner: 403, player: 403, ...denied },
  },
  {
    method: 'POST',
    route: '/chronicles/:id/operations',
    body: (_, { characterId }) => ({
      clientOperationId: crypto.randomUUID(),
      kind: 'damage',
      amount: 1,
      targets: [{ characterId, sheetVersion: 1 }],
    }),
    mutates: true,
    expect: { storyteller: 201, owner: 403, player: 403, ...denied },
  },
  {
    // A Mesa é do narrador; para jogador a rota não existe (fail secure)
    method: 'GET',
    route: '/chronicles/:id/table',
    expect: { storyteller: 200, owner: 404, player: 404, ...denied },
  },
  {
    method: 'POST',
    route: '/chronicles/:id/characters',
    body: () => ({ values: { name: 'Nova' } }),
    // O ex-membro sabe que a crônica existe: 403 NOT_MEMBER
    expect: {
      storyteller: 201,
      owner: 201,
      player: 201,
      ...denied,
      former: 403,
    },
  },
  {
    method: 'GET',
    route: '/characters/:id',
    expect: { storyteller: 200, owner: 200, player: 404, ...denied },
  },
  {
    method: 'DELETE',
    route: '/characters/:id',
    mutates: true,
    expect: { storyteller: 204, owner: 204, player: 404, ...denied },
  },
  {
    method: 'POST',
    route: '/characters/:id/events',
    body: s => ({
      clientBatchId: crypto.randomUUID(),
      events: [{ path: `values.${s.textField}`, from: null, to: 'Arquivista' }],
    }),
    mutates: true,
    expect: { storyteller: 200, owner: 200, player: 404, ...denied },
  },
  // Ações do narrador (v3, Etapa 5): o dono vê a ficha, mas recebe 403
  {
    method: 'POST',
    route: '/characters/:id/creation/complete',
    mutates: true,
    expect: { storyteller: 200, owner: 403, player: 404, ...denied },
  },
  // Criação e aprovação (v4, Etapa 4). Os templates do produto ainda não têm
  // `creation` (Etapa 2b): a criação é livre, e só o narrador conclui
  {
    method: 'PATCH',
    route: '/characters/:id/creation',
    body: () => ({ revision: 0, choices: {} }),
    mutates: true,
    expect: { storyteller: 200, owner: 200, player: 404, ...denied },
  },
  {
    method: 'POST',
    route: '/characters/:id/creation/approve',
    sheet: { status: 'pending' },
    mutates: true,
    expect: { storyteller: 200, owner: 403, player: 404, ...denied },
  },
  {
    method: 'POST',
    route: '/characters/:id/creation/return',
    body: () => ({ reason: 'Refaça os Antecedentes' }),
    sheet: { status: 'pending' },
    mutates: true,
    expect: { storyteller: 200, owner: 403, player: 404, ...denied },
  },
  {
    method: 'PATCH',
    route: '/chronicles/:id/creation-settings',
    body: () => ({ revision: 0, approval: true }),
    mutates: true,
    expect: { storyteller: 200, owner: 403, player: 403, ...denied },
  },
  {
    method: 'POST',
    route: '/characters/:id/status',
    body: () => ({ status: 'archived' }),
    mutates: true,
    expect: { storyteller: 200, owner: 403, player: 404, ...denied },
  },
  {
    method: 'POST',
    route: '/characters/:id/lock',
    sheet: { status: 'active' },
    mutates: true,
    expect: { storyteller: 200, owner: 403, player: 404, ...denied },
  },
  {
    method: 'DELETE',
    route: '/characters/:id/lock',
    sheet: { status: 'active', locked: true },
    mutates: true,
    expect: { storyteller: 200, owner: 403, player: 404, ...denied },
  },
  {
    method: 'GET',
    route: '/characters/:id/history',
    expect: { storyteller: 200, owner: 200, player: 404, ...denied },
  },
  {
    method: 'POST',
    route: '/characters/:id/rolls',
    // Sem custo: não muda a ficha
    body: s => ({
      clientRollId: crypto.randomUUID(),
      slots: s.slots,
      difficulty: 6,
    }),
    expect: { storyteller: 201, owner: 201, player: 404, ...denied },
  },
  {
    method: 'GET',
    route: '/characters/:id/rolls',
    expect: { storyteller: 200, owner: 200, player: 404, ...denied },
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
  // Exclusão da própria conta, com a senha (__tests__/account.test.ts)
  'DELETE /me',
  'GET /systems',
  'GET /systems/:code/template',
  'POST /chronicles',
  'GET /chronicles',
  'POST /invites/accept',
])
