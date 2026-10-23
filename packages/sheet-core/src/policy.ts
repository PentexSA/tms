import type { ChangeClass } from './classify'

// Política de escrita por estado da ficha (doc/painel-narrador.md §5.1). Pura,
// sem banco: o servidor resolve o acesso, o estado e a trava dentro da
// transação e é a autoridade; o app usa a mesma função só para desabilitar o
// que vai ser recusado. Outra camada que o `canWrite` (permissions.ts), que
// decide por campo e papel e continua valendo antes desta.

// `pending` (v4): o dono concluiu com a aprovação de ficha ligada e a ficha
// espera o narrador aprovar ou devolver (doc/plano-v4.md §3.4).
export const CHARACTER_STATUSES = [
  'creating',
  'pending',
  'active',
  'archived',
  'dead',
] as const
export type CharacterStatus = (typeof CHARACTER_STATUSES)[number]

export const isCharacterStatus = (v: unknown): v is CharacterStatus =>
  (CHARACTER_STATUSES as readonly unknown[]).includes(v)

// O app troca cada código por uma frase (doc/plano-v3.md, Etapa 6).
export type RefusalCode =
  // `active` com a trava do narrador: nem jogo.
  | 'SHEET_LOCKED'
  // Arquivada, fora de jogo ou outro estado sem escrita do dono.
  | 'SHEET_NOT_EDITABLE'
  // Evolução em `active`: passa pelo narrador (o pedido de XP chega na v4).
  | 'NEEDS_XP_APPROVAL'
  // O dono saiu da crônica, ou foi removido: só lê.
  | 'NOT_MEMBER'
  // Sem papel na ficha. O servidor barra antes; aqui é a rede de segurança.
  | 'FORBIDDEN'

export interface WriteAccess {
  readonly owner: boolean
  readonly storyteller: boolean
  // O dono ainda tem o vínculo na crônica da ficha.
  readonly member: boolean
}

// Por que a ficha não aceita o dono: em `pending`, o app diz "aguarda
// aprovação" em vez de "arquivada ou fora de jogo".
export type RefusalReason = 'pending'

export type PolicyResult =
  | { readonly ok: true }
  | {
      readonly ok: false
      readonly code: RefusalCode
      readonly reason?: RefusalReason
    }

const OK: PolicyResult = { ok: true }
const refuse = (code: RefusalCode): PolicyResult => ({ ok: false, code })
const PENDING: PolicyResult = {
  ok: false,
  code: 'SHEET_NOT_EDITABLE',
  reason: 'pending',
}

/**
 * Se quem tem `access` grava mudanças das `classes` numa ficha no `status`,
 * com ou sem a trava. Vale o estado de quando o lote chega. Fail secure:
 * estado desconhecido não deixa o dono escrever. O narrador escreve sempre.
 */
export function writePolicy(
  access: WriteAccess,
  status: CharacterStatus | string,
  locked: boolean,
  classes: Iterable<ChangeClass>
): PolicyResult {
  // O narrador vem da crônica (`storyteller_id`), não do vínculo
  if (access.storyteller) return OK
  if (!access.owner) return refuse('FORBIDDEN')
  if (!access.member) return refuse('NOT_MEMBER')
  switch (status) {
    case 'creating':
      return OK
    // Aguarda o narrador: o dono não grava nem rola, com ou sem custo
    case 'pending':
      return PENDING
    case 'active':
      // A trava só vale em `active`
      if (locked) return refuse('SHEET_LOCKED')
      for (const c of classes)
        if (c === 'advance') return refuse('NEEDS_XP_APPROVAL')
      return OK
    default:
      return refuse('SHEET_NOT_EDITABLE')
  }
}

/**
 * A política de uma rolagem, antes de rolar. Com custo (`cost`: as classes do
 * lote que paga), é a da escrita: travada, não rola gastando FdV. Sem custo
 * (null), a rolagem não muda a ficha e a trava não conta (decisão 10 da
 * proposta), mas o estado e o vínculo continuam valendo.
 */
export function rollPolicy(
  access: WriteAccess,
  status: CharacterStatus | string,
  locked: boolean,
  cost: Iterable<ChangeClass> | null
): PolicyResult {
  return cost
    ? writePolicy(access, status, locked, cost)
    : writePolicy(access, status, false, [])
}
