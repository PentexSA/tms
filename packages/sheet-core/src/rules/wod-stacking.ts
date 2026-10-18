import type { StackingValue, TrackField } from '../contract'
import { plural } from '../text'

// Regra `wod-stacking` (Vitalidade do WoD), contrato §3. Os tipos vêm do mais
// grave para o menos grave. O dano novo ocupa a próxima caixa; com a trilha
// cheia, substitui uma caixa menos grave do que ele, e o contusivo excedente
// conta como letal. Nunca cria dano mais grave que o recebido. Curar remove
// do tipo escolhido.

export interface StackingChange {
  readonly counts: Readonly<Record<string, number>>
  // false: a trilha não mudou (cheia de dano igual ou mais grave, ou nada a curar).
  readonly changed: boolean
  // Texto do aviso, sem o estado final ("+1 nível letal").
  readonly note: string
}

const normalize = (field: TrackField, value: StackingValue | undefined) =>
  Object.fromEntries(
    (field.types ?? []).map(t => {
      const n = value?.[t.id]
      return [t.id, typeof n === 'number' && n > 0 ? Math.floor(n) : 0]
    })
  ) as Record<string, number>

const typeLabel = (field: TrackField, id: string) =>
  (field.types ?? []).find(t => t.id === id)?.label.toLowerCase() ?? id

function step(
  field: TrackField,
  counts: Record<string, number>,
  type: string,
  heal: boolean
) {
  const order = (field.types ?? []).map(t => t.id)
  const levels = field.levels?.length ?? 0
  if (heal) {
    counts[type] = Math.max(0, (counts[type] ?? 0) - 1)
    return
  }
  const total = order.reduce((s, k) => s + (counts[k] ?? 0), 0)
  if (total < levels) {
    counts[type] = (counts[type] ?? 0) + 1
    return
  }
  // Trilha cheia: o dano vale pelo menos como o penúltimo tipo (contusivo → letal)
  // e troca a caixa menos grave que houver abaixo dele.
  const sev = Math.max(0, Math.min(order.indexOf(type), order.length - 2))
  let k = order.length - 1
  while (k > sev && (counts[order[k] as string] ?? 0) === 0) k--
  if (k > sev) {
    const from = order[k] as string
    const to = order[sev] as string
    counts[from] = (counts[from] ?? 0) - 1
    counts[to] = (counts[to] ?? 0) + 1
  }
}

function apply(
  field: TrackField,
  value: StackingValue | undefined,
  type: string,
  n: number,
  heal: boolean
): StackingChange {
  const before = normalize(field, value)
  if (!Object.hasOwn(before, type) || !Number.isInteger(n) || n < 1)
    return { counts: before, changed: false, note: 'tipo de dano inexistente' }
  const counts = { ...before }
  const limit = Math.min(n, field.levels?.length ?? 0)
  for (let i = 0; i < limit; i++) step(field, counts, type, heal)
  const changed = Object.keys(before).some(k => counts[k] !== before[k])
  const label = typeLabel(field, type)
  if (!changed)
    return {
      counts,
      changed,
      note: heal
        ? `Nada a curar: sem dano ${label}`
        : `${field.label} cheia: ${label} não muda a trilha`,
    }
  if (heal) {
    const healed = (before[type] ?? 0) - (counts[type] ?? 0)
    return {
      counts,
      changed,
      note: `Curou ${plural(healed, 'nível', 'níveis')} ${label}`,
    }
  }
  const added = (counts[type] ?? 0) - (before[type] ?? 0)
  const grown = Object.keys(counts).find(
    k => k !== type && (counts[k] ?? 0) > (before[k] ?? 0)
  )
  return {
    counts,
    changed,
    note:
      added < limit && grown
        ? `Trilha cheia: ${label} a mais virou ${typeLabel(field, grown)}`
        : `+${plural(added, 'nível', 'níveis')} ${label}`,
  }
}

export const damage = (
  field: TrackField,
  value: StackingValue | undefined,
  type: string,
  n = 1
): StackingChange => apply(field, value, type, n, false)

export const heal = (
  field: TrackField,
  value: StackingValue | undefined,
  type: string,
  n = 1
): StackingChange => apply(field, value, type, n, true)
