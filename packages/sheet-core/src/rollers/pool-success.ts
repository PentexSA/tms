import type { SheetModel } from '../compile'
import type {
  FieldId,
  PoolSuccessRoll,
  RollBoost,
  RollPreset,
  RollSlot,
  SheetData,
} from '../contract'
import type { SheetEvent } from '../events'
import { inactiveNote } from '../fields/rating'
import { canReadSection, canWrite, type Roles } from '../permissions'
import { type RandomSource, randomInt } from '../random'
import {
  type Modifier,
  type ResolvedResource,
  type ResolvedSheet,
  type ResolvedStacking,
  resolve,
} from '../resolve'
import { spend } from '../rules/resource'
import { fmtSigned, plural } from '../text'
import { isObj } from '../validate/util'

// Parada de dados `pool-success` (contrato §9; semântica do protótipo,
// design/telas/prototipo.js: ROLLERS['pool-success']). Os slots apontam para
// seções do template; a parada é a soma dos valores escolhidos, com a
// penalidade do campo de ferimentos, dificuldade, 1 anulando sucesso e falha
// crítica. Nada aqui conhece Vampiro: o template diz quais seções, qual dado,
// qual campo penaliza e quais recursos compram sucesso.
//
// O mesmo plano roda no app (prévia e rolagem local, sem rede) e no
// servidor, que monta a parada da ficha gravada e nunca aceita resultado do
// cliente.

export const MAX_POOL_DICE = 50
// "Rolei na mão": o total que a pessoa informa.
export const MAX_MANUAL_SUCCESSES = 50

/** Uma opção de um slot: um campo, ou um item de lista (`campo:item`). */
export interface PoolOption {
  readonly key: string
  readonly fieldId: FieldId
  readonly label: string
  readonly value: number
  readonly specialty: string | null
  // De onde vem: o título da seção ou o rótulo da lista ("Disciplinas").
  readonly group: string
  // Modificadores de estado com a origem ("Crinos +2") e o teto não
  // destrutivo ("1 inativo, máx. pelo Arete 2").
  readonly modifiers: readonly string[]
}

export interface PoolRequest {
  // slot → chave da opção (`destreza`, `disciplines:abc`).
  readonly slots: Readonly<Record<string, string>>
  readonly difficulty: number
  readonly specialty?: boolean
  readonly boosts?: readonly string[]
  // Atalho do template (roll.presets): fixa os slots que ele declara.
  readonly preset?: string
}

/** Um atalho do template, com as opções que ele fixa já resolvidas. */
export interface PoolPreset {
  readonly id: string
  readonly label: string
  readonly help: string | null
  // slot → opção fixada pelo atalho.
  readonly slots: Readonly<Record<string, PoolOption>>
  // false: algum campo do atalho não entra para este papel (seção sem leitura).
  readonly available: boolean
}

export interface PoolModifier {
  readonly label: string
  readonly change: string
}

export type PoolFailure =
  | 'unsupported'
  | 'invalid'
  | 'incomplete'
  | 'incapacitated'
  | 'cost'

export type PoolPlan =
  | {
      readonly ok: true
      // "Destreza + Esportes"; com atalho, "Conjurar efeito: Arete"
      readonly label: string
      readonly preset: string | null
      readonly chosen: readonly {
        readonly slot: string
        readonly option: PoolOption
      }[]
      readonly dice: number
      readonly die: number
      readonly difficulty: number
      readonly penalty: number
      // A especialização vale nesta rolagem (pedida e existente).
      readonly specialty: boolean
      readonly auto: number
      readonly boosts: readonly string[]
      readonly modifiers: readonly PoolModifier[]
      // O custo dos boosts (FdV): aplicado junto com a rolagem.
      readonly events: readonly SheetEvent[]
    }
  | {
      readonly ok: false
      readonly kind: PoolFailure
      readonly reason: string
    }

export type PoolOutcome = 'success' | 'failure' | 'botch'

