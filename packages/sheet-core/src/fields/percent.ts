import type { FieldType } from './types'

export const percent: FieldType<'percent'> = {
  short: r => String(r.value),
  plain: r => String(r.value),
  describe: r =>
    `${r.field.def.label}, ${r.value} por cento; difícil ${r.half}; extremo ${r.fifth}`,
  stored: r => r.value,
}
