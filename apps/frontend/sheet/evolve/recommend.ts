import {
  type CreationAdviceCode,
  creationAdvice,
  type FieldId,
  type ListItem,
  type ListMeta,
  type Recommend,
  type ResolvedSheet,
  recommendedFor,
  recommendOf,
  type SheetModel,
} from '@tms/sheet-core'
import { useMemo } from 'react'
import { useSheet } from '../context'
import { useLifecycle } from '../policy'

// O que a identidade recomenda (D-09) e o que a criação só avisa (D-07), na
// tela: o selo ("do clã"), o "fora do clã: confirme com o narrador" e o meta
// acima do limite ("Posto 2"). A regra é do core (recommendedFor,
// creationAdvice); aqui só o texto, com rótulos do template e números.
// Nenhum aviso bloqueia: o servidor aceita como antes.

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

/** O rótulo de cada `from` sem escolha, para "Escolha Clã na identidade". */
export function missingSources(
  model: SheetModel,
  sheet: ResolvedSheet,
  recommend: Recommend
): readonly string[] {
  return recommend.by.flatMap(source => {
    const r = sheet.get(source.from)
    if (r?.type === 'choice' && r.value !== null) return []
    return [model.fields.get(source.from)?.def.label ?? source.from]
  })
}

/** "Escolha Clã na identidade para ver as recomendações." (rascunho do time) */
export const chooseText = (labels: readonly string[]): string => {
  const names =
    labels.length > 1
      ? `${labels.slice(0, -1).join(', ')} ou ${labels.at(-1)}`
      : (labels[0] ?? '')
  return `Escolha ${names} na identidade para ver as recomendações.`
}

export interface IdentityAdvice {
  readonly recommend: Recommend | undefined
  // Nome (lista) ou id (choice) → selos
  readonly recommended: ReadonlyMap<string, readonly string[]>
  // Só na criação (ficha em `creating`): os avisos de "fora" e de limite
  readonly creating: boolean
  // Os avisos do core para este campo, pelo caminho do item ou do campo
  readonly advice: ReadonlyMap<string, readonly CreationAdviceCode[]>
}

/** O que a identidade diz de um campo `list` ou `choice` desta ficha. */
export function useIdentityAdvice(
  field: FieldId,
  sheet: ResolvedSheet
): IdentityAdvice {
  const { model } = useSheet()
  const creating = useLifecycle().status === 'creating'
  return useMemo(() => {
    const recommend = recommendOf(model, field)
    // Só o campo que tem o que avisar paga a conta dos avisos
    const advised =
      recommend !== undefined ||
      (model.template.creation?.advice ?? []).some(a =>
        a.targets.includes(field)
      )
    const advice = new Map<string, CreationAdviceCode[]>()
    if (creating && advised)
      for (const a of creationAdvice(model, sheet))
        if (a.field === field)
          for (const p of a.paths)
            advice.set(p, [...(advice.get(p) ?? []), a.code])
    return {
      recommend,
      recommended: recommendedFor(model, sheet, field),
      creating,
      advice,
    }
  }, [model, sheet, field, creating])
}

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
