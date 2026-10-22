import type { CompiledField, SheetModel } from './compile'
import type { FieldId, SheetData } from './contract'
import { type ActionPlan, planDamage } from './effects'
import { jsonEqual } from './equal'
import { parsePath, type SheetEvent } from './events'
import { describeEvent, withEffectiveFrom } from './labels'
import { resolve } from './resolve'
import { gain, takeDamage } from './rules/resource'

// Operações em grupo do narrador (doc/painel-narrador.md §5.4; doc/plano-v3.md,
// Etapa 10): o dano ou a cura de cada ficha e a reversão de um lote, como
// funções puras. O servidor aplica tudo numa transação; o app mostra a prévia.

export type GroupDamageKind = 'damage' | 'heal'

export interface GroupDamage {
  readonly kind: GroupDamageKind
  readonly amount: number
  // O tipo de dano da trilha (letal, contusivo); o recurso não tem tipo
  readonly type?: string
  // Com mais de um alvo na ficha, qual
  readonly field?: FieldId
}

/**
 * Os campos que levam dano em grupo, pelo tipo e nunca pelo sistema (§7,
 * decisão 10): a trilha `wod-stacking` (a Vitalidade) e o recurso com ação
 * padrão `damage1` (o PV do D&D). Na ordem do template.
 */
export function damageTargets(model: SheetModel): CompiledField[] {
  return [...model.fields.values()].filter(f => {
    const d = f.def
    if (d.type === 'track') return d.rule === 'wod-stacking'
    return d.type === 'resource' && d.defaultAction === 'damage1'
  })
}

const unavailable = (reason: string): ActionPlan => ({ ok: false, reason })

/** O lote de uma ficha numa operação de dano ou cura, com a prévia. */
export function planGroupDamage(
  model: SheetModel,
  sheet: SheetData,
  op: GroupDamage
): ActionPlan {
  const targets = damageTargets(model)
  if (!Number.isInteger(op.amount) || op.amount < 1 || op.amount > 50)
    return unavailable('Quantidade inválida')
  const target = op.field
    ? targets.find(f => f.id === op.field)
    : targets.length === 1
      ? targets[0]
      : undefined
  if (!target)
    return unavailable(
      targets.length ? 'Escolha onde aplicar' : 'Esta ficha não leva dano'
    )
  const def = target.def
  if (def.type === 'track') {
    const type = op.type ?? def.types?.[0]?.id
    if (!type || !def.types?.some(t => t.id === type))
      return unavailable('Tipo de dano inválido')
    return planDamage(
      model,
      sheet,
      target.id,
      type,
      op.kind === 'damage' ? op.amount : -op.amount
    )
  }
  const r = resolve(model, sheet).get(target.id)
  if (r?.type !== 'resource') return unavailable('Esta ficha não leva dano')
  const to =
    op.kind === 'damage' ? takeDamage(r, op.amount) : gain(r, op.amount)
  const from = Object.hasOwn(sheet.values, target.id)
    ? sheet.values[target.id]
    : null
  const events: SheetEvent[] = [{ path: `values.${target.id}`, from, to }]
  const [shown] = withEffectiveFrom(model, sheet, events)
  if (shown && jsonEqual(shown.from, to))
    return unavailable(
      op.kind === 'damage'
        ? `${def.label} já está em 0`
        : `${def.label} já está no máximo`
    )
  const label = def.shortLabel ?? def.label
  return {
    ok: true,
    events,
    preview: shown ? [describeEvent(model, shown)] : [],
    label:
      op.kind === 'damage'
        ? `${op.amount} de dano em ${label}`
        : `Recuperou ${op.amount} de ${label}`,
  }
}

/** Um evento do histórico: o `from` efetivo e se o caminho estava vazio. */
export interface HistoryEvent extends SheetEvent {
  // O caminho não tinha valor guardado antes do lote (§7, decisão 3)
  readonly fromAbsent?: boolean
}

// Texto, texto longo e especialização entram no histórico sem conteúdo: não
// há o que devolver
const CONTENT_FREE = new Set(['text', 'longText'])

const contentFree = (model: SheetModel, path: string): boolean => {
  const p = parsePath(path)
  if (!p) return true
  if (p.scope === 'specialties') return true
  const type = model.fields.get(p.fieldId)?.def.type
  return type === undefined || CONTENT_FREE.has(type)
}

/** Se o lote pode ser desfeito: nenhum evento sem conteúdo no histórico. */
export const isReversible = (
  model: SheetModel,
  events: readonly SheetEvent[]
): boolean => events.length > 0 && !events.some(e => contentFree(model, e.path))

export type InvertResult =
  | { readonly ok: true; readonly events: readonly SheetEvent[] }
  | {
      readonly ok: false
      // `irreversible`: o lote tem evento sem conteúdo; `conflict`: algum
      // caminho mudou depois do lote
      readonly kind: 'irreversible' | 'conflict'
      readonly paths: readonly string[]
    }

const raw = (sheet: SheetData, path: string): unknown => {
  const p = parsePath(path)
  if (!p) return null
  const bucket: Readonly<Record<string, unknown>> =
    (p.scope === 'values' ? sheet.values : sheet.specialties) ?? {}
  return Object.hasOwn(bucket, p.fieldId) ? bucket[p.fieldId] : null
}

/**
 * Os eventos que desfazem um lote do histórico sobre a ficha de agora. Tudo
 * ou nada: um evento sem conteúdo recusa o lote; um caminho cujo valor não é
 * mais o `to` do lote recusa com os caminhos em conflito. O caminho que
 * estava vazio volta a ficar vazio, e um padrão derivado volta a acompanhar a
 * fonte.
 */
export function invertBatch(
  model: SheetModel,
  sheet: SheetData,
  events: readonly HistoryEvent[]
): InvertResult {
  const blocked = events.filter(e => contentFree(model, e.path))
  if (!events.length || blocked.length)
    return {
      ok: false,
      kind: 'irreversible',
      paths: blocked.map(e => e.path),
    }
  const conflicts = events
    .filter(e => !jsonEqual(raw(sheet, e.path), e.to ?? null))
    .map(e => e.path)
  if (conflicts.length) return { ok: false, kind: 'conflict', paths: conflicts }
  return {
    ok: true,
    events: [...events].reverse().map(e => ({
      path: e.path,
      from: raw(sheet, e.path),
      to: e.fromAbsent ? null : (e.from ?? null),
    })),
  }
}
