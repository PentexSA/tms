import type { FieldType } from './types'

export const clock: FieldType<'clock'> = {
  short: r => r.fills.map(x => `${x.label} ${x.n}`).join(' · '),
  plain: (r, sheet) => clock.short(r, sheet),
  // Como os outros tipos, começa pelo rótulo (o texto visível da linha)
  describe: r =>
    `${r.field.def.label}: ${r.fills.map(x => `${x.label} ${x.n}`).join(', ')}, de ${r.field.def.segments} casas`,
  stored: r => Object.fromEntries(r.fills.map(x => [x.id, x.n])),
}
