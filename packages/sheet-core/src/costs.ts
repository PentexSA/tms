import {
  baseValue,
  choiceOf,
  conditionHolds,
  itemPoints,
  listItems,
  resolveSheet,
} from './accounting'
import type { SheetModel } from './compile'
import type { FieldId, SheetData, XpCost, XpWhen } from './contract'
import { isSafeText } from './validate'
import { targetKind } from './validate/accounting'
import { NUM_LIMIT } from './validate/util'

// Preço de evolução por XP (doc/plano-v4.md §3.2). Cada pedido sobe um nível
// só (`to = from + 1`) ou compra o primeiro ponto de um traço ou item novo.
// Preço ausente nunca vale zero: sem regra, o resultado é indisponível, com
// código estável. O servidor recalcula sempre; o preço do cliente não vale.

/** O que se quer subir: um campo, um item da lista ou um item novo pelo nome. */
export interface XpTarget {
  readonly field: FieldId
  // Id de um item que a ficha já tem.
  readonly item?: string
  // Nome de um item novo (do catálogo, para valer desconto).
  readonly name?: string
}

export type XpCostCode =
  | 'XP_COST_UNAVAILABLE'
  | 'XP_TARGET_INVALID'
  | 'XP_MAX_REACHED'
  | 'XP_PREREQUISITE'

export type XpUnavailableReason =
  // Template sem `costs.xp`.
  | 'no-xp'
  // Campo fora de qualquer regra de XP.
  | 'no-rule'
  // Comprar a partir de 0 sem preço de primeiro ponto.
  | 'no-new-price'
  // Exceção do template: não compra (Aparência do Nosferatu).
  | 'excluded'
  | 'unknown-field'
  | 'not-targetable'
  | 'item-not-found'
  | 'item-name-required'
  | 'item-name-invalid'
  | 'item-duplicate'
  | 'fixed-list'
  | 'max'
  | 'cap'

/** O que decide o preço e a elegibilidade: se mudar, o pedido envelhece. */
export interface XpCostContext {
  readonly rule: string
  // Índice da exceção (`when`) aplicada, ou null.
  readonly when: number | null
  // Opção atual de cada `choice` que as condições da regra leem.
  readonly choices: Readonly<Record<FieldId, string | null>>
  // Teto atual (Esfera até o Arete), quando há.
  readonly cap: number | null
}

export type XpCostResult =
  | {
      readonly ok: true
      readonly target: XpTarget
      readonly from: number
      readonly to: number
      readonly cost: number
      readonly kind: 'new' | 'raise'
      readonly context: XpCostContext
    }
  | {
      readonly ok: false
      readonly code: XpCostCode
      readonly reason: XpUnavailableReason
      readonly target: XpTarget
      readonly from: number | null
    }

const fail = (
  target: XpTarget,
  code: XpCostCode,
  reason: XpUnavailableReason,
  from: number | null = null
): XpCostResult => ({ ok: false, code, reason, target, from })

/**
 * O preço em XP de subir o alvo um nível, na ficha atual. Usa a base
 * gravada (ou o padrão), nunca o efetivo com modificadores de jogo.
 */
