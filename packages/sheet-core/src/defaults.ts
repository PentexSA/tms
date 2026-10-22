import type { FieldId } from './contract'
import { flat1, get, isListItemRef, isObj, rec } from './validate/util'

// Valor inicial por fórmula (design/templates/README.md §3, `default`): um
// inteiro, uma derivação da lista fechada ou um valor por opção de um
// `choice`. Nunca expressão. O resolve e o validateSheet usam o mesmo cálculo;
// cada um diz como ler um número e um `choice`.

export interface FormulaReader {
  derive(name: unknown, from: unknown): number
  choice(id: FieldId): unknown
}

/** O valor da fórmula, limitado a `min..max`. Sem fórmula, ou sem a opção no mapa, o mínimo. */
export function formulaValue(
  formula: unknown,
  read: FormulaReader,
  min: number,
  max: number
): number {
  const clamp = (n: number) => Math.min(max, Math.max(min, n))
  if (typeof formula === 'number')
    return Number.isInteger(formula) ? clamp(formula) : min
  const f = rec(formula)
  if (f?.derive !== undefined) {
    const n = read.derive(f.derive, f.from)
    return Number.isFinite(n) ? clamp(Math.trunc(n)) : min
  }
  if (typeof f?.from === 'string' && isObj(f.map)) {
    const n = get(f.map, read.choice(f.from))
    return typeof n === 'number' && Number.isInteger(n) ? clamp(n) : min
  }
  return min
}

/** Os campos que a fórmula lê: as fontes da derivação (a lista, para um item) ou o `choice`. */
export function formulaDeps(formula: unknown): FieldId[] {
  const f = rec(formula)
  if (f?.derive !== undefined)
    return flat1(f.from).flatMap(x =>
      typeof x === 'string' ? [x] : isListItemRef(x) ? [x.list] : []
    )
  if (typeof f?.from === 'string' && isObj(f.map)) return [f.from]
  return []
}
