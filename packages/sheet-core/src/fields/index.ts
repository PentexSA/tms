import type { FieldTypeName } from '../registry'
import type { ResolvedField, ResolvedSheet } from '../resolve'
import { choice } from './choice'
import { clock } from './clock'
import { list } from './list'
import { mark } from './mark'
import { number } from './number'
import { percent } from './percent'
import { rating } from './rating'
import { resource } from './resource'
import { slots } from './slots'
import { state } from './state'
import { tags } from './tags'
import { longText, text } from './text'
import { track } from './track'
import type { FieldType } from './types'

export { inactiveNote, modifierNote } from './rating'
export type { FieldType } from './types'

// Um comportamento por tipo da lista fechada: o build quebra se faltar um.
export const FIELD_TYPES: { readonly [T in FieldTypeName]: FieldType<T> } = {
  rating,
  number,
  percent,
  resource,
  track,
  slots,
  clock,
  state,
  mark,
  text,
  longText,
  choice,
  tags,
  list,
}

// O TS não correlaciona `r.type` com `FIELD_TYPES[r.type]`; o registro acima
// garante que cada entrada recebe o seu próprio tipo resolvido.
const typeOf = (r: ResolvedField) =>
  FIELD_TYPES[r.type] as unknown as FieldType<FieldTypeName> & {
    [K in keyof FieldType<FieldTypeName>]: (
      r: ResolvedField,
      sheet: ResolvedSheet
    ) => ReturnType<FieldType<FieldTypeName>[K]>
  }

export const short = (r: ResolvedField, sheet: ResolvedSheet): string =>
  typeOf(r).short(r, sheet)

export const describe = (r: ResolvedField, sheet: ResolvedSheet): string =>
  typeOf(r).describe(r, sheet)

export const plain = (r: ResolvedField, sheet: ResolvedSheet): string =>
  typeOf(r).plain(r, sheet)

export const stored = (r: ResolvedField, sheet: ResolvedSheet) =>
  typeOf(r).stored(r, sheet)
