import type { SheetModel } from './compile'
import type { FieldId, Recommend } from './contract'
import type { ResolvedSheet } from './resolve'

// O que a identidade recomenda e o que a criação só avisa (D-07, D-09;
// design/templates/README.md §3 `recommend` e §14 `creation.advice`).
//
// Nada aqui entra na conta: `checkCreation`, `complete`, `savable`,
// `checkCreationBatch` e a conclusão no servidor não leem estas funções, e o
// servidor não as chama. Ficam no core porque a tela da criação e, depois, a
// do narrador (P09-D) mostram o mesmo aviso. Só ids do template, caminhos e
// contagens: nenhum texto da ficha.

/** O `recommend` de um campo `list` ou `choice`, ou undefined. */
export function recommendOf(
  model: SheetModel,
  field: FieldId
): Recommend | undefined {
  const def = model.fields.get(field)?.def
  return def?.type === 'list' || def?.type === 'choice'
    ? def.recommend
    : undefined
}

/**
 * Os selos de cada nome (lista) ou id de opção (choice) que a identidade da
 * ficha recomenda: "Potência" → ["do clã"]; um Dom da Raça e da Tribo leva
 * os dois. Sem escolha na fonte, ou opção sem entrada (Caitiff), nada.
 */
export function recommendedFor(
  model: SheetModel,
  sheet: ResolvedSheet,
  field: FieldId
): ReadonlyMap<string, readonly string[]> {
  const out = new Map<string, string[]>()
  for (const source of recommendOf(model, field)?.by ?? []) {
    const r = sheet.get(source.from)
    const option = r?.type === 'choice' ? r.value : null
    if (option === null || !Object.hasOwn(source.map, option)) continue
    const names = source.map[option]
    if (!Array.isArray(names)) continue
    for (const name of names) {
      const labels = out.get(name) ?? []
      if (!labels.includes(source.label)) labels.push(source.label)
      out.set(name, labels)
    }
  }
  return out
}

export type CreationAdviceCode = 'ADVICE_ABOVE_LEVEL' | 'ADVICE_OUTSIDE'

export interface CreationAdvice {
  readonly code: CreationAdviceCode
  readonly field: FieldId
  // `values.<lista>#<item>` ou `values.<choice>`
  readonly paths: readonly string[]
  // Quantos itens (1 num choice)
  readonly amount: number
}

/**
 * O que a criação só avisa, sem bloquear: itens com o meta acima do `max` de
 * `creation.advice` (Dom acima do Posto 1) e escolhas fora do que a
 * identidade recomenda (Disciplina fora do clã, Esfera fora da Tradição).
 * Nada fica "fora" quando a identidade não recomenda nada.
 */
export function creationAdvice(
  model: SheetModel,
  sheet: ResolvedSheet
): readonly CreationAdvice[] {
  const out: CreationAdvice[] = []
  for (const rule of model.template.creation?.advice ?? []) {
    if (rule.rule !== 'item-meta-max') continue
    for (const id of rule.targets) {
      const r = sheet.get(id)
      if (r?.type !== 'list') continue
      const paths = r.items
        .filter(item => {
          const m = item.meta?.[rule.meta]
          return typeof m === 'number' && m > rule.max
        })
        .map(item => `values.${id}#${item.id}`)
      if (paths.length)
        out.push({
          code: 'ADVICE_ABOVE_LEVEL',
          field: id,
          paths,
          amount: paths.length,
        })
    }
  }
  for (const f of model.fields.values()) {
    if (!recommendOf(model, f.id)) continue
    const recommended = recommendedFor(model, sheet, f.id)
    if (!recommended.size) continue
    const r = sheet.get(f.id)
    if (r?.type === 'list') {
      const paths = r.items
        .filter(item => typeof item.name === 'string' && item.name !== '')
        .filter(item => !recommended.has(item.name as string))
        .map(item => `values.${f.id}#${item.id}`)
      if (paths.length)
        out.push({
          code: 'ADVICE_OUTSIDE',
          field: f.id,
          paths,
          amount: paths.length,
        })
    } else if (
      r?.type === 'choice' &&
      r.value !== null &&
      !recommended.has(r.value)
    )
      out.push({
        code: 'ADVICE_OUTSIDE',
        field: f.id,
        paths: [`values.${f.id}`],
        amount: 1,
      })
  }
  return out
}
