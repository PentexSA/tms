import type { SheetModel } from './compile'
import type { FieldId, SheetData } from './contract'
import { jsonEqual } from './equal'
import { canWrite, type Roles } from './permissions'
import { type Issue, validateSheet } from './validate'
import { isId, isObj } from './validate/util'

// Toda alteração é um evento `{ path, from, to }` dentro de um lote atômico
// (doc/arquitetura §6.6, contrato §10). O mesmo applyBatch roda no aparelho
// (otimista) e no servidor (autoridade).

export interface SheetEvent {
  // `values.<campo>` ou `specialties.<campo>`; não existe caminho mais fundo.
  readonly path: string
  // Valor anterior (null quando não havia): detecta conflito.
  readonly from: unknown
  // Valor novo; null remove o valor guardado (o campo volta ao padrão).
  readonly to: unknown
}

export interface EventBatch {
  // Gerado no cliente: torna o reenvio da fila offline idempotente.
  readonly clientBatchId: string
  readonly events: readonly SheetEvent[]
}

// Iguais no app e no servidor: lote maior é recusado nos dois.
export const MAX_EVENTS_PER_BATCH = 50

export type ApplyFailure = 'invalid' | 'forbidden' | 'conflict'

export type ApplyResult =
  | { readonly ok: true; readonly sheet: SheetData }
  | {
      readonly ok: false
      readonly kind: ApplyFailure
      readonly issues: readonly Issue[]
    }

export interface ParsedPath {
  readonly scope: 'values' | 'specialties'
  readonly fieldId: FieldId
}

const PATH = /^(values|specialties)\.([^.]+)$/

export function parsePath(path: unknown): ParsedPath | null {
  if (typeof path !== 'string') return null
  const m = PATH.exec(path)
  if (!m || !isId(m[2])) return null
  return { scope: m[1] as ParsedPath['scope'], fieldId: m[2] as FieldId }
}

const current = (sheet: SheetData, p: ParsedPath): unknown => {
  const bucket: Readonly<Record<string, unknown>> =
    (p.scope === 'values' ? sheet.values : sheet.specialties) ?? {}
  return Object.hasOwn(bucket, p.fieldId) ? bucket[p.fieldId] : null
}

/**
 * Aplica um lote à ficha, tudo ou nada. Confere, nesta ordem: forma do lote e
 * dos caminhos, campo derivado, permissão de escrita, `from` igual ao valor
 * atual e, por fim, `validateSheet` da ficha resultante. Nunca lança exceção.
 */
export function applyBatch(
  model: SheetModel,
  sheet: SheetData,
  batch: { readonly events: readonly unknown[] } | unknown,
  roles: Roles
): ApplyResult {
  const invalid = (issues: Issue[]): ApplyResult => ({
    ok: false,
    kind: 'invalid',
    issues,
  })
  const events = isObj(batch) ? batch.events : undefined
  if (!Array.isArray(events) || events.length === 0)
    return invalid([{ path: '', message: 'lote sem eventos' }])
  if (events.length > MAX_EVENTS_PER_BATCH)
    return invalid([
      {
        path: '',
        message: `lote acima de ${MAX_EVENTS_PER_BATCH} eventos`,
      },
    ])

  const parsed: { event: SheetEvent; path: ParsedPath }[] = []
  const issues: Issue[] = []
  const seen = new Set<string>()
  for (const [i, raw] of events.entries()) {
    if (!isObj(raw) || !Object.hasOwn(raw, 'to')) {
      issues.push({ path: `events.${i}`, message: 'evento malformado' })
      continue
    }
    const path = parsePath(raw.path)
    if (!path) {
      issues.push({ path: `events.${i}.path`, message: 'caminho inválido' })
      continue
    }
    const field = model.fields.get(path.fieldId)
    if (!field) {
      issues.push({
        path: String(raw.path),
        message: 'campo não existe no template (rejeitado)',
      })
      continue
    }
    if (field.readOnly) {
      issues.push({
        path: String(raw.path),
        message: 'campo derivado: o servidor calcula, o cliente não grava',
      })
      continue
    }
    if (seen.has(raw.path as string)) {
      issues.push({
        path: String(raw.path),
        message: 'caminho repetido no lote',
      })
      continue
    }
    seen.add(raw.path as string)
    parsed.push({
      event: { path: raw.path as string, from: raw.from ?? null, to: raw.to },
      path,
    })
  }
  if (issues.length) return invalid(issues)

  const forbidden = parsed
    .filter(({ path }) => !canWrite(model, path.fieldId, roles))
    .map(({ event }) => ({
      path: event.path,
      message: 'sem permissão de escrita',
    }))
  if (forbidden.length)
    return { ok: false, kind: 'forbidden', issues: forbidden }

  const conflicts = parsed
    .filter(({ event, path }) => !jsonEqual(current(sheet, path), event.from))
    .map(({ event }) => ({
      path: event.path,
      message: 'o valor mudou antes deste lote (conflito)',
    }))
  if (conflicts.length)
    return { ok: false, kind: 'conflict', issues: conflicts }

  const values: Record<string, unknown> = { ...sheet.values }
  const specialties: Record<string, unknown> = { ...(sheet.specialties ?? {}) }
  for (const { event, path } of parsed) {
    const bucket = path.scope === 'values' ? values : specialties
    if (event.to === null) delete bucket[path.fieldId]
    else bucket[path.fieldId] = event.to
  }
  const next = { values, specialties } as SheetData
  const problems = validateSheet(model.template, next)
  if (problems.length) return invalid(problems)
  return { ok: true, sheet: next }
}

/** O lote que desfaz este: os eventos em ordem inversa, com from e to trocados. */
export function invert(events: readonly SheetEvent[]): SheetEvent[] {
  return [...events]
    .reverse()
    .map(e => ({ path: e.path, from: e.to, to: e.from }))
}

/**
 * Os eventos que levam `before` a `after`: o rascunho de Evoluir vira um lote
 * só. A ordem segue os campos do template; especializações vêm depois.
 */
export function diffToBatch(
  model: SheetModel,
  before: SheetData,
  after: SheetData
): SheetEvent[] {
  const events: SheetEvent[] = []
  for (const scope of ['values', 'specialties'] as const) {
    const a: Readonly<Record<string, unknown>> = before[scope] ?? {}
    const b: Readonly<Record<string, unknown>> = after[scope] ?? {}
    for (const id of model.fields.keys()) {
      const from = Object.hasOwn(a, id) ? a[id] : null
      const to = Object.hasOwn(b, id) ? b[id] : null
      if (!jsonEqual(from, to))
        events.push({
          path: `${scope}.${id}`,
          from: from ?? null,
          to: to ?? null,
        })
    }
  }
  return events
}
