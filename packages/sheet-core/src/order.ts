import type { SheetModel } from './compile'
import type { FieldId } from './contract'

// A ordem e o lugar de cada campo na ficha, pelas seções do template (T-54).
// O template chega do banco como `jsonb`, que não guarda a ordem das chaves de
// objeto (ordena pelo tamanho da chave): `model.fields` sai fora da ordem da
// ficha. As `sections` e os `groups` são arrays, e o `jsonb` mantém a ordem
// deles. Nada aqui conhece sistema: só seções, grupos e campos.

export interface FieldPlace {
  // Título da seção onde o campo aparece primeiro ("Habilidades")
  readonly section: string
  // Título do grupo dentro dela ("Talentos"), ou null numa seção sem grupos
  readonly group: string | null
}

interface Index {
  readonly order: readonly FieldId[]
  readonly rank: ReadonlyMap<FieldId, number>
  readonly place: ReadonlyMap<FieldId, FieldPlace>
}

// O modelo é imutável e memoizado por versão: o índice também
const indexes = new WeakMap<SheetModel, Index>()

function indexOf(model: SheetModel): Index {
  const hit = indexes.get(model)
  if (hit) return hit
  const order: FieldId[] = []
  const place = new Map<FieldId, FieldPlace>()
  const add = (id: FieldId, at: FieldPlace) => {
    if (!model.fields.has(id) || place.has(id)) return
    order.push(id)
    place.set(id, at)
  }
  for (const section of model.sections.values()) {
    const title = section.def.title
    if (section.groups)
      for (const group of section.groups)
        for (const id of group.fieldIds)
          add(id, { section: title, group: group.title })
    else
      for (const id of section.fieldIds)
        add(id, { section: title, group: null })
  }
  // Campos fora de seção (derivados internos, identidade) vêm depois, na
  // ordem do modelo
  for (const id of model.fields.keys()) if (!place.has(id)) order.push(id)
  const rank = new Map(order.map((id, i) => [id, i]))
  const index = Object.freeze({
    order: Object.freeze(order),
    rank,
    place,
  })
  indexes.set(model, index)
  return index
}

/** Os campos na ordem da ficha: seções, grupos e campos do template. */
export function fieldOrder(model: SheetModel): readonly FieldId[] {
  return indexOf(model).order
}

/** A posição do campo na ordem da ficha; desconhecido vai para o fim. */
export function fieldRank(model: SheetModel, id: FieldId): number {
  return indexOf(model).rank.get(id) ?? Number.MAX_SAFE_INTEGER
}

/** Onde o campo aparece primeiro na ficha; null se não está em seção. */
export function fieldPlace(model: SheetModel, id: FieldId): FieldPlace | null {
  return indexOf(model).place.get(id) ?? null
}
