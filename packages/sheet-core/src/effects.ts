import type { SheetModel } from './compile'
import type {
  FieldId,
  ResourceAction,
  SheetData,
  StackingValue,
  TemplateAction,
} from './contract'
import { jsonEqual } from './equal'
import type { SheetEvent } from './events'
import { resource as resourceType } from './fields/resource'
import { type ChangeLabel, describeEvent } from './labels'
import type { EffectName } from './registry'
import {
  type ResolvedResource,
  type ResolvedStacking,
  resolve,
} from './resolve'
import { gain, spend, takeDamage } from './rules/resource'
import { damage, heal } from './rules/wod-stacking'

// Ações do template (contrato §8): menu ⋯ da ficha e sheet de um recurso. O
// app sempre mostra a prévia (campo: de → para) antes de aplicar; aplicar é um
// lote atômico. Efeito da lista fechada sem implementação nesta versão fica
// indisponível, e a UI esconde a ação (doc/arquitetura §10.1).

export type ActionPlan =
  | {
      readonly ok: true
      readonly events: readonly SheetEvent[]
      readonly preview: readonly ChangeLabel[]
      // Rótulo para o toast ("Curou 1 nível letal").
      readonly label: string
    }
  | { readonly ok: false; readonly reason: string }

const unavailable = (reason: string): ActionPlan => ({ ok: false, reason })

/**
 * Efeitos que o planAction sabe aplicar nesta versão. A UI esconde as ações
 * com outro efeito, em vez de mostrar um botão que nunca funciona.
 */
export const IMPLEMENTED_EFFECTS: ReadonlySet<EffectName> = new Set<EffectName>(
  ['resource.spend', 'resource.gain', 'health.heal']
)

const stored = (sheet: SheetData, id: FieldId): unknown =>
  Object.hasOwn(sheet.values, id) ? sheet.values[id] : null

const event = (sheet: SheetData, id: FieldId, to: unknown): SheetEvent => ({
  path: `values.${id}`,
  from: stored(sheet, id),
  to,
})

function plan(
  model: SheetModel,
  events: SheetEvent[],
  label: string
): ActionPlan {
  return {
    ok: true,
    events,
    preview: events.map(e => describeEvent(model, e)),
    label,
  }
}

/**
 * Planeja uma ação: os eventos e a prévia, sem aplicar nada. `payer` é o
 * resource dono da ação (ações de `fields.<id>.actions`, que cobram `cost`).
 */
export function planAction(
  model: SheetModel,
  sheet: SheetData,
  action: ResourceAction | TemplateAction,
  payer?: FieldId
): ActionPlan {
  const resolved = resolve(model, sheet)
  const resourceOf = (id: FieldId | undefined) => {
    const r = id ? resolved.get(id) : undefined
    return r?.type === 'resource' ? (r as ResolvedResource) : undefined
  }
  const cost = 'cost' in action ? (action.cost ?? 0) : 0
  const amount = action.params?.amount ?? 1

  switch (action.effect) {
    case 'resource.spend': {
      const r = resourceOf(action.params?.field)
      if (!r) return unavailable('Recurso inexistente')
      if (r.current === 0)
        return unavailable(`Sem ${r.field.def.label.toLowerCase()} para gastar`)
      return plan(model, [event(sheet, r.id, spend(r, amount))], action.label)
    }
    case 'resource.gain': {
      const r = resourceOf(action.params?.field)
      if (!r) return unavailable('Recurso inexistente')
      const to = gain(r, amount)
      if (to.current === r.current)
        return unavailable(`${r.field.def.label} já está no máximo`)
      return plan(model, [event(sheet, r.id, to)], action.label)
    }
    case 'health.heal': {
      const trackId = action.params?.field
      const track = trackId ? resolved.get(trackId) : undefined
      if (track?.type !== 'track' || track.rule !== 'wod-stacking')
        return unavailable('Trilha inexistente')
      const t = track as ResolvedStacking
      const def = t.field.def
      // Do último para o primeiro tipo de `types`: ["bashing", "lethal"] cura
      // letal antes de contusivo, e o agravado fica de fora.
      const type = [...(action.params?.types ?? [])]
        .reverse()
        .find(id => (t.counts[id] ?? 0) > 0)
      if (!type) return unavailable('Nada a curar com este recurso')
      const events: SheetEvent[] = []
      const change = heal(def, stored(sheet, t.id) as StackingValue, type, 1)
      events.push(event(sheet, t.id, change.counts))
      const pay = resourceOf(payer)
      if (cost > 0) {
        if (!pay) return unavailable('Recurso inexistente')
        if (pay.current < cost)
          return unavailable(
            `${pay.field.def.shortLabel ?? pay.field.def.label} insuficiente`
          )
        events.push(event(sheet, pay.id, spend(pay, cost)))
      }
      const by =
        cost > 0 && pay
          ? ` (${cost} ${pay.field.def.shortLabel ?? pay.field.def.label})`
          : ''
      return plan(model, events, `${change.note}${by}`)
    }
    default:
      return unavailable('Ainda não disponível nesta versão')
  }
}

