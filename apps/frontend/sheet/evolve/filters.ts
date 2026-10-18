import type {
  CompiledSection,
  FilterRule,
  ResolvedField,
  ResolvedSheet,
  SheetMode,
} from '@tms/sheet-core'
import { fold } from './text'

// Filtro e busca das seções (contrato: `filter: { rule, label, default }` e
// `searchable`). A regra é um nome da lista fechada do core; o rótulo vem do
// template ("Só com pontos", "Só proficientes", "Acima da base").

/** O campo passa na regra? Tipo que a regra não cobre sempre passa. */
export function passesRule(
  rule: FilterRule | string,
  r: ResolvedField
): boolean {
  switch (rule) {
    case 'invested':
      if (r.type === 'rating') return r.base > 0
      if (r.type === 'number') return r.value > 0
      return true
    case 'proficient':
      return r.type !== 'mark' || r.state.id !== 'none'
    case 'aboveBase':
      return r.type !== 'percent' || r.value > r.base
    default:
      return true
  }
}

export interface SectionQuery {
  // Filtro ligado (já considerando o modo: em Evoluir ele some)
  readonly filtered: boolean
  readonly search: string
}

/** Em Evoluir o filtro não vale: é ali que se compra o primeiro ponto. */
export const filterActive = (
  section: CompiledSection,
  mode: SheetMode,
  on: boolean
): boolean => Boolean(section.def.filter) && mode !== 'evolve' && on

/** Os campos visíveis da seção, na ordem do template. */
export function visibleFields(
  section: CompiledSection,
  resolved: ResolvedSheet,
  { filtered, search }: SectionQuery
): string[] {
  const rule = section.def.filter?.rule
  const q = fold(search)
  return section.fieldIds.filter(id => {
    const r = resolved.get(id)
    if (!r) return false
    if (q && !fold(r.field.def.label).includes(q)) return false
    return !filtered || !rule || passesRule(rule, r)
  })
}
