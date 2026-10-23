import type { SheetModel } from './compile'
import type { Issue } from './validate/issues'

export type ChronicleOptionValues = Readonly<
  Record<string, boolean | number | string>
>

/** Valida somente ids e valores declarados pelo template, sem coerção. */
export function validateChronicleOptions(
  model: SheetModel,
  input: unknown
): Issue[] {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    return [{ path: 'options', message: 'precisa ser objeto' }]
  const values = input as Record<string, unknown>
  const defs = model.template.options ?? []
  const issues: Issue[] = []
  for (const [id, value] of Object.entries(values)) {
    const def = defs.find(option => option.id === id)
    if (!def) {
      issues.push({ path: `options.${id}`, message: 'opção inexistente' })
      continue
    }
    if (def.type === 'boolean' && typeof value !== 'boolean')
      issues.push({ path: `options.${id}`, message: 'use verdadeiro ou falso' })
    if (
      def.type === 'enum' &&
      (typeof value !== 'string' || !def.values.some(item => item.id === value))
    )
      issues.push({ path: `options.${id}`, message: 'valor fora do catálogo' })
    if (
      def.type === 'integer' &&
      (!Number.isSafeInteger(value) ||
        (value as number) < def.min ||
        (value as number) > def.max)
    )
      issues.push({ path: `options.${id}`, message: 'inteiro fora da faixa' })
  }
  return issues
}

export function effectiveChronicleOptions(
  model: SheetModel,
  input: unknown
): ChronicleOptionValues {
  const source =
    input && typeof input === 'object' && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {}
  return Object.fromEntries(
    (model.template.options ?? []).map(def => [
      def.id,
      Object.hasOwn(source, def.id) ? source[def.id] : def.default,
    ])
  ) as ChronicleOptionValues
}
