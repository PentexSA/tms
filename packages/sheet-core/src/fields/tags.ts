import type { FieldType } from './types'

export const tags: FieldType<'tags'> = {
  short: r => (r.options.length ? String(r.options.length) : 'nenhuma'),
  plain: r => r.options.map(o => o.label).join(', '),
  describe: r =>
    `${r.field.def.label}: ${r.options.length ? r.options.map(o => o.label).join(', ') : 'nenhuma'}`,
  stored: r => r.options.map(o => o.id),
}
