// Leitura defensiva de JSON não confiável (template do banco, ficha do cliente).
// Toda leitura por chave é de propriedade própria: nada vem da cadeia de
// protótipos (defesa contra prototype pollution em lookups como fields[id]).

export type Obj = Record<string, unknown>

export const NUM_LIMIT = 1_000_000

const ID = /^[a-zA-Z][a-zA-Z0-9-]*$/

// Os mesmos nomes que `$defs.id.not.enum` de design/templates/schema.json.
export const FORBIDDEN_IDS = [
  'constructor',
  'prototype',
  'toString',
  'toLocaleString',
  'valueOf',
  'hasOwnProperty',
  'isPrototypeOf',
  'propertyIsEnumerable',
] as const

export const isObj = (v: unknown): v is Obj =>
  v !== null && typeof v === 'object' && !Array.isArray(v)

export const isId = (v: unknown): v is string =>
  typeof v === 'string' &&
  ID.test(v) &&
  !(FORBIDDEN_IDS as readonly string[]).includes(v)

export const own = (o: unknown, k: unknown): boolean =>
  o !== null &&
  typeof o === 'object' &&
  typeof k === 'string' &&
  Object.hasOwn(o, k)

// Valor de uma propriedade própria, ou undefined.
export const get = (o: unknown, k: unknown): unknown =>
  own(o, k) ? (o as Obj)[k as string] : undefined

// O objeto, ou undefined quando não é objeto.
export const rec = (v: unknown): Obj | undefined => (isObj(v) ? v : undefined)

// O array, ou vazio. Só para reler estruturas que já foram checadas.
export const asArray = (v: unknown): readonly unknown[] =>
  Array.isArray(v) ? v : []

// Um id ou uma lista de ids (`from` aceita os dois formatos).
export const flat1 = (v: unknown): readonly unknown[] =>
  Array.isArray(v) ? v : [v]

export const isListItemRef = (
  v: unknown
): v is { readonly list: string; readonly item: string } =>
  isObj(v) && typeof v.list === 'string' && typeof v.item === 'string'

// Pontos do item com esse nome numa lista gravada; sem o item, 0.
export function listItemValue(list: unknown, item: string): number {
  for (const x of asArray(list)) {
    const r = rec(x)
    if (r?.name === item && typeof r.value === 'number')
      return Number.isInteger(r.value) ? r.value : 0
  }
  return 0
}

export const numOr = (v: unknown, fallback: number): number =>
  typeof v === 'number' ? v : fallback

export const isIntIn = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max
