import type {
  AtZeroRule,
  ClockRule,
  ColorRole,
  ConditionRoll,
  DefaultAction,
  DeriveName,
  EffectName,
  FieldTypeName,
  GlyphName,
  ModeName,
  ModifierOp,
  NumberDisplay,
  PercentDisplay,
  ResourceRule,
  SlotReset,
  TrackRule,
} from '../registry'

// Tipos dos campos do template, espelhando `$defs.field-<tipo>` de
// design/templates/schema.json (§3 do contrato). Só existem depois do
// validador: o caminho de `unknown` até aqui é `parseTemplate` (parse.ts).

export type FieldId = string

// Campo ou lista de campos (até 4), na ordem dos argumentos da derivação.
/** Pontos de um item de lista, pelo nome (o antecedente Geração). */
export interface ListItemRef {
  readonly list: FieldId
  readonly item: string
}

export type FromSource = FieldId | ListItemRef
export type FromRef = FromSource | readonly FromSource[]

export interface DeriveRef {
  readonly derive: DeriveName
  readonly from: FromRef
}

export interface FieldValueRef {
  readonly field: FieldId
}

export interface ActionParams {
  readonly field?: FieldId
  readonly amount?: number
  readonly types?: readonly string[]
}

// Ação no sheet de um recurso (com custo nele) ou no menu da ficha (§8).
export interface ResourceAction {
  readonly id: string
  readonly label: string
  readonly cost?: number
  readonly effect: EffectName
  readonly params?: ActionParams
  readonly help?: string
}

interface FieldBase<T extends FieldTypeName> {
  readonly type: T
  readonly label: string
  readonly shortLabel?: string
  readonly sublabel?: string
  readonly help?: string
  readonly editableIn?: readonly ModeName[]
}

export interface RatingField extends FieldBase<'rating'> {
  readonly min?: number
  readonly max: number
  readonly default?: number
  readonly specialty?: boolean
  // Teto não destrutivo: o excedente fica inativo e volta quando o teto sobe.
  readonly cap?: { readonly field: FieldId; readonly label?: string }
  readonly valueLabels?: Readonly<Record<string, string>>
}

export interface NumberField extends FieldBase<'number'> {
  readonly display?: NumberDisplay
  readonly min?: number
  readonly max?: number
  readonly default?: number
  readonly specialty?: boolean
  readonly derive?: DeriveName
  readonly from?: FromRef
  // Derivado: nunca é guardado; o servidor recalcula.
  readonly readOnly?: boolean
  readonly ladder?: string
  readonly suffix?: string
  readonly allowInput?: boolean
  readonly badge?: {
    readonly field: FieldId
    readonly label: string
    readonly glyph: string
  }
}

export interface PercentField extends FieldBase<'percent'> {
  readonly display?: PercentDisplay
  readonly max?: number
  readonly specialty?: boolean
  readonly base?: number | FieldValueRef | DeriveRef
}

export interface StoredMax {
  readonly stored: true
  readonly min: number
  readonly max: number
}

export interface ResourceField extends FieldBase<'resource'> {
  readonly permanent?: { readonly min: number; readonly max: number }
  readonly temp?: boolean
  readonly tempUncapped?: boolean
  readonly overMax?: boolean
  readonly max?: number | DeriveRef | FieldValueRef | StoredMax
  readonly perTurn?: DeriveRef
  readonly rule?: ResourceRule
  readonly atZero?: AtZeroRule
  readonly allowInput?: boolean
  readonly spendLabel?: string
  readonly gainLabel?: string
  readonly colorRole?: ColorRole
  readonly defaultAction?: DefaultAction
  readonly actions?: readonly ResourceAction[]
}

export interface TrackLevel {
  readonly label: string
  // null: incapacitado (bloqueia a rolagem).
  readonly penalty: number | null
}

export interface DamageType {
  readonly id: string
  readonly label: string
  readonly glyph: string
}

export interface TrackRow {
  readonly id: string
  readonly label: string
  readonly boxes: number
  readonly boxValues?: readonly number[]
}

