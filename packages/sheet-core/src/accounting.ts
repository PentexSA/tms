import type { SheetModel } from './compile'
import type {
  AccountingCondition,
  FieldId,
  ListItem,
  SheetData,
} from './contract'
import { type ResolvedSheet, resolve } from './resolve'
import { rec } from './validate/util'

// Leitura comum à criação (creation.ts) e à evolução (costs.ts): o valor que
// conta de cada campo e as comparações declarativas do template. Conta sempre
// sobre a base gravada (ou o padrão), nunca sobre o efetivo: Forma e outros
// modificadores de jogo não geram investimento nem desconto.

/** A base que conta: valor do `rating`/`number`, permanente do recurso. */
export function baseValue(sheet: ResolvedSheet, id: FieldId): number | null {
  const r = sheet.get(id)
  switch (r?.type) {
    case 'rating':
      return r.base
    case 'number':
      return r.derived ? null : r.value
    case 'resource':
      return r.permanent
    default:
      return null
  }
}

/** Os itens de uma lista, como a ficha os tem (fixos com o rótulo do template). */
export function listItems(
  sheet: ResolvedSheet,
  id: FieldId
): readonly ListItem[] {
  const r = sheet.get(id)
  return r?.type === 'list' ? r.items : []
}

/** Pontos de um item: `value`, ou o mínimo do item quando não tem. */
export function itemPoints(
  model: SheetModel,
  id: FieldId,
  item: ListItem
): number {
  const def = model.fields.get(id)?.def
  const min = def?.type === 'list' ? (def.item.value?.min ?? 0) : 0
  return typeof item.value === 'number' && Number.isInteger(item.value)
    ? item.value
    : min
}

/** A opção escolhida num `choice`, ou null. */
export function choiceOf(sheet: ResolvedSheet, id: FieldId): string | null {
  const r = sheet.get(id)
  return r?.type === 'choice' ? r.value : null
}

/**
 * Se a condição vale para o alvo. `item` é o nome do item, quando o alvo é
 * um item de lista: só um nome do catálogo conta para `itemIn` (texto livre
 * nunca concede desconto).
 */
export function conditionHolds(
  sheet: ResolvedSheet,
  cond: AccountingCondition,
  target: FieldId,
  item?: string
): boolean {
  const value = choiceOf(sheet, cond.field)
  if (value === null) return false
  if (cond.in && !cond.in.includes(value)) return false
  if (cond.equalsTarget && value !== target) return false
  if (cond.itemIn) {
    if (item === undefined || !cond.itemIn.includes(item)) return false
    const def = sheet.model.fields.get(target)?.def
    if (def?.type !== 'list' || !def.catalog?.includes(item)) return false
  }
  return true
}

/** A ficha sem o valor gravado de `id`: o campo volta ao padrão. */
export function withoutValue(sheet: SheetData, id: FieldId): SheetData {
  if (!Object.hasOwn(sheet.values, id)) return sheet
  const values = { ...sheet.values }
  delete values[id]
  return { ...sheet, values }
}

/** Resolve uma ficha que veio de fora, com leitura defensiva. */
export function resolveSheet(model: SheetModel, sheet: unknown): ResolvedSheet {
  const s = rec(sheet)
  const values = rec(s?.values) ?? {}
  return resolve(model, { values, specialties: rec(s?.specialties) ?? {} })
}

/** O `SheetData` de uma ficha que veio de fora, com leitura defensiva. */
export function sheetData(sheet: unknown): SheetData {
  const s = rec(sheet)
  return {
    values: (rec(s?.values) ?? {}) as SheetData['values'],
    specialties: (rec(s?.specialties) ?? {}) as SheetData['specialties'],
  }
}
