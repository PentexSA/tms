import type { AuditAction } from '../audit'

// O que a auditoria consolidada (GET /chronicles/:id/history) mostra do
// `payload` de cada registro (T-63): uma lista branca por ação. O payload
// cru nunca sai. Só números, booleanos e códigos de estado; nada de texto
// livre (motivo, notas, título), e-mail, ids de outras fichas ou o código do
// convite. Valor fora do esperado sai como ausente, nunca cru (fail secure).

export type AuditDetail = Readonly<
  Record<string, string | number | boolean | undefined>
>

const STATUSES = ['creating', 'pending', 'active', 'archived', 'dead'] as const
const VISIBILITIES = ['hidden', 'identity', 'full'] as const

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const oneOf = <T extends string>(
  values: readonly T[],
  value: unknown
): T | undefined =>
  typeof value === 'string' && (values as readonly string[]).includes(value)
    ? (value as T)
    : undefined

// Números gravados como texto (String(body.amount), ledger.ts) voltam a ser
// números; inteiros seguros só
const integer = (value: unknown): number | undefined => {
  const n =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && /^-?\d{1,9}$/.test(value)
        ? Number(value)
        : Number.NaN
  return Number.isSafeInteger(n) ? n : undefined
}

const bool = (value: unknown): boolean | undefined =>
  typeof value === 'boolean' ? value : undefined

const count = (value: unknown): number | undefined =>
  Array.isArray(value) ? value.length : undefined

// Sem as chaves ausentes: o app distingue "não gravado" de "falso"
const defined = (detail: Record<string, unknown>): AuditDetail =>
  Object.fromEntries(
    Object.entries(detail).filter(([, v]) => v !== undefined)
  ) as AuditDetail

export function auditDetail(action: string, payload: unknown): AuditDetail {
  const p = isRecord(payload) ? payload : {}
  switch (action as AuditAction) {
    case 'character.status':
      return defined({
        from: oneOf(STATUSES, p.from),
        to: oneOf(STATUSES, p.to),
      })
    case 'character.visibility':
      return defined({
        from: oneOf(VISIBILITIES, p.from),
        to: oneOf(VISIBILITIES, p.to),
      })
    case 'character.creation.complete':
      return defined({ approved: bool(p.approved) })
    case 'chronicle.creation.settings':
      return defined({
        approval: bool(p.approval),
        approvalFrom: bool(p.approvalFrom),
        defaults: bool(p.defaults),
      })
    case 'xp.grant':
      return defined({
        amount: integer(p.amount),
        characters: count(p.characters),
      })
    case 'xp.adjust':
      return defined({ delta: integer(p.delta) })
    case 'xp.request.approve':
      return defined({ cost: integer(p.cost) })
    case 'member.remove':
    case 'member.leave':
      return defined({ characters: count(p.characters) })
    case 'invite.create':
      return defined({
        maxUses: integer(p.maxUses),
        expiresInDays: integer(p.expiresInDays),
      })
    default:
      return {}
  }
}

// Ações em que o usuário alvo (o nome que o narrador já vê em
// "Participantes") entra na linha. Recusar e cancelar a transferência não
// gravam usuário alvo
const WITH_USER: ReadonlySet<string> = new Set<AuditAction>([
  'member.remove',
  'member.leave',
  'chronicle.transfer.request',
  'chronicle.transfer.accept',
])

export const auditShowsUser = (action: string) => WITH_USER.has(action)
