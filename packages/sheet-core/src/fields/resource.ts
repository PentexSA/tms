import type { ResourceValue } from '../contract'
import type { ResolvedResource } from '../resolve'
import type { FieldType } from './types'

type Mutable = { -readonly [K in keyof ResourceValue]: ResourceValue[K] }

function storedResource(r: ResolvedResource): Mutable {
  const f = r.field.def
  const v: Mutable = { current: r.current }
  if (r.permanent !== null) v.permanent = r.permanent
  if (f.temp) v.temp = r.temp ?? 0
  if (f.max && typeof f.max === 'object' && 'stored' in f.max && r.max !== null)
    v.max = r.max
  return v
}

/** A parte do recurso que uma linha do editor muda. */
export type ResourcePart = 'permanent' | 'max' | 'current'

/**
 * O valor a gravar quando uma linha do recurso muda (T-22). Parte do valor
 * resolvido, e não só do gravado: o validador exige `current` junto do
 * permanente ou do máximo.
 *
 * - `current`: só o atual muda.
 * - `permanent` ou `max` que é o teto do atual: com `follow` (a ficha ainda
 *   na criação) e o atual cheio, o atual vai junto, para cima ou para baixo.
 *   O atual abaixo do teto (gasto, ou baixado à mão) fica onde está.
 * - Em todo caso, o atual nunca passa do teto novo (desce junto), salvo
 *   nos recursos sem teto (`tempUncapped`, `overMax`).
 */
export function editResource(
  r: ResolvedResource,
  part: ResourcePart,
  n: number,
  options: { readonly follow: boolean }
): ResourceValue {
  const f = r.field.def
  const v = storedResource(r)
  if (part === 'current') {
    v.current = n
    return v
  }
  v[part] = n
  const capped = !f.tempUncapped && !f.overMax
  if (!capped) return v
  // O teto do atual: o permanente quando ele existe; senão, o máximo.
  const isCap =
    part === 'permanent' ? r.permanent !== null : r.permanent === null
  const cap = isCap ? r.cap : null
  if (options.follow && cap !== null && r.current >= cap) v.current = n
  else if (r.current > n) v.current = n
  return v
}

export const resource: FieldType<'resource'> = {
  short: r => {
    if (r.field.def.tempUncapped)
      return `Permanente ${r.permanent} · Temporário ${r.current}`
    const main =
      r.shownMax !== null ? `${r.current}/${r.shownMax}` : String(r.current)
    return r.temp ? `${main} +${r.temp}` : main
  },
  plain: (r, sheet) => resource.short(r, sheet),
  describe: r => {
    const f = r.field.def
    if (f.tempUncapped)
      return `${f.label}: permanente ${r.permanent}, temporário ${r.current}`
    let s = `${f.label}, ${r.current}${r.shownMax !== null ? ` de ${r.shownMax}` : ''}`
    if (r.temp) s += `, mais ${r.temp} temporários`
    if (r.permanent !== null) s += `, permanente ${r.permanent}`
    return s
  },
  stored: r => storedResource(r),
}
