import type { FieldType } from './types'

export const state: FieldType<'state'> = {
  short: r => r.option.label,
  plain: r => r.option.label,
  describe: r => `${r.field.def.label}: ${r.option.label}`,
  stored: r => r.option.id,
}
