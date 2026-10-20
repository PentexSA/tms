import type { ClockField, ClockValue } from '../contract'
import type { ClockRule } from '../registry'
import { MINUS } from '../text'

// Regras de `clock` (contrato §3), resolvidas pelo nome do template. Como o
// wod-stacking, são a conveniência do cliente: o servidor valida a forma e a
// soma das casas (validateSheet), não a regra.

export interface ClockChange {
  readonly counts: Readonly<Record<string, number>>
  // false: a roda não mudou (sem casa livre, nada a tirar, regra bloqueou).
  readonly changed: boolean
  // Texto do aviso, sem o estado final ("+1 Paradoxo").
  readonly note: string
}

export interface ClockRuleImpl {
  gain(field: ClockField, counts: Record<string, number>, fill: string): void
}

const normalize = (field: ClockField, value: ClockValue | undefined) =>
  Object.fromEntries(
    field.fills.map(f => {
      const n = value?.[f.id]
      return [f.id, typeof n === 'number' && n > 0 ? Math.floor(n) : 0]
    })
  ) as Record<string, number>

const used = (counts: Record<string, number>) =>
  Object.values(counts).reduce((s, n) => s + n, 0)

const fillLabel = (field: ClockField, id: string) =>
  field.fills.find(f => f.id === id)?.label ?? id

// mage-quint-paradox: Quintessência (início) e Paradoxo (fim) dividem as casas.
// Com a roda cheia, o Paradoxo novo toma a casa de uma Quintessência; a
// Quintessência nova não entra.
const mageQuintParadox: ClockRuleImpl = {
  gain(field, counts, fill) {
    const start = field.fills.find(f => f.from === 'start')?.id
    const end = field.fills.find(f => f.from === 'end')?.id
    if (used(counts) < field.segments) {
      counts[fill] = (counts[fill] ?? 0) + 1
      return
    }
    if (fill === end && start && (counts[start] ?? 0) > 0) {
      counts[start] = (counts[start] ?? 0) - 1
      counts[fill] = (counts[fill] ?? 0) + 1
    }
  },
}

export const CLOCK_RULES = {
  'mage-quint-paradox': mageQuintParadox,
} satisfies Record<ClockRule, ClockRuleImpl>

export const isImplementedClockRule = (rule: unknown): rule is ClockRule =>
  typeof rule === 'string' && Object.hasOwn(CLOCK_RULES, rule)

function apply(
  field: ClockField,
  value: ClockValue | undefined,
  fill: string,
  n: number,
  lose: boolean
): ClockChange {
  const before = normalize(field, value)
  if (!Object.hasOwn(before, fill) || !Number.isInteger(n) || n < 1)
    return { counts: before, changed: false, note: 'preenchimento inexistente' }
  if (!isImplementedClockRule(field.rule))
    return { counts: before, changed: false, note: 'regra indisponível' }
  const rule = CLOCK_RULES[field.rule]
  const counts = { ...before }
  for (let i = 0; i < Math.min(n, field.segments); i++) {
    if (lose) counts[fill] = Math.max(0, (counts[fill] ?? 0) - 1)
    else rule.gain(field, counts, fill)
  }
  const label = fillLabel(field, fill)
  const delta = (counts[fill] ?? 0) - (before[fill] ?? 0)
  if (delta === 0)
    return {
      counts,
      changed: false,
      note: lose
        ? `Nada a tirar: sem ${label}`
        : used(counts) >= field.segments &&
            field.fills.every(f => f.id === fill || (counts[f.id] ?? 0) === 0)
          ? `Todas as casas já são de ${label}`
          : `Sem casa livre: ${label} não entra`,
    }
  if (lose) return { counts, changed: true, note: `${MINUS}${-delta} ${label}` }
  const taken = field.fills.find(
    f => f.id !== fill && (counts[f.id] ?? 0) < (before[f.id] ?? 0)
  )
  const note = taken
    ? `Sem casa livre: ${(before[taken.id] ?? 0) - (counts[taken.id] ?? 0)} ${taken.label} virou ${label}`
    : `+${delta} ${label}`
  return {
    counts,
    changed: true,
    note: delta < n ? `${note} (sem casa livre para o resto)` : note,
  }
}

export const gain = (
  field: ClockField,
  value: ClockValue | undefined,
  fill: string,
  n = 1
): ClockChange => apply(field, value, fill, n, false)

export const lose = (
  field: ClockField,
  value: ClockValue | undefined,
  fill: string,
  n = 1
): ClockChange => apply(field, value, fill, n, true)
