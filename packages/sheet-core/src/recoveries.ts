import type { SheetModel } from './compile'
import type { SheetData } from './contract'
import { type ActionPlan, IMPLEMENTED_EFFECTS, planAction } from './effects'
import { jsonEqual } from './equal'
import { applyBatch, type SheetEvent } from './events'
import { describeEvent, withEffectiveFrom } from './labels'
import { resolve } from './resolve'

/** Compõe os efeitos sobre uma cópia e consolida um evento por caminho.
 * Nenhuma ficha muda durante o planejamento; até efeitos posteriores leem
 * o resultado dos anteriores, incluindo padrões derivados. */
export function planRecovery(
  model: SheetModel,
  sheet: SheetData,
  recoveryId: string
): ActionPlan {
  const recovery = model.template.recoveries?.find(r => r.id === recoveryId)
  if (!recovery)
    return { ok: false, reason: 'Período inexistente neste template' }
  if (recovery.effects.some(e => !IMPLEMENTED_EFFECTS.has(e.effect)))
    return { ok: false, reason: 'Ainda não disponível nesta versão' }
  let next = sheet
  const combined = new Map<string, SheetEvent>()
  for (const effect of recovery.effects) {
    // Recurso já cheio não impede outros efeitos do mesmo período.
    const r = effect.params?.field
      ? resolve(model, next).get(effect.params.field)
      : undefined
    if (r?.type === 'resource') {
      if (
        effect.effect === 'resource.gain' &&
        r.cap !== null &&
        r.current >= r.cap
      )
        continue
      if (
        effect.effect === 'resource.restore' &&
        r.permanent !== null &&
        r.current >= r.permanent
      )
        continue
    }
    const planned = planAction(model, next, {
      ...effect,
      id: recovery.id,
      label: recovery.label,
    })
    if (!planned.ok) return planned
    const applied = applyBatch(model, next, { events: planned.events }, [
      'storyteller',
    ])
    if (!applied.ok)
      return { ok: false, reason: 'Os efeitos não produzem uma ficha válida' }
    next = applied.sheet
    for (const e of planned.events) {
      const first = combined.get(e.path)
      combined.set(e.path, { ...e, from: first ? first.from : e.from })
    }
  }
  const events = [...combined.values()].filter(e => !jsonEqual(e.from, e.to))
  if (!events.length)
    return { ok: false, reason: 'Nada a recuperar neste período' }
  return {
    ok: true,
    events,
    preview: withEffectiveFrom(model, sheet, events).map(e =>
      describeEvent(model, e)
    ),
    label: recovery.label,
  }
}
