import type { FieldTypeName, SkinName } from '@tms/sheet-core'
import { FieldDetail } from './FieldDetail'
import { GenericChip } from './GenericChip'
import { GenericFact, GenericRow } from './GenericRow'
import { ResourceChip } from './resource/ResourceChip'
import { ResourceRow } from './resource/ResourceRow'
import { ResourceSheet } from './resource/ResourceSheet'
import { TrackChip } from './track/TrackChip'
import { TrackRow } from './track/TrackRow'
import { TrackSheet } from './track/TrackSheet'
import type { FieldView, FieldViewComponent, Variant } from './types'

export type { FieldView, FieldViewProps, Variant } from './types'

// Uma entrada por tipo da lista fechada: o build quebra se faltar um. Tipo
// sem view própria cai no GenericRow; as views ricas entram nas Etapas 17 e 18.
export const baseViews = {
  rating: {},
  number: {},
  percent: {},
  // Modo Jogo (Etapa 17): linha, chip do dock e sheet
  resource: { row: ResourceRow, chip: ResourceChip, sheet: ResourceSheet },
  track: { row: TrackRow, chip: TrackChip, sheet: TrackSheet },
  slots: {},
  clock: {},
  state: {},
  mark: {},
  text: {},
  longText: {},
  choice: {},
  tags: {},
  list: {},
} satisfies Record<FieldTypeName, FieldView>

// Overrides por skin (doc/arquitetura §6.4): mesmas props, mesma
// acessibilidade, só o visual muda.
export const skinViews: Readonly<
  Record<SkinName, Partial<Record<FieldTypeName, FieldView>>>
> = { wod: {}, dnd: {}, coc: {}, fate: {} }

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
