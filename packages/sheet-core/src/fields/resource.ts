import type { ResourceValue } from '../contract'
import type { FieldType } from './types'

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
  stored: r => {
    const f = r.field.def
    const v: { -readonly [K in keyof ResourceValue]: ResourceValue[K] } = {
      current: r.current,
    }
    if (r.permanent !== null) v.permanent = r.permanent
    if (f.temp) v.temp = r.temp ?? 0
    if (
      f.max &&
      typeof f.max === 'object' &&
      'stored' in f.max &&
      r.max !== null
    )
      v.max = r.max
    return v
  },
}
