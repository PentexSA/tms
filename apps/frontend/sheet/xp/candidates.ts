import {
  costOf,
  type ListItem,
  type SheetData,
  type SheetModel,
  type XpCostResult,
  type XpTarget,
  xpTargetKey,
} from '@tms/sheet-core'

// O que o jogador pode pedir, com o custo que o core calcula sobre a ficha
// confirmada (a do servidor, não o rascunho): cada campo de uma regra de XP,
// cada item das listas e os nomes do catálogo que a ficha ainda não tem. Sem
// `costs.xp` ou sem regras, nada (nada de pedido nem saldo inventado).

export interface XpCandidate {
  readonly key: string
  readonly target: XpTarget
  readonly label: string
  readonly cost: XpCostResult
}

const itemsOf = (sheet: SheetData, id: string): ListItem[] => {
  const raw = Object.hasOwn(sheet.values, id) ? sheet.values[id] : undefined
  return Array.isArray(raw) ? (raw as ListItem[]) : []
}

export function xpCandidates(
  model: SheetModel,
  sheet: SheetData
): XpCandidate[] {
  const rules = model.template.costs?.xp?.rules ?? []
  const out: XpCandidate[] = []
  const add = (target: XpTarget, label: string) =>
    out.push({
      key: xpTargetKey(target),
      target,
      label,
      cost: costOf(model, sheet, target),
    })
  for (const rule of rules)
    for (const id of rule.targets) {
      const def = model.fields.get(id)?.def
      if (!def) continue
      if (def.type !== 'list') {
        add({ field: id }, def.label)
        continue
      }
      const items = itemsOf(sheet, id)
      for (const item of items)
        add(
          { field: id, item: item.id },
          `${def.label}: ${item.name ?? def.itemLabel}`
        )
      if (def.fixed) continue
      const taken = new Set(items.map(x => x.name))
      for (const name of def.catalog ?? [])
        if (!taken.has(name))
          add({ field: id, name }, `${def.label}: ${name} (novo)`)
    }
  return out
}

/** Listas com regra de XP que aceitam um item novo de nome livre. */
export function freeItemLists(model: SheetModel) {
  const rules = model.template.costs?.xp?.rules ?? []
  return rules
    .flatMap(r => r.targets)
    .map(id => model.fields.get(id))
    .filter(f => f?.def.type === 'list' && !f.def.fixed)
    .map(f => ({ id: f?.id as string, label: f?.def.label ?? '' }))
}

/** "Destreza 2 → 3 · 8 XP", ou o motivo de não dar para pedir. */
export function costLabel(c: XpCandidate): string {
  if (c.cost.ok) return `${c.cost.from} → ${c.cost.to} · ${c.cost.cost} XP`
  switch (c.cost.code) {
    case 'XP_MAX_REACHED':
      return 'No máximo'
    case 'XP_PREREQUISITE':
      return 'Falta um pré-requisito'
    default:
      return 'Sem evolução por XP'
  }
}
