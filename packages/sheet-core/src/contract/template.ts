import type {
  BoostEffect,
  DiceNotation,
  Die,
  EffectName,
  FilterRule,
  LayoutName,
  RoleName,
  SkinName,
  SpecialtyRule,
  ZoneName,
} from '../registry'
import type { ActionParams, FieldDef, FieldId } from './fields'

// O template inteiro (`trait_templates.template_data`), espelhando
// design/templates/schema.json (§2 do contrato).

export interface SectionGroup {
  readonly id: string
  readonly title: string
  readonly fields: readonly FieldId[]
}

export interface SectionPermissions {
  readonly read?: readonly RoleName[]
  readonly write?: readonly RoleName[]
}

export interface Section {
  readonly id: string
  readonly zone: ZoneName
  readonly title: string
  readonly layout: LayoutName
  // `fields` e `groups` são mutuamente exclusivos (schema.json).
  readonly fields?: readonly FieldId[]
  readonly groups?: readonly SectionGroup[]
  readonly filter?: {
    readonly rule: FilterRule
    readonly label: string
    readonly default?: boolean
  }
  readonly searchable?: boolean
  /** No celular, os grupos viram abas (Físicos, Sociais, Mentais). */
  readonly groupTabs?: boolean
  readonly badge?: { readonly field: FieldId; readonly label: string }
  readonly permissions?: SectionPermissions
  readonly pinTop?: boolean
  readonly columns?: number
  readonly minColWidth?: number
  readonly collapsed?: boolean
}

export interface Identity {
  readonly name: FieldId
  readonly chip: FieldId
  readonly chipFormat?: string
  readonly summary?: readonly FieldId[]
  readonly voice?: FieldId
  readonly subtitle?: FieldId
  /** Colunas do cabeçalho, como na ficha impressa (Editar e criação). */
  readonly columns?: readonly (readonly FieldId[])[]
}

export type AccentRef = string

export interface Accent {
  readonly from: FieldId | null
  readonly map: Readonly<Record<string, AccentRef>>
  readonly fallback: AccentRef
}

export interface MarkState {
  readonly id: string
  readonly label: string
  readonly glyph?: string
  readonly multiplier?: number
}

// Escada nomeada: valor ("-2".."999") → nome ("+3" = "Bom").
export type Ladder = Readonly<Record<string, string>>

export interface RollSlot {
  readonly id: string
  readonly label: string
  readonly from: readonly string[]
  readonly optional?: boolean
}

export interface RollPreset {
  readonly id: string
  readonly label: string
  readonly slots: Readonly<Record<string, FieldId>>
  readonly help?: string
}

export interface RollBoost {
  readonly id: string
  readonly label: string
  readonly resource: FieldId
  readonly cost: number
  readonly effect: BoostEffect
}

export interface RollTarget {
  readonly label: string
  readonly default: number
  readonly min: number
  readonly max: number
}

interface RollBase<M extends string> {
  readonly model: M
  readonly label: string
  readonly slots: readonly RollSlot[]
  readonly presets?: readonly RollPreset[]
}

export interface PoolSuccessRoll extends RollBase<'pool-success'> {
  readonly die?: Die
  readonly difficulty: {
    readonly default: number
    readonly min: number
    readonly max: number
  }
  readonly penalty?: { readonly field: FieldId }
  readonly specialty?: SpecialtyRule
  readonly boosts?: readonly RollBoost[]
}

export interface SumVsTargetRoll extends RollBase<'sum-vs-target'> {
  readonly dice?: DiceNotation
  readonly advantage?: boolean
  readonly target: RollTarget
  readonly conditions?: { readonly field: FieldId }
}

export interface RollUnderPercentRoll extends RollBase<'roll-under-percent'> {
  readonly dice?: DiceNotation
  readonly bonusDice: { readonly min: number; readonly max: number }
}

export interface FudgeRoll extends RollBase<'fudge'> {
  readonly dice?: DiceNotation
  readonly ladder: string
  readonly target: RollTarget
  readonly boosts?: readonly RollBoost[]
}

export interface PbtaRoll extends RollBase<'pbta-2d6'> {
  readonly dice?: DiceNotation
}

// União discriminada por `model`.
export type Roll =
  | PoolSuccessRoll
  | SumVsTargetRoll
  | RollUnderPercentRoll
  | FudgeRoll
  | PbtaRoll

export interface TemplateAction {
  readonly id: string
  readonly label: string
  readonly effect: EffectName
  readonly params?: ActionParams
  readonly help?: string
}

export type TabZone = 'build' | 'powers' | 'lore'

export interface Template {
  readonly schema: 1
  readonly system: string
  readonly name: string
  readonly family: string
  readonly edition: string
  readonly templateVersion: string
  readonly locale: string
  readonly skin: SkinName
  readonly license: string
  readonly identity: Identity
  readonly accent: Accent
  readonly ladders?: Readonly<Record<string, Ladder>>
  readonly markStates?: Readonly<Record<string, readonly MarkState[]>>
  readonly fields: Readonly<Record<FieldId, FieldDef>>
  readonly sections: readonly Section[]
  readonly zoneLabels?: Readonly<Partial<Record<TabZone, string>>>
  readonly dock: readonly FieldId[]
  readonly roll: Roll
  readonly actions?: readonly TemplateAction[]
}
