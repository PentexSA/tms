import type { FieldType } from './types'

export const choice: FieldType<'choice'> = {
  short: r => r.option?.label ?? '',
  plain: r => r.option?.label ?? '',
  describe: r => `${r.field.def.label}: ${r.option?.label || 'vazio'}`,
  stored: r => r.value ?? undefined,
}