export function costOf(
  model: SheetModel,
  sheet: SheetData | unknown,
  target: XpTarget
): XpCostResult {
  const xp = model.template.costs?.xp
  if (!xp) return fail(target, 'XP_COST_UNAVAILABLE', 'no-xp')
  const field = model.fields.get(target.field)
  if (!field) return fail(target, 'XP_TARGET_INVALID', 'unknown-field')
  const def = field.def
  const kind = targetKind(def as unknown as Record<string, unknown>)
  if (!kind) return fail(target, 'XP_TARGET_INVALID', 'not-targetable')
  const rule = xp.rules?.find(x => x.targets.includes(field.id))
  if (!rule) return fail(target, 'XP_COST_UNAVAILABLE', 'no-rule')
  const r = resolveSheet(model, sheet)

  let from: number
  let max: number
  let name: string | undefined
  let isNew = false
  if (kind === 'items') {
    if (def.type !== 'list' || !def.item.value)
      return fail(target, 'XP_TARGET_INVALID', 'not-targetable')
    max = def.item.value.max
    const items = listItems(r, field.id)
    if (target.item !== undefined) {
      if (target.name !== undefined)
        return fail(target, 'XP_TARGET_INVALID', 'item-name-invalid')
      const item = items.find(x => x.id === target.item)
      if (!item) return fail(target, 'XP_TARGET_INVALID', 'item-not-found')
      from = itemPoints(model, field.id, item)
      name = item.name
    } else {
      if (def.fixed) return fail(target, 'XP_TARGET_INVALID', 'fixed-list')
      if (target.name === undefined)
        return fail(target, 'XP_TARGET_INVALID', 'item-name-required')
      const n = target.name
      if (typeof n !== 'string' || !n.trim() || n.length > 80 || !isSafeText(n))
        return fail(target, 'XP_TARGET_INVALID', 'item-name-invalid')
      if (items.some(x => x.name === n))
        return fail(target, 'XP_TARGET_INVALID', 'item-duplicate')
      from = 0
      name = n
      isNew = true
    }
  } else {
    if (target.item !== undefined || target.name !== undefined)
      return fail(target, 'XP_TARGET_INVALID', 'not-targetable')
    from = baseValue(r, field.id) ?? 0
    max =
      def.type === 'resource'
        ? (def.permanent?.max ?? 0)
        : def.type === 'rating' || def.type === 'number'
          ? (def.max ?? NUM_LIMIT)
          : 0
    isNew = from === 0
  }

  const to = from + 1
  if (to > max) return fail(target, 'XP_MAX_REACHED', 'max', from)
  const cap = def.type === 'rating' && def.cap ? r.number(def.cap.field) : null
  if (cap !== null && to > cap)
    return fail(target, 'XP_PREREQUISITE', 'cap', from)

  const whenIndex = (rule.when ?? []).findIndex(w =>
    conditionHolds(r, w.if, field.id, name)
  )
  const when: XpWhen | undefined = rule.when?.[whenIndex]
  if (when?.unavailable)
    return fail(target, 'XP_COST_UNAVAILABLE', 'excluded', from)
  const price = priceOf(rule, when, from, isNew)
  if (price === null)
    return fail(target, 'XP_COST_UNAVAILABLE', 'no-new-price', from)

  const choices: Record<FieldId, string | null> = {}
  for (const w of rule.when ?? []) choices[w.if.field] = choiceOf(r, w.if.field)
  return {
    ok: true,
    target,
    from,
    to,
    cost: price,
    kind: isNew ? 'new' : 'raise',
    context: { rule: rule.id, when: when ? whenIndex : null, choices, cap },
  }
}

function priceOf(
  rule: XpCost,
  when: XpWhen | undefined,
  from: number,
  isNew: boolean
): number | null {
  const pick = <K extends 'cost' | 'factor' | 'new'>(k: K) =>
    when?.[k] ?? rule[k]
  const first = pick('new')
  if (isNew && first !== undefined) return first
  if (rule.rule === 'flat') return pick('cost') ?? null
  const factor = pick('factor')
  // Valor atual × fator: de 0, sem preço de primeiro ponto, não há compra
  if (factor === undefined || from <= 0) return null
  return factor * from
}

/**
 * Identidade estável do traço de um pedido: um pendente por ficha e chave.
 * Campo: o id. Item que a ficha tem: o id do item (não o nome, que é
 * editável). Item novo: o nome pedido, que vira o item na aprovação.
 */
export function xpTargetKey(target: XpTarget): string {
  if (target.item !== undefined) return `${target.field}#${target.item}`
  if (target.name !== undefined) return `${target.field}@${target.name}`
  return target.field
}

export interface XpBalance {
  readonly total: number
  readonly spent: number
  readonly available: number
}

/** O saldo projetado na ficha, ou null quando o template não tem XP. */
export function xpBalance(
  model: SheetModel,
  sheet: SheetData | unknown
): XpBalance | null {
  const xp = model.template.costs?.xp
  if (!xp) return null
  const r = resolveSheet(model, sheet)
  const total = baseValue(r, xp.total) ?? 0
  const spent = baseValue(r, xp.spent) ?? 0
  return { total, spent, available: total - spent }
}

/** Os campos que o extrato projeta: nenhum papel os grava por `/events`. */
export function xpLedgerFields(model: SheetModel): readonly FieldId[] {
  const xp = model.template.costs?.xp
  return xp ? [xp.total, xp.spent] : []
}