export interface TrackField extends FieldBase<'track'> {
  readonly rule: TrackRule
  // wod-stacking: níveis na ordem em que enchem e tipos do mais grave ao menos.
  readonly levels?: readonly TrackLevel[]
  readonly types?: readonly DamageType[]
  // boxes: linhas de caixas.
  readonly rows?: readonly TrackRow[]
}

export interface SlotsField extends FieldBase<'slots'> {
  readonly levels: number
  readonly levelLabel: string
  readonly reset?: SlotReset
  readonly defaultAction?: DefaultAction
}

export interface ClockFill {
  readonly id: string
  readonly label: string
  readonly colorRole: ColorRole
  readonly from: 'start' | 'end'
}

export interface ClockField extends FieldBase<'clock'> {
  readonly rule: ClockRule
  readonly segments: number
  readonly fills: readonly ClockFill[]
}

export interface StateModifier {
  readonly field: FieldId
  readonly op: ModifierOp
  readonly value: number
}

export interface StateOption {
  readonly id: string
  readonly label: string
  readonly hint?: string
  readonly note?: string
  readonly modifiers?: readonly StateModifier[]
}

export interface StateField extends FieldBase<'state'> {
  // A primeira opção é o padrão.
  readonly options: readonly StateOption[]
  readonly cost?: {
    readonly resource: FieldId
    readonly amount: number
    readonly optional?: boolean
    readonly label: string
  }
}

export interface MarkField extends FieldBase<'mark'> {
  // Id de um conjunto em `markStates`; o primeiro estado é `none`.
  readonly states: string
  readonly bonus?: { readonly derive: DeriveName; readonly ability: FieldId }
}

export interface TextField extends FieldBase<'text'> {
  readonly maxLength?: number
  readonly aspect?: boolean
  readonly placeholder?: string
}

export interface LongTextField extends FieldBase<'longText'> {
  readonly maxLength?: number
  readonly placeholder?: string
}

export interface ChoiceOption {
  readonly id: string
  readonly label: string
  readonly meta?: string
  readonly glyphParam?: number
}

export interface ChoiceField extends FieldBase<'choice'> {
  readonly glyph?: GlyphName
  readonly options: readonly ChoiceOption[]
}

export interface TagOption {
  readonly id: string
  readonly label: string
  readonly roll?: ConditionRoll
}

export interface TagsField extends FieldBase<'tags'> {
  readonly options: readonly TagOption[]
}

export interface ListMeta {
  readonly id: string
  readonly type: 'number' | 'text'
  readonly label: string
  readonly display?: 'signed'
  readonly min?: number
  readonly max?: number
}

export interface ListItemSchema {
  readonly value?: {
    readonly type: 'rating'
    readonly min?: number
    readonly max: number
  }
  readonly meta?: readonly ListMeta[]
  readonly notes?: boolean
  readonly specialty?: boolean
  readonly aspect?: boolean
}

export interface ListFixedItem {
  readonly id: string
  readonly label: string
  readonly meta?: string
}

export interface ListField extends FieldBase<'list'> {
  readonly itemLabel: string
  readonly item: ListItemSchema
  // Só nomes: descrições protegidas não entram no template (§12).
  readonly catalog?: readonly string[]
  readonly fixed?: readonly ListFixedItem[]
  readonly searchable?: boolean
  readonly density?: 'regular' | 'compact'
  readonly rollAs?: 'ability' | 'attack'
}

// Um campo de cada tipo, indexado pelo nome do tipo.
export interface FieldDefs {
  rating: RatingField
  number: NumberField
  percent: PercentField
  resource: ResourceField
  track: TrackField
  slots: SlotsField
  clock: ClockField
  state: StateField
  mark: MarkField
  text: TextField
  longText: LongTextField
  choice: ChoiceField
  tags: TagsField
  list: ListField
}

export type FieldDefOf<T extends FieldTypeName> = FieldDefs[T]

// União discriminada por `type`: `switch (field.type)` estreita o tipo.
export type FieldDef = FieldDefs[FieldTypeName]
