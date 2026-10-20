import type { ResolvedRating } from '../resolve'
import type { FieldType } from './types'

/** O teto não destrutivo, quando há pontos acima dele ("1 inativo, máx. pelo Arete 3"). */
export const inactiveNote = (r: ResolvedRating): string | null =>
  r.inactive
    ? `${r.inactive} inativo, ${r.field.def.cap?.label ?? 'acima do teto'} ${r.cap}`
    : null

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
