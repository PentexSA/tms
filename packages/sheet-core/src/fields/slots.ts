import type { FieldType } from './types'

export const slots: FieldType<'slots'> = {
  short: r => {
    const level = r.levels.find(l => l.used < l.max) ?? r.levels[0]
    return level ? `${level.label} ${level.max - level.used}/${level.max}` : '—'
  },
  plain: (r, sheet) => slots.short(r, sheet),
  describe: r =>
    `${r.field.def.label}: ${
      r.levels
        .map(l => `${l.label} nível, ${l.max - l.used} de ${l.max} disponíveis`)
        .join('; ') || 'nenhum'
    }`,
  stored: r =>
    Object.fromEntries(
      r.levels.map(l => [String(l.n), { max: l.max, used: l.used }])
    ),
}
