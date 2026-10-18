import type { SheetModel } from './compile'
import type { FieldDef } from './contract'
import { parsePath, type SheetEvent } from './events'
import { plural } from './text'
import { asArray, get, rec } from './validate/util'

// Rótulo de uma alteração para o toast, o resumo de Evoluir e o histórico
// ("Sangue 10 → 9"). Nunca repete conteúdo escrito pelo jogador: texto livre e
// especialização aparecem só como "atualizado" (contrato §10 e §11).

export interface ChangeLabel {
  // Rótulo do campo ("Pontos de Sangue", "Força · especialização").
  readonly label: string
  // O que mudou ("10 → 9", "+1 letal", "atualizado").
  readonly change: string
}

const ARROW = '→'
const DASH = '—'

const n = (v: unknown, fallback: number | string = DASH) =>
  typeof v === 'number' ? String(v) : String(fallback)

const optionLabel = (options: unknown, id: unknown) =>
  (asArray(options)
    .map(rec)
    .find(o => o?.id === id)?.label as string) ?? DASH

function change(def: FieldDef, from: unknown, to: unknown, model: SheetModel) {
  switch (def.type) {
    case 'text':
    case 'longText':
      return 'atualizado'
    case 'rating':
    case 'number':
    case 'percent': {
      const fallback =
        def.type === 'percent' ? DASH : (def.default ?? def.min ?? 0)
      return `${n(from, fallback)} ${ARROW} ${n(to, fallback)}`
    }
    case 'resource': {
      const a = rec(from) ?? {}
      const b = rec(to) ?? {}
      if (a.permanent !== b.permanent && b.permanent !== undefined)
        return `permanente ${n(a.permanent)} ${ARROW} ${n(b.permanent)}`
      if (a.temp !== b.temp && a.current === b.current)
        return `temporários ${n(a.temp, 0)} ${ARROW} ${n(b.temp, 0)}`
      if (a.max !== b.max && a.current === b.current && b.max !== undefined)
        return `máximo ${n(a.max)} ${ARROW} ${n(b.max)}`
      return `${n(a.current)} ${ARROW} ${n(b.current)}`
    }
    case 'track': {
      if (def.rule === 'boxes') {
        const marked = (v: unknown) =>
          Object.values(rec(v) ?? {})
            .flatMap(x => asArray(x))
            .filter(x => x === true).length
        return `${marked(from)} ${ARROW} ${marked(to)} marcadas`
      }
      const count = (v: unknown) => (typeof v === 'number' ? v : 0)
      const parts = (def.types ?? []).flatMap(t => {
        const delta = count(get(to, t.id)) - count(get(from, t.id))
        return delta
          ? [
              `${delta > 0 ? '+' : '−'}${Math.abs(delta)} ${t.label.toLowerCase()}`,
            ]
          : []
      })
      return parts.join(', ') || 'sem mudança'
    }
    case 'choice':
    case 'state':
      return `${optionLabel(def.options, from)} ${ARROW} ${optionLabel(def.options, to)}`
    case 'mark': {
      const states = model.template.markStates?.[def.states]
      return `${optionLabel(states, from)} ${ARROW} ${optionLabel(states, to)}`
    }
    case 'tags':
      return `${asArray(from).length} ${ARROW} ${plural(asArray(to).length, 'marcada', 'marcadas')}`
    case 'list':
      return `${asArray(from).length} ${ARROW} ${plural(asArray(to).length, 'item', 'itens')}`
    default:
      return 'alterado'
  }
}

export function describeEvent(
  model: SheetModel,
  event: SheetEvent
): ChangeLabel {
  const path = parsePath(event.path)
  const def = path ? model.fields.get(path.fieldId)?.def : undefined
  if (!path || !def) return { label: 'Campo', change: 'alterado' }
  if (path.scope === 'specialties')
    return { label: `${def.label} · especialização`, change: 'atualizada' }
  const text = change(def, event.from, event.to, model)
  // Como no protótipo: recursos usam o rótulo curto ("Sangue 10 → 9"), menos
  // na mudança do permanente, que é rara e merece o nome por extenso.
  const short =
    def.type === 'resource' && !text.startsWith('permanente')
      ? (def.shortLabel ?? def.label)
      : def.label
  return { label: short, change: text }
}

/** Uma linha para o toast e o histórico: o evento único ou "N alterações". */
export function describeBatch(
  model: SheetModel,
  events: readonly SheetEvent[]
): string {
  const [only] = events
  if (events.length === 1 && only) {
    const { label, change } = describeEvent(model, only)
    return `${label} ${change}`
  }
  return plural(events.length, 'alteração', 'alterações')
}
