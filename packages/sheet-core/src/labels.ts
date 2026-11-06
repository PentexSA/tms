import type { SheetModel } from './compile'
import type { ClockField, FieldDef, SheetData } from './contract'
import { parsePath, type SheetEvent } from './events'
import { stored } from './fields'
import { inactiveNote } from './fields/rating'
import { type ResolvedRating, resolve } from './resolve'
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

// Os preenchimentos que mudaram, na ordem do template.
function clockChanges(def: ClockField, from: unknown, to: unknown) {
  const count = (v: unknown, id: string) => {
    const x = get(v, id)
    return typeof x === 'number' ? x : 0
  }
  return def.fills
    .map(f => ({
      label: f.label,
      from: count(from, f.id),
      to: count(to, f.id),
    }))
    .filter(c => c.from !== c.to)
}

function change(def: FieldDef, from: unknown, to: unknown, model: SheetModel) {
  switch (def.type) {
    case 'text':
    case 'longText':
      return 'atualizado'
    case 'rating':
    case 'number':
    case 'percent': {
      // Um `default` com fórmula não tem número fixo: sem valor, vale o mínimo
      const fallback =
        def.type === 'percent'
          ? DASH
          : typeof def.default === 'number'
            ? def.default
            : (def.min ?? 0)
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
    case 'clock':
      return (
        clockChanges(def, from, to)
          .map(c => `${c.label} ${c.from} ${ARROW} ${c.to}`)
          .join(', ') || 'sem mudança'
      )
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
  // Na roda, um preenchimento só leva o nome dele ("Paradoxo 2 → 3")
  if (def.type === 'clock') {
    const changes = clockChanges(def, event.from, event.to)
    const [only] = changes
    if (only && changes.length === 1)
      return { label: only.label, change: `${only.from} ${ARROW} ${only.to}` }
  }
  const text = change(def, event.from, event.to, model)
  // Como no protótipo: recursos usam o rótulo curto ("Sangue 10 → 9"), menos
  // na mudança do permanente, que é rara e merece o nome por extenso.
  const short =
    def.type === 'resource' && !text.startsWith('permanente')
      ? (def.shortLabel ?? def.label)
      : def.label
  return { label: short, change: text }
}

const NO_EFFECTIVE = new Set(['text', 'longText'])

/**
 * Os eventos com o `from` que a pessoa via: sem valor guardado, o valor
 * efetivo da ficha de antes (o padrão, um máximo derivado). Assim o aviso e o
 * histórico dizem "Sangue 10 → 9", não "— → 9". Só para mostrar: o conflito
 * compara o `from` cru, que continua null.
 */
export function withEffectiveFrom(
  model: SheetModel,
  before: SheetData,
  events: readonly SheetEvent[]
): SheetEvent[] {
  const effective = effectiveOf(model, before)
  return events.map(e => {
    if (e.from !== null && e.from !== undefined) return e
    const from = effective(e.path)
    return from === undefined ? e : { ...e, from }
  })
}

/**
 * O mesmo para o "para" (T-53): o evento que esvazia o caminho (o desfazer de
 * um gasto a partir do padrão) diz o valor efetivo da ficha **depois** do
 * lote. Assim o histórico do desfazer diz "Sangue 9 → 10", não "9 → —". Só
 * para mostrar: quem desfaz de novo compara o cru (`invertBatch`).
 */
export function withEffectiveTo(
  model: SheetModel,
  after: SheetData,
  events: readonly SheetEvent[]
): SheetEvent[] {
  const effective = effectiveOf(model, after)
  return events.map(e => {
    if (e.to !== null && e.to !== undefined) return e
    const to = effective(e.path)
    return to === undefined ? e : { ...e, to }
  })
}

/**
 * O valor efetivo, na forma guardada, de um caminho da ficha (o padrão ou o
 * derivado quando nada foi gravado). `undefined` fora do escopo `values`,
 * para texto (o histórico não repete conteúdo) e para campo desconhecido.
 */
export function effectiveOf(
  model: SheetModel,
  sheet: SheetData
): (path: string) => unknown {
  let resolved: ReturnType<typeof resolve> | undefined
  return path => {
    const p = parsePath(path)
    const field = p ? model.fields.get(p.fieldId) : undefined
    if (
      !p ||
      p.scope !== 'values' ||
      !field ||
      NO_EFFECTIVE.has(field.def.type)
    )
      return undefined
    resolved ??= resolve(model, sheet)
    const r = resolved.get(p.fieldId)
    return r ? stored(r, resolved) : undefined
  }
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

/**
 * Os campos com teto não destrutivo (`cap`) cujos pontos inativos mudam de
 * uma ficha para a outra: o resumo do Concluir avisa "Forças: 1 inativo,
 * máx. pelo Arete 2" antes de salvar, e "volta a valer" quando o teto sobe.
 * Nenhum valor muda: o aviso é só sobre o que a parada e a ficha vão usar.
 */
export function inactiveChanges(
  model: SheetModel,
  before: SheetData,
  after: SheetData
): ChangeLabel[] {
  const a = resolve(model, before)
  const b = resolve(model, after)
  const out: ChangeLabel[] = []
  for (const [id, field] of model.fields) {
    if (field.def.type !== 'rating' || !field.def.cap) continue
    const was = a.get(id) as ResolvedRating
    const now = b.get(id) as ResolvedRating
    if (was.inactive === now.inactive) continue
    out.push({
      label: field.def.label,
      change: inactiveNote(now) ?? 'volta a valer',
    })
  }
  return out
}

const MAX_SHOWN_TEXT = 80

const clip = (text: string) =>
  text.length > MAX_SHOWN_TEXT ? `${text.slice(0, MAX_SHOWN_TEXT - 1)}…` : text

const shownText = (value: unknown) =>
  typeof value === 'string' && value.trim() ? clip(value.trim()) : DASH

/**
 * O valor de um caminho, para a pessoa escolher entre o seu e o de agora num
 * conflito (T-31). SÓ para a tela de conflito: ali a escolha exige ver o que
 * cada lado escreveu, então texto livre e especialização aparecem (até 80
 * caracteres). Aviso, resumo, histórico e log continuam sem conteúdo
 * (README dos templates §10 e §11): neles, use `describeEvent`.
 */
export function describeValue(
  model: SheetModel,
  path: string,
  value: unknown
): string {
  const p = parsePath(path)
  const def = p ? model.fields.get(p.fieldId)?.def : undefined
  if (!p || !def) return DASH
  if (p.scope === 'specialties') return shownText(value)
  const unset = value === null || value === undefined
  switch (def.type) {
    case 'text':
    case 'longText':
      return shownText(value)
    case 'rating':
    case 'number':
    case 'percent':
      return n(value)
    case 'resource': {
      const r = rec(value) ?? {}
      const parts = [
        typeof r.permanent === 'number' ? `permanente ${r.permanent}` : null,
        typeof r.current === 'number' ? `atual ${r.current}` : null,
        typeof r.temp === 'number' && r.temp ? `temporários ${r.temp}` : null,
        typeof r.max === 'number' ? `máximo ${r.max}` : null,
      ].filter(Boolean)
      return parts.join(', ') || DASH
    }
    case 'track': {
      if (def.rule === 'boxes') {
        const marked = Object.values(rec(value) ?? {})
          .flatMap(x => asArray(x))
          .filter(x => x === true).length
        return plural(marked, 'marcada', 'marcadas')
      }
      const parts = (def.types ?? []).flatMap(t => {
        const count = get(value, t.id)
        return typeof count === 'number' && count
          ? [`${count} ${t.label.toLowerCase()}`]
          : []
      })
      return parts.join(', ') || 'sem dano'
    }
    case 'choice':
    case 'state':
      return unset ? DASH : optionLabel(def.options, value)
    case 'mark':
      return unset
        ? DASH
        : optionLabel(model.template.markStates?.[def.states], value)
    case 'tags':
      return plural(asArray(value).length, 'marcada', 'marcadas')
    case 'list':
      return plural(asArray(value).length, 'item', 'itens')
    case 'clock':
      return def.fills
        .map(f => {
          const x = get(value, f.id)
          return `${f.label} ${typeof x === 'number' ? x : 0}`
        })
        .join(', ')
    default:
      return unset ? DASH : 'definido'
  }
}