/**
 * A ação padrão do campo no dock (toque longo): `spend1`, `gain1`, `damage1`
 * em resource e `use1` em slots. Sem ação padrão, indisponível.
 */
export function planDefaultAction(
  model: SheetModel,
  sheet: SheetData,
  fieldId: FieldId
): ActionPlan {
  const resolved = resolve(model, sheet)
  const r = resolved.get(fieldId)
  if (!r) return unavailable('Campo inexistente')
  if (r.type === 'resource') {
    const label = r.field.def.shortLabel ?? r.field.def.label
    switch (r.field.def.defaultAction) {
      case 'spend1':
        if (r.current === 0) return unavailable(`Sem ${label} para gastar`)
        return plan(
          model,
          [event(sheet, r.id, spend(r, 1))],
          `${r.field.def.spendLabel ?? 'Gastar 1'} ${label}`
        )
      case 'gain1': {
        const to = gain(r, 1)
        if (to.current === r.current)
          return unavailable(`${label} já está no máximo`)
        return plan(
          model,
          [event(sheet, r.id, to)],
          `${r.field.def.gainLabel ?? 'Recuperar 1'} ${label}`
        )
      }
      case 'damage1': {
        const to = takeDamage(r, 1)
        if (jsonEqual(to, resourceType.stored(r)))
          return unavailable(`${label} já está em 0`)
        return plan(model, [event(sheet, r.id, to)], `1 de dano em ${label}`)
      }
      default:
        return unavailable('Sem ação padrão')
    }
  }
  if (r.type === 'slots' && r.field.def.defaultAction === 'use1') {
    const level = r.levels.find(l => l.used < l.max)
    if (!level) return unavailable('Nenhum espaço livre')
    const to = Object.fromEntries(
      r.levels.map(l => [
        String(l.n),
        { max: l.max, used: l.n === level.n ? l.used + 1 : l.used },
      ])
    )
    return plan(
      model,
      [event(sheet, r.id, to)],
      `Usou 1 espaço de ${level.label} nível`
    )
  }
  return unavailable('Sem ação padrão')
}

/** Evento de dano ou cura numa trilha `wod-stacking`, com o aviso da regra. */
export function planDamage(
  model: SheetModel,
  sheet: SheetData,
  fieldId: FieldId,
  type: string,
  delta: number
): ActionPlan {
  const def = model.fields.get(fieldId)?.def
  if (def?.type !== 'track' || def.rule !== 'wod-stacking' || delta === 0)
    return unavailable('Trilha inexistente')
  const value = stored(sheet, fieldId) as StackingValue | undefined
  const change =
    delta > 0
      ? damage(def, value ?? undefined, type, delta)
      : heal(def, value ?? undefined, type, -delta)
  if (!change.changed) return unavailable(change.note)
  return plan(model, [event(sheet, fieldId, change.counts)], change.note)
}
