import {
  type CreationAdvice,
  type CreationAdviceCode,
  creationAdvice,
  type FieldId,
  type ListItem,
  type ListMeta,
  labelsFor,
  type Recommend,
  type RecommendedSource,
  type ResolvedSheet,
  recommendedBySource,
  recommendedFor,
  recommendOf,
  type SheetModel,
} from '@tms/sheet-core'
import { useSheetSelector } from '../context'
import { useLifecycle } from '../policy'

// O que a identidade recomenda (D-09) e o que a criação só avisa (D-07), na
// tela: o selo ("do clã"), o "fora do clã: confirme com o narrador" e o meta
// acima do limite ("Posto 2"). A regra é do core (recommendedBySource,
// creationAdvice); aqui só o texto, com rótulos do template e números.
// Nenhum aviso bloqueia: o servidor aceita como antes.
//
// A identidade é lida do store (a ficha mostrada), não da prop `sheet` do
// campo: o FieldSlot reaproveita a entrada de um campo que não mudou, e a
// prop ficaria com o Clã de antes depois de trocar o Clã (code review).

/** O sufixo do app depois do `outside` do template (rascunho do time). */
export const CONFIRM = 'confirme com o narrador'

/** "do clã" ou "da Raça · da Tribo": os selos de um nome, em texto. */
export const badgeText = (labels: readonly string[] | undefined): string =>
  labels?.length ? labels.join(' · ') : ''

/** "fora do clã: confirme com o narrador" */
export const outsideText = (recommend: Recommend): string =>
  `${recommend.outside}: ${CONFIRM}`

/** "Posto 2: na criação, vai até 1. Confirme com o narrador." */
export const aboveText = (meta: ListMeta, value: number, max: number): string =>
  `${meta.label} ${value}: na criação, vai até ${max}. Confirme com o narrador.`

/** "Escolha Clã na identidade para ver as recomendações." (rascunho do time) */
export const chooseText = (labels: readonly string[]): string => {
  const names =
    labels.length > 1
      ? `${labels.slice(0, -1).join(', ')} ou ${labels.at(-1)}`
      : (labels[0] ?? '')
  return `Escolha ${names} na identidade para ver as recomendações.`
}

// O creationAdvice da ficha mostrada, uma vez por ficha resolvida: cada
// linha e a aba de pontos leem o mesmo resultado (code review)
const adviceCache = new WeakMap<ResolvedSheet, readonly CreationAdvice[]>()

export function adviceOf(
  model: SheetModel,
  resolved: ResolvedSheet
): readonly CreationAdvice[] {
  const cached = adviceCache.get(resolved)
  if (cached) return cached
  const advice = creationAdvice(model, resolved)
  adviceCache.set(resolved, advice)
  return advice
}

export interface IdentityAdvice {
  readonly recommend: Recommend | undefined
  // Cada fonte com a escolha da ficha e o que ela recomenda
  readonly sources: readonly RecommendedSource[]
  // Nome (lista) ou id (choice) → selos
  readonly recommended: ReadonlyMap<string, readonly string[]>
  // Os rótulos das fontes ainda sem escolha ("Tribo")
  readonly missing: readonly string[]
  // Só na criação (ficha em `creating`): os avisos de "fora" e de limite
  readonly creating: boolean
  // Os avisos do core para este campo, pelo caminho do item ou do campo
  readonly advice: ReadonlyMap<string, readonly CreationAdviceCode[]>
  // Para a igualdade do seletor: a linha só re-renderiza quando muda
  readonly signature: string
}

const NONE: IdentityAdvice = {
  recommend: undefined,
  sources: [],
  recommended: new Map(),
  missing: [],
  creating: false,
  advice: new Map(),
  signature: '',
}

/** O que a identidade diz de um campo, na ficha resolvida. */
export function identityOf(
  model: SheetModel,
  resolved: ResolvedSheet,
  field: FieldId,
  creating: boolean
): IdentityAdvice {
  const recommend = recommendOf(model, field)
  const advised = (model.template.creation?.advice ?? []).some(a =>
    a.targets.includes(field)
  )
  if (!recommend && !advised) return NONE
  const sources = recommendedBySource(model, resolved, field)
  const advice = new Map<string, CreationAdviceCode[]>()
  if (creating)
    for (const a of adviceOf(model, resolved))
      if (a.field === field)
        for (const p of a.paths)
          advice.set(p, [...(advice.get(p) ?? []), a.code])
  const missing = sources
    .filter(s => s.option === null)
    .map(s => model.fields.get(s.from)?.def.label ?? s.from)
  return {
    recommend,
    sources,
    recommended: recommendedFor(model, resolved, field),
    missing,
    creating,
    advice,
    signature: JSON.stringify([
      creating,
      sources.map(s => [s.option?.id ?? null, s.names]),
      [...advice],
    ]),
  }
}

/** O que a identidade diz de um campo `list` ou `choice`, pelo store. */
export function useIdentityAdvice(field: FieldId): IdentityAdvice {
  const creating = useLifecycle().status === 'creating'
  return useSheetSelector(
    s => identityOf(s.model, s.resolved, field, creating),
    (a, b) => a.signature === b.signature
  )
}

/**
 * O texto por opção de um campo de texto (a Fraqueza pelo Clã) e a opção que
 * o escolhe, pela escolha atual da ficha; null sem `default`, sem escolha ou
 * sem entrada para a opção.
 */
export function textDefaultOf(
  model: SheetModel,
  sheet: ResolvedSheet,
  field: FieldId
): { readonly text: string; readonly option: string } | null {
  const def = model.fields.get(field)?.def
  if ((def?.type !== 'text' && def?.type !== 'longText') || !def.default)
    return null
  const r = sheet.get(def.default.from)
  if (r?.type !== 'choice' || !r.option) return null
  const { map } = def.default
  const text = Object.hasOwn(map, r.option.id) ? map[r.option.id] : undefined
  return typeof text === 'string' && text
    ? { text, option: r.option.label }
    : null
}

/** O mesmo, pelo store: acompanha a troca do Clã mesmo com o campo parado. */
export const useTextDefault = (field: FieldId) =>
  useSheetSelector(
    s => textDefaultOf(s.model, s.resolved, field),
    (a, b) => a?.text === b?.text && a?.option === b?.option
  )

/** Os selos do nome de um item (comparado como a busca: sem acento e caixa). */
export const itemLabels = (
  identity: IdentityAdvice,
  name: string
): readonly string[] | undefined => labelsFor(identity.recommended, name)

/** As linhas de aviso de um item da lista, só na criação. */
export function itemAdviceLines(
  model: SheetModel,
  list: FieldId,
  item: ListItem,
  identity: IdentityAdvice
): readonly string[] {
  const codes = identity.advice.get(`values.${list}#${item.id}`) ?? []
  const lines: string[] = []
  const def = model.fields.get(list)?.def
  if (codes.includes('ADVICE_ABOVE_LEVEL') && def?.type === 'list')
    for (const rule of model.template.creation?.advice ?? []) {
      if (!rule.targets.includes(list)) continue
      const meta = def.item.meta?.find(m => m.id === rule.meta)
      const v = item.meta?.[rule.meta]
      if (meta && typeof v === 'number' && v > rule.max)
        lines.push(aboveText(meta, v, rule.max))
    }
  if (codes.includes('ADVICE_OUTSIDE') && identity.recommend)
    lines.push(outsideText(identity.recommend))
  return lines
}
