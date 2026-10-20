import type { ResolvedRating } from '../resolve'
import { MINUS } from '../text'
import type { FieldType } from './types'

/** O teto não destrutivo, quando há pontos acima dele ("1 inativo, máx. pelo Arete 3"). */
export const inactiveNote = (r: ResolvedRating): string | null =>
  r.inactive
    ? `${r.inactive} inativo, ${r.field.def.cap?.label ?? 'acima do teto'} ${r.cap}`
    : null

/**
 * A origem do valor efetivo, quando um `state` o muda: "3 + 4 Crinos" (soma)
 * ou "Crinos: 0" (fixa). Sem modificador que mude o valor, null.
 */
export const modifierNote = (r: ResolvedRating): string | null => {
  const last = r.modifiers.at(-1)
  if (!last || r.modded === r.base) return null
  if (last.op === 'set') return `${last.source}: ${last.value}`
  const delta = r.modded - r.base
  const sources = [...new Set(r.modifiers.map(m => m.source))].join(' e ')
  return `${r.base} ${delta > 0 ? '+' : MINUS} ${Math.abs(delta)} ${sources}`
}

export const rating: FieldType<'rating'> = {
  short: r => String(r.value),
  plain: r => {
    const label = r.field.def.valueLabels?.[String(r.value)]
    return `${r.field.def.label} ${r.value}${label ? ` · ${label}` : ''}`
  },
  describe: (r, sheet) => {
    const f = r.field.def
    // Acima do máximo (Crinos: Força 7 numa escala de 5) não se diz "7 de 5".
    // A origem é o rótulo da opção ("em Crinos"), sem dizer "forma": o mesmo
    // texto serve a qualquer `state`.
    const parts = [
      r.value > r.max
        ? `${f.label}, ${r.value}`
        : `${f.label}, ${r.value} de ${r.max}`,
    ]
    const valueLabel = f.valueLabels?.[String(r.value)]
    if (valueLabel) parts.push(valueLabel)
    const mod = r.modifiers.at(-1)
    if (mod && r.modded !== r.base)
      parts.push(
        mod.op === 'set'
          ? `${mod.value} em ${mod.source}, base ${r.base}`
          : `base ${r.base} ${r.modded > r.base ? 'mais' : 'menos'} ${Math.abs(r.modded - r.base)} em ${mod.source}`
      )
    const inactive = inactiveNote(r)
    if (inactive) parts.push(inactive)
    const specialty = sheet.specialty(r.id)
    if (specialty) parts.push(`especialização ${specialty}`)
    return parts.join(', ')
  },
  stored: r => r.base,
}