export interface PoolResult {
  readonly faces: readonly number[]
  // Sucessos dos dados, antes dos 1.
  readonly hits: number
  readonly ones: number
  readonly auto: number
  readonly total: number
  readonly outcome: PoolOutcome
  // "3 sucessos", "Falha", "Falha crítica".
  readonly text: string
}

const fail = (kind: PoolFailure, reason: string): PoolPlan => ({
  ok: false,
  kind,
  reason,
})

export const poolRollOf = (model: SheetModel): PoolSuccessRoll | null =>
  model.roll.model === 'pool-success' ? model.roll : null

function modifierText(m: Modifier): string {
  return m.op === 'set'
    ? `${m.source}: ${m.value}`
    : `${m.source} ${fmtSigned(m.value)}`
}

// O número que a parada usa de um campo; null quando o campo não entra.
function fieldValue(r: ReturnType<ResolvedSheet['get']>): number | null {
  if (!r) return null
  switch (r.type) {
    case 'rating':
    case 'percent':
      return r.value
    case 'number':
      return r.mod ?? r.value
    case 'resource':
      return r.permanent ?? r.current
    case 'mark':
      return r.bonus
    default:
      return null
  }
}

/** As opções de um slot, das seções que o papel lê, na ordem do template. */
export function poolOptions(
  model: SheetModel,
  resolved: ResolvedSheet,
  slot: RollSlot,
  roles: Roles
): PoolOption[] {
  const out: PoolOption[] = []
  for (const sectionId of slot.from) {
    const section = model.sections.get(sectionId)
    if (!section || !canReadSection(model, sectionId, roles)) continue
    for (const id of section.fieldIds) {
      const r = resolved.get(id)
      if (!r) continue
      if (r.type === 'list') {
        for (const item of r.items) {
          if (typeof item.value !== 'number') continue
          out.push({
            key: `${id}:${item.id}`,
            fieldId: id,
            label: item.name ?? item.text ?? item.id,
            value: item.value,
            specialty: item.specialty || null,
            group: r.field.def.label,
            modifiers: [],
          })
        }
        continue
      }
      const value = fieldValue(r)
      if (value === null) continue
      out.push({
        key: id,
        fieldId: id,
        label: r.field.def.label,
        value,
        specialty: resolved.specialty(id) || null,
        group: section.def.title,
        // A Esfera acima do Arete entra pelo teto, e a opção diz por quê
        modifiers:
          r.type === 'rating'
            ? [
                ...r.modifiers.map(modifierText),
                ...(r.inactive ? [inactiveNote(r) as string] : []),
              ]
            : [],
      })
    }
  }
  return out
}

const presetOf = (roll: PoolSuccessRoll, id: unknown): RollPreset | null =>
  (typeof id === 'string' && roll.presets?.find(p => p.id === id)) || null

/** Os atalhos do template, na ordem dele, com as opções que cada um fixa. */
export function poolPresets(
  model: SheetModel,
  resolved: ResolvedSheet,
  roles: Roles
): PoolPreset[] {
  const roll = poolRollOf(model)
  if (!roll) return []
  return (roll.presets ?? []).map(preset => {
    const slots: Record<string, PoolOption> = {}
    let available = true
    for (const slot of roll.slots) {
      if (!Object.hasOwn(preset.slots, slot.id)) continue
      const key = preset.slots[slot.id]
      const option = poolOptions(model, resolved, slot, roles).find(
        o => o.key === key
      )
      if (option) slots[slot.id] = option
      else available = false
    }
    return {
      id: preset.id,
      label: preset.label,
      help: preset.help ?? null,
      slots,
      available,
    }
  })
}

/**
 * Planeja a rolagem a partir da ficha: a parada, os modificadores e o custo.
 * O pedido é input hostil (vem da rede ou do disco): só ids de slot,
 * chaves de opção, dificuldade, especialização e boosts.
 */
