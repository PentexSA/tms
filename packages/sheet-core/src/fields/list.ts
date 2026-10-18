import { plural } from '../text'
import type { FieldType } from './types'

export const list: FieldType<'list'> = {
  short: r =>
    r.field.def.fixed
      ? `${r.items.filter(x => x.text).length}/${r.items.length}`
      : String(r.items.length),
  plain: r => r.items.map(x => x.name ?? x.text ?? '').join(', '),
  describe: r => {
    const f = r.field.def
    if (f.fixed)
      return `${f.label}: ${r.items.filter(x => x.text).length} de ${r.items.length} preenchidas`
    return `${f.label}: ${plural(r.items.length, 'item', 'itens')}`
  },
  // Lista fixa guarda só { id, text } de cada item (contrato §3).
  stored: r =>
    r.field.def.fixed
      ? r.items.map(x => ({ id: x.id, text: x.text ?? '' }))
      : r.items,
}
