import { isNetworkError, messageOf } from '../../lib/errors'

// As frases dos códigos de XP (doc/plano-v4.md §3.6). O corpo da resposta é
// input hostil: só o código conhecido e números entram na frase; o texto da
// API é o último recurso.

export const XP_CODES = [
  'XP_MANAGED_BY_LEDGER',
  'XP_INSUFFICIENT_BALANCE',
  'XP_TARGET_UNAVAILABLE',
  'XP_COST_UNAVAILABLE',
  'XP_REQUEST_STALE',
  'XP_REQUEST_PENDING',
  'XP_REQUEST_DECIDED',
  'XP_ONE_LEVEL',
  'XP_TARGET_INVALID',
  'XP_MAX_REACHED',
  'XP_PREREQUISITE',
  'XP_ADJUST_LIMIT',
  'XP_REVERSAL_EXCEEDS',
  'XP_REVERSAL_INVALID',
  'XP_LIMIT',
  'XP_UNSUPPORTED',
  'XP_LEDGER_NOT_REVERSIBLE',
  'IDEMPOTENCY_CONFLICT',
  'SHEET_LOCKED',
  'SHEET_NOT_EDITABLE',
  'NOT_MEMBER',
] as const
export type XpCode = (typeof XP_CODES)[number]

const body = (error: unknown): Record<string, unknown> | null => {
  const value = (error as { value?: unknown } | null)?.value
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null
}

/** O código conhecido da recusa, ou null. */
export function xpCodeOf(error: unknown): XpCode | null {
  const code = body(error)?.code
  return (XP_CODES as readonly unknown[]).includes(code)
    ? (code as XpCode)
    : null
}

const int = (v: unknown): number | null =>
  typeof v === 'number' && Number.isInteger(v) ? v : null

/** A frase das projeções fechadas, por papel. */
export const ledgerMessage = (storyteller: boolean): string =>
  storyteller
    ? 'Use Conceder XP, Ajustar XP ou a aprovação do pedido.'
    : 'O narrador concede o XP. Para evoluir, envie um pedido.'

/**
 * A frase de uma recusa de comando de XP. `action`: o que não aconteceu,
 * para quem pediu ("O pedido não foi enviado.").
 */
export function xpMessage(
  error: unknown,
  opts: { readonly storyteller?: boolean; readonly action?: string } = {}
): string {
  if (isNetworkError(error))
    return 'Sem resposta do servidor. Nada foi confirmado: tente de novo.'
  const b = body(error)
  const tail = opts.action ? ` ${opts.action}` : ''
  switch (xpCodeOf(error)) {
    case 'XP_MANAGED_BY_LEDGER':
      return ledgerMessage(Boolean(opts.storyteller))
    case 'XP_INSUFFICIENT_BALANCE': {
      const available = int(b?.available)
      const cost = int(b?.cost)
      return available !== null && cost !== null
        ? `Saldo de XP insuficiente para esta evolução (disponível ${available}, custo ${cost}).`
        : 'Saldo de XP insuficiente para esta evolução.'
    }
    case 'XP_TARGET_UNAVAILABLE':
      return 'O pedido está suspenso enquanto a ficha ou o vínculo estiver indisponível.'
    case 'XP_COST_UNAVAILABLE':
      return 'Este traço não oferece evolução por XP neste template.'
    case 'XP_REQUEST_STALE':
      return 'O traço ou o custo mudou. Faça um novo pedido.'
    case 'XP_REQUEST_PENDING':
      return 'Já existe um pedido pendente para este traço.'
    case 'XP_REQUEST_DECIDED':
      return 'Este pedido já foi decidido.'
    case 'XP_ONE_LEVEL':
      return 'Peça um nível por vez.'
    case 'XP_TARGET_INVALID':
      return 'Este traço não pode ser pedido.'
    case 'XP_MAX_REACHED':
      return 'O traço já está no máximo.'
    case 'XP_PREREQUISITE':
      return 'Falta um pré-requisito para subir este traço.'
    case 'XP_ADJUST_LIMIT': {
      const min = int(b?.minDelta)
      return min !== null
        ? `O total não pode ficar abaixo do XP já gasto: o ajuste mínimo agora é ${min}.`
        : 'O total não pode ficar abaixo do XP já gasto.'
    }
    case 'XP_REVERSAL_EXCEEDS': {
      const remaining = int(b?.remaining)
      return remaining !== null
        ? `O estorno passa do que resta desta concessão (${remaining}).`
        : 'O estorno passa do que resta desta concessão.'
    }
    case 'XP_REVERSAL_INVALID':
      return 'O estorno precisa apontar uma concessão e tirar XP.'
    case 'XP_LIMIT':
      return 'O total passaria do limite da ficha.'
    case 'XP_UNSUPPORTED':
      return 'Este sistema não tem extrato de XP.'
    case 'XP_LEDGER_NOT_REVERSIBLE':
      return 'Lote do extrato de XP: corrija com Ajustar XP.'
    case 'IDEMPOTENCY_CONFLICT':
      return 'Esta operação conflita com outra já enviada. Recomece.'
    case 'SHEET_LOCKED':
      return `O narrador travou a ficha.${tail}`
    case 'SHEET_NOT_EDITABLE':
      return b?.reason === 'pending'
        ? `A ficha aguarda aprovação do narrador.${tail}`
        : `Pedidos só valem em ficha ativa.${tail}`
    case 'NOT_MEMBER':
      return `Você saiu desta crônica: a ficha é só leitura.${tail}`
    default:
      return messageOf(error)
  }
}
