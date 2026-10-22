import type { SheetModel } from './compile'
import type {
  ClockValue,
  FieldId,
  ResourceAction,
  SheetData,
  StackingValue,
  TemplateAction,
} from './contract'
import { jsonEqual } from './equal'
import type { SheetEvent } from './events'
import { clock as clockType } from './fields/clock'
import { resource as resourceType } from './fields/resource'
import { type ChangeLabel, describeEvent, withEffectiveFrom } from './labels'
import type { EffectName } from './registry'
import {
  type ResolvedResource,
  type ResolvedStacking,
  resolve,
} from './resolve'
import { gain as clockGain, lose as clockLose } from './rules/clock'
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
  sheet: SheetData,
  events: SheetEvent[],
  label: string
): ActionPlan {
  // A prévia mostra o valor efetivo de antes ("Sangue 10 → 9" com o Sangue
  // ainda no padrão), não o `from` guardado
  const shown = withEffectiveFrom(model, sheet, events)
  return {
    ok: true,
    events,
    preview: shown.map(e => describeEvent(model, e)),
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
      return plan(
        model,
        sheet,
        [event(sheet, r.id, spend(r, amount))],
        action.label
      )
    }
    case 'resource.gain': {
      const r = resourceOf(action.params?.field)
      if (!r) return unavailable('Recurso inexistente')
      const to = gain(r, amount)
      if (to.current === r.current)
        return unavailable(`${r.field.def.label} já está no máximo`)
      return plan(model, sheet, [event(sheet, r.id, to)], action.label)
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
      if (!type) {
        if (cost > 0) return unavailable('Nada a curar com este recurso')
        // Sem custo (Regenerar): diz quais danos a ação cura
        const labels = (action.params?.types ?? []).flatMap(id => {
          const label = def.types?.find(x => x.id === id)?.label
          return label ? [label.toLowerCase()] : []
        })
        return unavailable(`Nada a curar: sem dano ${labels.join(' ou ')}`)
      }
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
      return plan(model, sheet, events, `${change.note}${by}`)
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
          sheet,
          [event(sheet, r.id, spend(r, 1))],
          `${r.field.def.spendLabel ?? 'Gastar 1'} ${label}`
        )
      case 'gain1': {
        const to = gain(r, 1)
        if (to.current === r.current)
          return unavailable(`${label} já está no máximo`)
        return plan(
          model,
          sheet,
          [event(sheet, r.id, to)],
          `${r.field.def.gainLabel ?? 'Recuperar 1'} ${label}`
        )
      }
      case 'damage1': {
        const to = takeDamage(r, 1)
        if (jsonEqual(to, resourceType.stored(r)))
          return unavailable(`${label} já está em 0`)
        return plan(
          model,
          sheet,
          [event(sheet, r.id, to)],
          `1 de dano em ${label}`
        )
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
      sheet,
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
  return plan(model, sheet, [event(sheet, fieldId, change.counts)], change.note)
}

/**
 * Um passo na roda (sheet do `clock`): + ganha e − tira do preenchimento, pela
 * regra do template. A regra pode tocar outro preenchimento (o Paradoxo que
 * consome Quintessência); o lote é um evento só, com a roda inteira.
 */
export function planClock(
  model: SheetModel,
  sheet: SheetData,
  fieldId: FieldId,
  fill: string,
  delta: number
): ActionPlan {
  const def = model.fields.get(fieldId)?.def
  if (def?.type !== 'clock' || delta === 0)
    return unavailable('Roda inexistente')
  // Sem roda gravada, parte do padrão resolvido (o `default` dos
  // preenchimentos), não de zero
  const resolved = resolve(model, sheet).get(fieldId)
  const value = (stored(sheet, fieldId) ??
    (resolved?.type === 'clock' ? clockType.stored(resolved) : null)) as
    | ClockValue
    | undefined
  const change =
    delta > 0
      ? clockGain(def, value ?? undefined, fill, delta)
      : clockLose(def, value ?? undefined, fill, -delta)
  if (!change.changed) return unavailable(change.note)
  return plan(model, sheet, [event(sheet, fieldId, change.counts)], change.note)
}

export interface StatePlanOptions {
  // Paga o `cost` opcional da troca (a mudança instantânea por 1 Fúria). Um
  // `cost` sem `optional` é sempre pago.
  readonly payCost?: boolean
}

/**
 * Troca a opção de um `state` (sheet da Forma). O lote tem a troca e, com o
 * custo, o gasto do recurso: "Forma Hominídeo → Crinos, Fúria 4 → 3". Como o
 * wod-stacking, é a conveniência do cliente: o servidor valida a forma do
 * valor, não o custo (a troca sem pagar também é legal).
 */
export function planState(
  model: SheetModel,
  sheet: SheetData,
  fieldId: FieldId,
  optionId: string,
  { payCost = false }: StatePlanOptions = {}
): ActionPlan {
  const def = model.fields.get(fieldId)?.def
  if (def?.type !== 'state') return unavailable('Estado inexistente')
  const option = def.options.find(o => o.id === optionId)
  if (!option) return unavailable('Opção inexistente')
  const resolved = resolve(model, sheet)
  const current = resolved.get(fieldId)
  if (current?.type === 'state' && current.option.id === option.id)
    return unavailable(`Já em ${option.label}`)
  const events = [event(sheet, fieldId, option.id)]
  const cost = def.cost
  if (!cost || !(payCost || !cost.optional))
    return plan(model, sheet, events, `${def.label}: ${option.label}`)
  const pay = resolved.get(cost.resource)
  if (pay?.type !== 'resource') return unavailable('Recurso inexistente')
  const r = pay as ResolvedResource
  const label = r.field.def.shortLabel ?? r.field.def.label
  if (r.current < cost.amount) return unavailable(`${label} insuficiente`)
  events.push(event(sheet, r.id, spend(r, cost.amount)))
  return plan(
    model,
    sheet,
    events,
    `${def.label}: ${option.label} (${cost.amount} ${label})`
  )
}

export interface StateEffect {
  readonly field: FieldId
  // shortLabel do campo ("For"), para caber no hint da opção.
  readonly label: string
  readonly value: number
}

export interface StatePreviewOption {
  readonly id: string
  readonly label: string
  readonly hint: string | null
  readonly note: string | null
  // Os valores efetivos dos campos que a opção modifica, nessa opção.
  readonly effects: readonly StateEffect[]
  // "For 7 · Des 4 · Vig 6 · Man 0 · Apa 0"; vazio sem modificador.
  readonly summary: string
}

/**
 * Cada opção do `state` com os valores efetivos que ela daria, a partir da
 * ficha atual: o jogador vê o que a forma faz antes de trocar.
 */
export function statePreview(
  model: SheetModel,
  sheet: SheetData,
  fieldId: FieldId
): readonly StatePreviewOption[] {
  const def = model.fields.get(fieldId)?.def
  if (def?.type !== 'state') return []
  return def.options.map(option => {
    const as = resolve(model, {
      ...sheet,
      values: { ...sheet.values, [fieldId]: option.id },
    })
    const effects = (option.modifiers ?? []).flatMap(m => {
      const r = as.get(m.field)
      if (!r || !('value' in r) || typeof r.value !== 'number') return []
      const f = r.field.def
      return [
        { field: m.field, label: f.shortLabel ?? f.label, value: r.value },
      ]
    })
    return {
      id: option.id,
      label: option.label,
      hint: option.hint ?? null,
      note: option.note ?? null,
      effects,
      summary: effects.map(e => `${e.label} ${e.value}`).join(' · '),
    }
  })
}
