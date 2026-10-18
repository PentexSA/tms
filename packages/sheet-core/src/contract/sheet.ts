import type { FieldTypeName } from '../registry'
import type { FieldId } from './fields'

// Formato de `characters.sheet_data` (§10 do contrato): um valor por id de
// campo, no formato do tipo, e as especializações à parte.

export interface ResourceValue {
  readonly current: number
  readonly permanent?: number
  readonly temp?: number
  // Só quando `max.stored`; nos demais casos o máximo é derivado.
  readonly max?: number
}

// track `wod-stacking`: contagem por tipo de dano.
export type StackingValue = Readonly<Record<string, number>>

// track `boxes`: caixas marcadas por linha.
export type BoxesValue = Readonly<Record<string, readonly boolean[]>>

export type SlotsValue = Readonly<
  Record<string, { readonly max: number; readonly used: number }>
>

// clock: casas por preenchimento.
export type ClockValue = Readonly<Record<string, number>>

export interface ListItem {
  readonly id: string
  readonly name?: string
  readonly text?: string
  readonly value?: number
  readonly specialty?: string
  readonly notes?: string
  readonly meta?: Readonly<Record<string, number | string>>
}

export interface ValueTypes {
  rating: number
  number: number
  percent: number
  resource: ResourceValue
  track: StackingValue | BoxesValue
  slots: SlotsValue
  clock: ClockValue
  state: string
  mark: string
  text: string
  longText: string
  choice: string
  tags: readonly string[]
  list: readonly ListItem[]
}

export type ValueOf<T extends FieldTypeName> = ValueTypes[T]

export type SheetValue = ValueTypes[FieldTypeName]

export interface SheetData {
  // Campo ausente vale o padrão do tipo (`min`, base, primeira opção).
  readonly values: Readonly<Record<FieldId, SheetValue>>
  readonly specialties?: Readonly<Record<FieldId, string>>
}