export function planPool(
  model: SheetModel,
  sheet: SheetData,
  request: unknown,
  roles: Roles
): PoolPlan {
  const roll = poolRollOf(model)
  if (!roll) return fail('unsupported', 'este sistema não usa parada de dados')
  if (!isObj(request) || !isObj(request.slots))
    return fail('invalid', 'pedido de rolagem malformado')
  const known = new Set(roll.slots.map(s => s.id))
  if (Object.keys(request.slots).some(k => !known.has(k)))
    return fail('invalid', 'slot desconhecido')
  // O atalho fixa os slots que declara; o que vier no pedido para eles é
  // ignorado, e os demais continuam escolhíveis
  const hasPreset = request.preset !== undefined && request.preset !== null
  const preset = hasPreset ? presetOf(roll, request.preset) : null
  if (hasPreset && !preset) return fail('invalid', 'atalho desconhecido')
  const slotsIn: Record<string, unknown> = {
    ...(request.slots as Record<string, unknown>),
    ...preset?.slots,
  }

  const die = roll.die ?? 10
  const difficulty = request.difficulty
  const { min, max } = roll.difficulty
  if (
    typeof difficulty !== 'number' ||
    !Number.isInteger(difficulty) ||
    difficulty < min ||
    difficulty > Math.min(max, die)
  )
    return fail('invalid', `dificuldade de ${min} a ${Math.min(max, die)}`)

  const resolved = resolve(model, sheet)
  const chosen: { slot: string; option: PoolOption }[] = []
  for (const slot of roll.slots) {
    const key = slotsIn[slot.id]
    if (key === undefined || key === null || key === '') {
      if (slot.optional) continue
      return fail('incomplete', `escolha ${slot.label.toLowerCase()}`)
    }
    if (typeof key !== 'string') return fail('invalid', 'opção inválida')
    const option = poolOptions(model, resolved, slot, roles).find(
      o => o.key === key
    )
    if (!option) return fail('invalid', `opção inválida para ${slot.label}`)
    chosen.push({ slot: slot.id, option })
  }
  if (!chosen.length) return fail('incomplete', 'escolha o que rolar')

  const modifiers: PoolModifier[] = chosen.flatMap(({ option }) =>
    option.modifiers.map(change => ({ label: option.label, change }))
  )
  let penalty = 0
  if (roll.penalty) {
    const track = resolved.get(roll.penalty.field)
    if (track?.type === 'track' && track.rule === 'wod-stacking') {
      const t = track as ResolvedStacking
      if (t.incapacitated)
        return fail('incapacitated', 'incapacitado: não pode rolar')
      if (t.penalty) {
        penalty = t.penalty
        modifiers.push({
          label: `Ferimento (${t.level?.label ?? t.field.def.label})`,
          change: `${fmtSigned(penalty)} ${Math.abs(penalty) === 1 ? 'dado' : 'dados'}`,
        })
      }
    }
  }

  const specialty =
    request.specialty === true &&
    roll.specialty === 'tenCountsDouble' &&
    chosen.some(c => c.option.specialty)
  if (specialty)
    modifiers.push({ label: 'Especialização', change: '10 conta 2 sucessos' })

  const boostIds = request.boosts ?? []
  if (!Array.isArray(boostIds) || boostIds.some(b => typeof b !== 'string'))
    return fail('invalid', 'boost inválido')
  const unique = [...new Set(boostIds as string[])]
  const boosts: RollBoost[] = []
  for (const id of unique) {
    const boost = roll.boosts?.find(b => b.id === id)
    if (!boost) return fail('invalid', 'boost desconhecido')
    if (boost.effect !== 'autoSuccess')
      return fail('invalid', 'efeito de boost que esta parada não usa')
    boosts.push(boost)
  }

  // O custo sai do recurso, como um gasto qualquer (o mesmo spend do core)
  const events: SheetEvent[] = []
  let working = resolved
  let current = sheet
  for (const boost of boosts) {
    const r = working.get(boost.resource)
    if (r?.type !== 'resource')
      return fail('invalid', 'recurso do boost não existe')
    const res = r as ResolvedResource
    if (!canWrite(model, boost.resource, roles))
      return fail('cost', `sem permissão para gastar ${res.field.def.label}`)
    if (res.current < boost.cost)
      return fail('cost', `${res.field.def.label} insuficiente`)
    const to = spend(res, boost.cost)
    const from = Object.hasOwn(current.values, boost.resource)
      ? current.values[boost.resource]
      : null
    const existing = events.findIndex(
      e => e.path === `values.${boost.resource}`
    )
    if (existing >= 0) {
      const prev = events[existing] as SheetEvent
      events[existing] = { path: prev.path, from: prev.from, to }
    } else
      events.push({ path: `values.${boost.resource}`, from: from ?? null, to })
    current = {
      ...current,
      values: { ...current.values, [boost.resource]: to },
    }
    working = resolve(model, current)
    modifiers.push({
      label: res.field.def.label,
      change: `+1 sucesso automático (gasta ${boost.cost})`,
    })
  }

  const base = chosen.reduce((s, c) => s + c.option.value, 0)
  const dice = Math.min(MAX_POOL_DICE, Math.max(0, base + penalty))
  const pool = chosen.map(c => c.option.label).join(' + ')
  return {
    ok: true,
    label: preset ? `${preset.label}: ${pool}` : pool,
    preset: preset?.id ?? null,
    chosen,
    dice,
    die,
    difficulty,
    penalty,
    specialty,
    auto: boosts.length,
    boosts: boosts.map(b => b.id),
    modifiers,
    events,
  }
}

