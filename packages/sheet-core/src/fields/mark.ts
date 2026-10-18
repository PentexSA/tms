import { fmtSigned, saySigned } from '../text'
import type { FieldType } from './types'

export const mark: FieldType<'mark'> = {
  short: r => (r.bonus !== null ? fmtSigned(r.bonus) : r.state.label),
  plain: r => r.state.label,
  describe: r =>
    `${r.field.def.label}, ${r.state.label.toLowerCase()}${r.bonus !== null ? `, ${saySigned(r.bonus)}` : ''}`,
  stored: r => r.state.id,
}
