import type { FieldType } from './types'

export const rating: FieldType<'rating'> = {
  short: r => String(r.value),
  plain: r => {
    const label = r.field.def.valueLabels?.[String(r.value)]
    return `${r.field.def.label} ${r.value}${label ? ` · ${label}` : ''}`
  },
  describe: (r, sheet) => {
    const f = r.field.def
    // Acima do máximo (Crinos: Força 7 numa escala de 5) não se diz "7 de 5".
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
          ? `${mod.value} na forma ${mod.source}, base ${r.base}`
          : `base ${r.base} ${r.modded > r.base ? 'mais' : 'menos'} ${Math.abs(r.modded - r.base)} da forma ${mod.source}`
      )
    if (r.inactive)
      parts.push(
        `${r.inactive} inativo, ${f.cap?.label ?? 'acima do teto'} ${r.cap}`
      )
    const specialty = sheet.specialty(r.id)
    if (specialty) parts.push(`especialização ${specialty}`)
    return parts.join(', ')
  },
  stored: r => r.base,
}
