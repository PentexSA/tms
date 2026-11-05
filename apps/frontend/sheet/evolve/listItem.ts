import type { ListField, ListItem } from '@tms/sheet-core'

// O item de lista com o valor que o editor mostra (T-23). O editor desenha
// o mínimo do template quando o meta numérico não tem valor ("Bônus 1" no
// Defeito, "Custo 1" na Qualidade); sem gravar esse mínimo, a conta do core
// e do servidor lê o item sem meta (crédito 0, Qualidade sem custo). Meta
// sem `min` no template (a Qtd. do inventário do D&D) continua sem valor:
// nada é inventado. Nenhuma regra muda: o validador do core segue
// conferindo `min` e `max` no servidor.

/** Grava o `min` de cada meta numérico do template ainda sem valor. */
export function withItemDefaults(def: ListField, item: ListItem): ListItem {
  const missing = (def.item.meta ?? []).filter(
    m =>
      m.type === 'number' &&
      typeof m.min === 'number' &&
      (item.meta?.[m.id] === undefined || item.meta[m.id] === '')
  )
  if (!missing.length) return item
  const meta: Record<string, number | string> = { ...item.meta }
  for (const m of missing) meta[m.id] = m.min as number
  return { ...item, meta }
}

/**
 * O meta inicial do nome do catálogo (`catalogDefaults`, T-24): o Dom de
 * Posto 2 nasce com Posto 2. Só para nome do catálogo e meta ainda sem
 * valor; o resto fica com o `min` (withItemDefaults). O validador da ficha
 * confere a faixa no servidor.
 */
export function withCatalogDefaults(def: ListField, item: ListItem): ListItem {
  const name = item.name
  if (!name || !def.catalog?.includes(name) || !def.catalogDefaults) return item
  const meta: Record<string, number | string> = { ...item.meta }
  let changed = false
  for (const d of def.catalogDefaults)
    if (d.items.includes(name) && meta[d.meta] === undefined) {
      meta[d.meta] = d.value
      changed = true
    }
  return changed ? { ...item, meta } : item
}
