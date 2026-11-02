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
