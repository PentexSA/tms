import { saySigned } from '../text'
import type { FieldType } from './types'

export const number: FieldType<'number'> = {
  short: (r, sheet) => number.plain(r, sheet),
  plain: r => `${r.value}${r.field.def.suffix ?? ''}`,
  describe: (r, sheet) => {
    const f = r.field.def
    if (f.display === 'score+mod' && r.mod !== null)
      return `${f.label}, ${r.value}, modificador ${saySigned(r.mod)}`
    if (f.display === 'signed') return `${f.label}, ${saySigned(r.value)}`
    if (f.display === 'ladder') {
      const ladder = f.ladder ? sheet.model.template.ladders?.[f.ladder] : null
      return `${f.label}, ${ladder?.[String(r.value)] ?? ''}, ${saySigned(r.value)}`
    }
    return `${f.label}, ${r.value}${f.suffix ?? ''}`
  },
  stored: r => (r.derived ? undefined : r.value),
}
