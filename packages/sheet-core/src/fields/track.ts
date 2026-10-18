import type { ResolvedStacking } from '../resolve'
import { fmtPenalty, saySigned } from '../text'
import type { FieldType } from './types'

const status = (r: ResolvedStacking) => r.level?.label ?? 'Sem ferimentos'

export const track: FieldType<'track'> = {
  short: r => {
    if (r.rule === 'boxes') return `${r.marked}/${r.total}`
    return r.level ? `${status(r)} ${fmtPenalty(r.penalty)}` : status(r)
  },
  plain: (r, sheet) => track.short(r, sheet),
  describe: r => {
    const f = r.field.def
    if (r.rule === 'boxes')
      return `${f.label}: ${r.rows
        .map(
          row =>
            `${row.label} ${row.marks.filter(Boolean).length} de ${row.boxes} marcadas`
        )
        .join('; ')}`
    const damage = (f.types ?? [])
      .filter(t => r.counts[t.id])
      .map(t => `${r.counts[t.id]} ${t.label.toLowerCase()}`)
    const penalty = r.level
      ? `, penalidade ${r.penalty === null ? 'incapacitado' : saySigned(r.penalty)}`
      : ''
    return `${f.label}: ${status(r)}${penalty}; ${damage.length ? damage.join(', ') : 'sem dano'}`
  },
  stored: r =>
    r.rule === 'boxes'
      ? Object.fromEntries(r.rows.map(row => [row.id, [...row.marks]]))
      : { ...r.counts },
}
