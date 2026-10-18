// Testes de tipo: compilados pelo `typecheck` (não rodam no `bun test`). Cada
// `@ts-expect-error` precisa de um erro de verdade; se o tipo afrouxar, a
// linha deixa de errar e o typecheck falha.
import type {
  FieldDef,
  RatingField,
  ResourceValue,
  Roll,
  SheetData,
  Template,
} from '../contract'

// rating exige max
// @ts-expect-error: falta max
export const ratingWithoutMax: RatingField = { type: 'rating', label: 'Força' }
export const rating: RatingField = { type: 'rating', label: 'Força', max: 5 }

// O tipo é fechado: chave fora do contrato não compila
export const unknownKey: FieldDef = {
  type: 'text',
  label: 'Nome',
  // @ts-expect-error: onclick não existe no contrato
  onclick: 'alert(1)',
}

// Só os nomes das listas fechadas
// @ts-expect-error: formula não é um tipo de campo
export const unknownType: FieldDef = { type: 'formula', label: 'X' }
export const badDerive: FieldDef = {
  type: 'number',
  label: 'X',
  // @ts-expect-error: eval não é uma derivação registrada
  derive: 'eval',
}

// Valor de resource com chave extra não compila
export const resourceValue: ResourceValue = {
  current: 5,
  // @ts-expect-error: bonus não existe no valor de resource
  bonus: 10,
}

// A união de rolagem é discriminada por model
export const pool: Roll = {
  model: 'pool-success',
  label: 'Dados',
  slots: [],
  difficulty: { default: 6, min: 2, max: 10 },
}
// @ts-expect-error: pool-success exige difficulty
export const poolWithoutDifficulty: Roll = {
  model: 'pool-success',
  label: 'Dados',
  slots: [],
}

// O modelo é somente leitura
export function readonlyTemplate(t: Template, s: SheetData) {
  // @ts-expect-error: templates são imutáveis
  t.name = 'x'
  // @ts-expect-error: valores da ficha também
  s.values.name = 'x'
}
