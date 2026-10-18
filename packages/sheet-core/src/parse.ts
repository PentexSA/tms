import type { SheetModel } from './compile'
import type { SheetData, Template } from './contract'
import { PALETTE } from './palette'
import { type Issue, validateSheet, validateTemplate } from './validate'

// O único caminho de `unknown` (banco, rede, disco) para os tipos do contrato:
// primeiro o validador, depois o tipo. Nada é convertido nem corrigido.

export type Parsed<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issues: readonly Issue[] }

export function parseTemplate(
  json: unknown,
  palette: readonly string[] = PALETTE
): Parsed<Template> {
  const issues = validateTemplate(json, palette)
  return issues.length
    ? { ok: false, issues }
    : { ok: true, value: json as Template }
}

export function parseSheet(
  model: SheetModel,
  json: unknown
): Parsed<SheetData> {
  const issues = validateSheet(model.template, json)
  return issues.length
    ? { ok: false, issues }
    : { ok: true, value: json as SheetData }
}
