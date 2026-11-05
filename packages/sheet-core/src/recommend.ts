import type { SheetModel } from './compile'
import type { ChoiceOption, FieldId, Recommend } from './contract'
import type { ResolvedSheet } from './resolve'

// O que a identidade recomenda e o que a criação só avisa (D-07, D-09;
// design/templates/README.md §3 `recommend` e §14 `creation.advice`).
//
// Nada aqui entra na conta: `checkCreation`, `complete`, `savable`,
// `checkCreationBatch` e a conclusão no servidor não leem estas funções, e o
// servidor não as chama. Ficam no core porque a tela da criação e, depois, a
// do narrador (P09-D) mostram o mesmo aviso. Só ids do template, caminhos e
// contagens: nenhum texto da ficha.

/**
 * Para comparar nomes: sem acento, sem caixa e sem espaço nas pontas. O
 * mesmo da busca do app: "potencia" e "Potência" são o mesmo nome.
 */
export const foldName = (s: string): string =>
  s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()

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

/** Uma fonte do `recommend` com a escolha da ficha. */
export interface RecommendedSource {
  readonly from: FieldId
  readonly label: string
  // A opção escolhida na identidade, ou null (fonte sem escolha)
  readonly option: ChoiceOption | null
  // Os nomes (lista) ou ids (choice) recomendados por ela, na ordem do mapa;
  // vazio sem escolha ou com opção sem entrada (Caitiff)
  readonly names: readonly string[]
}

/** Cada fonte do `recommend` do campo, com a escolha e o que ela recomenda. */
export function recommendedBySource(
  model: SheetModel,
  sheet: ResolvedSheet,
  field: FieldId
): readonly RecommendedSource[] {
  return (recommendOf(model, field)?.by ?? []).map(source => {
    const r = sheet.get(source.from)
    const option = r?.type === 'choice' ? r.option : null
    const mapped =
      option && Object.hasOwn(source.map, option.id)
        ? source.map[option.id]
        : undefined
    return {
      from: source.from,
      label: source.label,
      option,
      names: Array.isArray(mapped) ? mapped : [],
    }
  })
}

/**
 * Os selos de cada nome (lista) ou id de opção (choice) que a identidade da
 * ficha recomenda: "Potência" → ["do clã"]; um Dom da Raça e da Tribo leva
 * os dois. Sem escolha na fonte, ou opção sem entrada (Caitiff), nada. As
 * chaves são os nomes do template; para procurar o nome de um item, use
 * `labelsFor` (compara com `foldName`).
 */
export function recommendedFor(
  model: SheetModel,
  sheet: ResolvedSheet,
  field: FieldId
): ReadonlyMap<string, readonly string[]> {
  const out = new Map<string, string[]>()
  for (const source of recommendedBySource(model, sheet, field))
    for (const name of source.names) {
      const labels = out.get(name) ?? []
      if (!labels.includes(source.label)) labels.push(source.label)
      out.set(name, labels)
    }
  return out
}

/** Os selos de um nome digitado ou gravado, comparando com `foldName`. */
export function labelsFor(
  recommended: ReadonlyMap<string, readonly string[]>,
  name: string
): readonly string[] | undefined {
  const exact = recommended.get(name)
  if (exact) return exact
  const key = foldName(name)
  for (const [n, labels] of recommended) if (foldName(n) === key) return labels
  return undefined
}

export type CreationAdviceCode = 'ADVICE_ABOVE_LEVEL' | 'ADVICE_OUTSIDE'

export interface CreationAdvice {
  readonly code: CreationAdviceCode
  readonly field: FieldId
  // `values.<lista>#<item>` ou `values.<choice>`
  readonly paths: readonly string[]
  // Quantos itens (1 num choice)
  readonly amount: number
  // ADVICE_ABOVE_LEVEL: o índice da regra em `creation.advice` (uma lista
  // pode ter duas regras, com metas diferentes)
  readonly rule?: number
}

/**
 * O que a criação só avisa, sem bloquear: itens com o meta acima do `max` de
 * `creation.advice` (Dom acima do Posto 1) e escolhas fora do que a
 * identidade recomenda (Disciplina fora do clã, Esfera fora da Tradição).
 * Nada fica "fora" enquanto alguma fonte do `recommend` está sem escolha
 * (falta a Tribo: o Dom ainda pode ser dela) nem quando nada é recomendado.
 */
export function creationAdvice(
  model: SheetModel,
  sheet: ResolvedSheet
): readonly CreationAdvice[] {
  const out: CreationAdvice[] = []
  for (const [index, rule] of (
    model.template.creation?.advice ?? []
  ).entries()) {
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
          rule: index,
        })
    }
  }
  for (const f of model.fields.values()) {
    if (!recommendOf(model, f.id)) continue
    const sources = recommendedBySource(model, sheet, f.id)
    if (sources.some(s => s.option === null)) continue
    const recommended = recommendedFor(model, sheet, f.id)
    if (!recommended.size) continue
    const r = sheet.get(f.id)
    if (r?.type === 'list') {
      const paths = r.items
        .filter(item => typeof item.name === 'string' && item.name !== '')
        .filter(item => !labelsFor(recommended, item.name as string))
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
