import type { FieldTypeName, SkinName } from '@tms/sheet-core'
import { ChoiceEditorRow } from '../evolve/ChoiceEditorRow'
import { ListEditor } from '../evolve/ListEditor'
import { NumberEditorRow } from '../evolve/NumberEditorRow'
import { ResourceEditorRow } from '../evolve/ResourceEditorRow'
import { TextEditorRow } from '../evolve/TextEditorRow'
import { ChoiceFact } from './ChoiceFact'
import { ClockChip, ClockRow, ClockSheet } from './clock/ClockViews'
import { FieldDetail } from './FieldDetail'
import { GenericChip } from './GenericChip'
import { GenericFact, GenericRow } from './GenericRow'
import { ListRow } from './ListView'
import { RatingCell, RatingRow } from './RatingViews'
import { ResourceChip } from './resource/ResourceChip'
import { ResourceRow } from './resource/ResourceRow'
import { ResourceSheet } from './resource/ResourceSheet'
import { wodViews } from './skins/wod'
import { StateRow, StateSheet } from './state/StateViews'
import { TrackChip } from './track/TrackChip'
import { TrackRow } from './track/TrackRow'
import { TrackSheet } from './track/TrackSheet'
import type { FieldView, FieldViewComponent, Variant } from './types'

export type { FieldView, FieldViewProps, Variant } from './types'

// Uma entrada por tipo da lista fechada: o build quebra se faltar um. Tipo
// sem view própria cai no GenericRow. A variante `editor` é a de Evoluir
// (Etapa 18); as views de Jogo (resource, track) são da Etapa 17.
export const baseViews = {
  rating: { row: RatingRow, cell: RatingCell, editor: NumberEditorRow },
  number: { editor: NumberEditorRow },
  percent: { editor: NumberEditorRow },
  // Jogo (Etapa 17): linha, chip do dock e sheet; Evoluir (18): o editor
  resource: {
    row: ResourceRow,
    chip: ResourceChip,
    sheet: ResourceSheet,
    editor: ResourceEditorRow,
  },
  track: { row: TrackRow, chip: TrackChip, sheet: TrackSheet },
  slots: {},
  // Jogo (v1, Etapa 4): a roda; muda só em Jogo, sem editor de Editar
  clock: { row: ClockRow, chip: ClockChip, sheet: ClockSheet },
  // Jogo (v2, Etapa 3): a opção e o sheet de troca; o chip é o genérico
  state: { row: StateRow, sheet: StateSheet, editor: ChoiceEditorRow },
  mark: {},
  text: { editor: TextEditorRow },
  longText: { editor: TextEditorRow },
  // v2, Etapa 4: o fato com o glifo do template (a lua do Augúrio)
  choice: { fact: ChoiceFact, editor: ChoiceEditorRow },
  tags: {},
  list: { row: ListRow, editor: ListEditor },
} satisfies Record<FieldTypeName, FieldView>

// Overrides por skin (doc/arquitetura §6.4): mesmas props, mesma
// acessibilidade, só o visual muda.
export const skinViews: Readonly<
  Record<SkinName, Partial<Record<FieldTypeName, FieldView>>>
> = { wod: wodViews, dnd: {}, coc: {}, fate: {} }

// Variantes que não podem cair numa linha: o chip do dock é pequeno e o sheet
// é o detalhe (com o porquê de não dar para mexer).
const FALLBACK: Readonly<Partial<Record<Variant, FieldViewComponent>>> = {
  fact: GenericFact,
  chip: GenericChip,
  sheet: FieldDetail,
}

/** Ordem fixa: override da skin → variante do tipo → linha do tipo → genérica. */
export function resolveView(
  skin: SkinName,
  type: FieldTypeName,
  variant: Variant,
  views: Readonly<Record<FieldTypeName, FieldView>> = baseViews,
  skins = skinViews
): FieldViewComponent {
  const own = <T extends object>(o: T, k: PropertyKey) =>
    Object.hasOwn(o, k) ? (o as Record<PropertyKey, unknown>)[k] : undefined
  const override = (
    own(skins, skin) as Partial<Record<FieldTypeName, FieldView>> | undefined
  )?.[type]?.[variant]
  const base = own(views, type) as FieldView | undefined
  return (
    override ?? base?.[variant] ?? FALLBACK[variant] ?? base?.row ?? GenericRow
  )
}

/** O tipo tem view própria nesta variante (na skin ou na base)? */
export function hasView(
  skin: SkinName,
  type: FieldTypeName,
  variant: Variant,
  views: Readonly<Record<FieldTypeName, FieldView>> = baseViews,
  skins = skinViews
): boolean {
  const skinned = Object.hasOwn(skins, skin) ? skins[skin][type] : undefined
  const base = Object.hasOwn(views, type) ? views[type] : undefined
  return Boolean(skinned?.[variant] ?? base?.[variant])
}
