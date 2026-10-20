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
  // Lista fixa guarda { id, text } e o que o `item` declara (contrato §3): o
  // rótulo vem do template e não é gravado.
  stored: r =>
    r.field.def.fixed
      ? r.items.map(({ name: _, ...x }) => ({ ...x, text: x.text ?? '' }))
      : r.items,
}