/** Conta os dados já rolados (puro: o mesmo para rolagem do app, servidor e teste). */
export function scorePool(
  faces: readonly number[],
  params: {
    readonly difficulty: number
    readonly specialty: boolean
    readonly auto: number
    readonly die?: number
  }
): PoolResult {
  const die = params.die ?? 10
  const hits =
    faces.filter(x => x >= params.difficulty).length +
    (params.specialty ? faces.filter(x => x === die).length : 0)
  const ones = faces.filter(x => x === 1).length
  const total = Math.max(0, hits - ones) + params.auto
  // Falha crítica: nenhum sucesso nos dados, algum 1 e nada automático
  const outcome: PoolOutcome =
    total > 0
      ? 'success'
      : hits === 0 && ones > 0 && params.auto === 0
        ? 'botch'
        : 'failure'
  return {
    faces: [...faces],
    hits,
    ones,
    auto: params.auto,
    total,
    outcome,
    text: outcomeText(outcome, total),
  }
}

export const outcomeText = (outcome: PoolOutcome, total: number): string =>
  outcome === 'success'
    ? plural(total, 'sucesso', 'sucessos')
    : outcome === 'botch'
      ? 'Falha crítica'
      : 'Falha'

/** Rola a parada planejada com a fonte dada (CSPRNG no app e no servidor). */
export function rollPool(
  plan: Extract<PoolPlan, { ok: true }>,
  rng: RandomSource
): PoolResult {
  const faces = Array.from({ length: plan.dice }, () =>
    randomInt(rng, 1, plan.die)
  )
  return scorePool(faces, plan)
}

/**
 * "Rolei na mão": os sucessos dos dados (já descontados os 1) que a pessoa
 * informa, mais os automáticos dos boosts. Fica marcado como manual.
 */
export function manualResult(
  successes: number,
  botch = false,
  auto = 0
): PoolResult | null {
  if (
    !Number.isInteger(successes) ||
    successes < 0 ||
    successes > MAX_MANUAL_SUCCESSES ||
    (botch && successes > 0)
  )
    return null
  const total = successes + Math.max(0, auto)
  const outcome: PoolOutcome =
    total > 0 ? 'success' : botch ? 'botch' : 'failure'
  return {
    faces: [],
    hits: successes,
    ones: 0,
    auto: Math.max(0, auto),
    total,
    outcome,
    text: outcomeText(outcome, total),
  }
}

/** A frase do leitor de tela: resultado e, se houver, os dados. */
export function describePool(result: PoolResult): string {
  return result.faces.length
    ? `${result.text}. Dados: ${result.faces.join(', ')}.`
    : `${result.text}.`
}
