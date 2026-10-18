import type { CompiledField, SheetModel } from './compile'
import type {
  ChoiceOption,
  ClockFill,
  DeriveRef,
  FieldDef,
  FieldDefOf,
  FieldId,
  ListItem,
  MarkState,
  SheetData,
  StateOption,
  TagOption,
  TrackLevel,
  TrackRow,
} from './contract'
import { DERIVE, isDeriveName } from './derive'
import type { FieldTypeName, ModifierOp } from './registry'
import { asArray, get, isObj, rec } from './validate/util'

// Valor efetivo de cada campo (doc/arquitetura-motor-de-ficha.md §5.2): base
// ou padrão, modificadores de estado com a origem, tetos e derivados. A view
// nunca calcula regra: recebe o valor pronto daqui.
//
// A semântica é a do protótipo (design/telas/prototipo.js: ratingInfo,
// resourceInfo, healthInfo...). A ficha já passou pelo validador; mesmo assim
// toda leitura é defensiva, porque o otimista do app também passa por aqui.

export interface Modifier {
  // Rótulo da opção de estado que aplica o modificador ("Crinos").
  readonly source: string
  readonly op: ModifierOp
  readonly value: number
}

interface Base<T extends FieldTypeName> {
  readonly id: FieldId
  readonly type: T
  readonly field: CompiledField<FieldDefOf<T>>
}

export interface ResolvedRating extends Base<'rating'> {
  readonly base: number
  // Depois dos modificadores, antes do teto.
  readonly modded: number
  // Efetivo: o que a ficha mostra e a parada usa.
  readonly value: number
  readonly modifiers: readonly Modifier[]
  readonly cap: number | null
  // Pontos acima do teto: inativos, voltam quando o teto sobe.
  readonly inactive: number
  readonly min: number
  readonly max: number
}

export interface ResolvedNumber extends Base<'number'> {
  readonly value: number
  readonly derived: boolean
  // `score+mod`: o modificador derivado do próprio valor.
  readonly mod: number | null
}

export interface ResolvedPercent extends Base<'percent'> {
  readonly base: number
  readonly value: number
  readonly half: number
  readonly fifth: number
  readonly max: number
}

export interface ResolvedResource extends Base<'resource'> {
  readonly current: number
  readonly permanent: number | null
  readonly temp: number | null
  // Máximo do recurso (fixo, derivado, de outro campo ou gravado).
  readonly max: number | null
  // Teto efetivo do atual: o permanente, o máximo ou nenhum (`overMax`).
  readonly cap: number | null
  // O número que a UI mostra como "de N".
  readonly shownMax: number | null
  readonly perTurn: number | null
}

export interface ResolvedStacking extends Base<'track'> {
  readonly rule: 'wod-stacking'
  readonly counts: Readonly<Record<string, number>>
  readonly filled: number
  readonly levels: number
  readonly level: TrackLevel | null
  // 0 sem ferimentos; null com o nível sem penalidade (incapacitado).
  readonly penalty: number | null
  readonly incapacitated: boolean
}

export interface ResolvedBoxRow extends TrackRow {
  readonly marks: readonly boolean[]
}

export interface ResolvedBoxes extends Base<'track'> {
  readonly rule: 'boxes'
  readonly rows: readonly ResolvedBoxRow[]
  readonly marked: number
  readonly total: number
}

export interface ResolvedSlotLevel {
  readonly n: number
  readonly label: string
  readonly max: number
  readonly used: number
}

export interface ResolvedSlots extends Base<'slots'> {
  readonly levels: readonly ResolvedSlotLevel[]
}

export interface ResolvedClock extends Base<'clock'> {
  readonly fills: readonly (ClockFill & { readonly n: number })[]
  readonly used: number
  readonly free: number
}

export interface ResolvedState extends Base<'state'> {
  readonly option: StateOption
}

export interface ResolvedMark extends Base<'mark'> {
  readonly state: MarkState
  readonly states: readonly MarkState[]
  readonly bonus: number | null
}

export interface ResolvedText extends Base<'text' | 'longText'> {
  readonly value: string
}

export interface ResolvedChoice extends Base<'choice'> {
  readonly value: string | null
  readonly option: ChoiceOption | null
}

export interface ResolvedTags extends Base<'tags'> {
  readonly options: readonly TagOption[]
}

export interface ResolvedList extends Base<'list'> {
  readonly items: readonly ListItem[]
}

export type ResolvedTrack = ResolvedStacking | ResolvedBoxes

export type ResolvedField =
  | ResolvedRating
  | ResolvedNumber
  | ResolvedPercent
  | ResolvedResource
  | ResolvedTrack
  | ResolvedSlots
  | ResolvedClock
  | ResolvedState
  | ResolvedMark
  | ResolvedText
  | ResolvedChoice
  | ResolvedTags
  | ResolvedList

export interface ResolvedSheet {
  readonly model: SheetModel
  get(id: FieldId): ResolvedField | undefined
  // Valor numérico de um campo (o que derivações, tetos e paradas usam).
  number(id: FieldId): number
  // Todos os campos, na ordem do template.
  readonly fields: readonly ResolvedField[]
}

type Values = Readonly<Record<string, unknown>>

const int = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isInteger(v) ? v : undefined

export function resolve(
  model: SheetModel,
  sheet: SheetData | { readonly values: Values }
): ResolvedSheet {
  const values: Values = isObj(sheet?.values) ? sheet.values : {}
  const raw = (id: FieldId) => get(values, id)
  const def = (id: FieldId): FieldDef | undefined => model.fields.get(id)?.def

  // Modificadores de estado por campo-alvo, na ordem dos campos do template.
  const modifiers = new Map<FieldId, Modifier[]>()
  for (const f of model.fields.values()) {
    if (f.def.type !== 'state') continue
    const option = stateOption(f.def, raw(f.id))
    for (const m of option.modifiers ?? []) {
      const list = modifiers.get(m.field) ?? []
      list.push({ source: option.label, op: m.op, value: m.value })
      modifiers.set(m.field, list)
    }
  }

  // Números com memo. O compile recusa ciclos; o guarda só evita recursão
  // infinita se um template inválido chegar aqui por engano.
  const numbers = new Map<FieldId, number>()
  const visiting = new Set<FieldId>()
  const number = (id: FieldId): number => {
    const cached = numbers.get(id)
    if (cached !== undefined) return cached
    if (visiting.has(id)) return 0
    visiting.add(id)
    const n = numberOf(id)
    visiting.delete(id)
    numbers.set(id, n)
    return n
  }
  const derive = (name: unknown, from: unknown): number => {
    if (!isDeriveName(name)) return 0
    const args = (Array.isArray(from) ? from : [from]).map(x =>
      typeof x === 'string' ? number(x) : 0
    )
    return DERIVE[name](...args)
  }
  const deriveRef = (ref: DeriveRef) => derive(ref.derive, ref.from)

  const rating = (f: FieldDefOf<'rating'>, id: FieldId) => {
    const base = int(raw(id)) ?? f.default ?? f.min ?? 0
    const mods = modifiers.get(id) ?? []
    let modded = base
    for (const m of mods)
      modded = m.op === 'set' ? m.value : Math.max(0, modded + m.value)
    const cap = f.cap ? number(f.cap.field) : null
    return {
      base,
      modded,
      value: cap === null ? modded : Math.min(modded, cap),
      modifiers: mods,
      cap,
      inactive: cap !== null && modded > cap ? modded - cap : 0,
      min: f.min ?? 0,
      max: f.max,
    }
  }
  const numberValue = (f: FieldDefOf<'number'>, id: FieldId) =>
    f.readOnly && f.derive
      ? derive(f.derive, f.from)
      : (int(raw(id)) ?? f.default ?? f.min ?? 0)
  const percentBase = (f: FieldDefOf<'percent'>) => {
    const b = f.base
    if (b == null) return 0
    if (typeof b === 'number') return b
    return 'field' in b ? number(b.field) : deriveRef(b)
  }
  const resource = (f: FieldDefOf<'resource'>, id: FieldId) => {
    const v = rec(raw(id)) ?? {}
    let max: number | null = null
    if (typeof f.max === 'number') max = f.max
    else if (f.max && 'derive' in f.max) max = deriveRef(f.max)
    else if (f.max && 'field' in f.max) max = number(f.max.field)
    else if (f.max && 'stored' in f.max) max = int(v.max) ?? f.max.min
    const permanent = f.permanent ? (int(v.permanent) ?? f.permanent.min) : null
    const capped = permanent !== null && !f.tempUncapped
    const shownMax = capped ? permanent : max
    return {
      // Ficha nova começa com o recurso cheio.
      current: int(v.current) ?? shownMax ?? 0,
      permanent,
      temp: f.temp ? (int(v.temp) ?? 0) : null,
      max,
      cap: capped ? permanent : f.overMax ? null : max,
      shownMax,
      perTurn: f.perTurn ? deriveRef(f.perTurn) : null,
    }
  }

  function numberOf(id: FieldId): number {
    const f = def(id)
    switch (f?.type) {
      case 'rating':
        return rating(f, id).value
      case 'number':
        return numberValue(f, id)
      case 'percent':
        return int(raw(id)) ?? percentBase(f)
      case 'resource': {
        const r = resource(f, id)
        return r.permanent ?? r.current
      }
      default:
        return 0
    }
  }

  // Bônus de proficiência do D&D: o campo que deriva `proficiencyBonus`.
  const proficiency = () => {
    for (const f of model.fields.values())
      if (f.def.type === 'number' && f.def.derive === 'proficiencyBonus')
        return number(f.id)
    return 0
  }

  const resolveField = (f: CompiledField): ResolvedField => {
    const { id } = f
    const d = f.def
    const base = { id, field: f } as const
    switch (d.type) {
      case 'rating':
        return { ...base, type: 'rating', ...rating(d, id) } as ResolvedRating
      case 'number': {
        const value = numberValue(d, id)
        return {
          ...base,
          type: 'number',
          value,
          derived: Boolean(d.readOnly && d.derive),
          mod:
            d.display === 'score+mod' && d.derive ? derive(d.derive, id) : null,
        } as ResolvedNumber
      }
      case 'percent': {
        const baseValue = percentBase(d)
        const value = int(raw(id)) ?? baseValue
        return {
          ...base,
          type: 'percent',
          base: baseValue,
          value,
          half: DERIVE.half(value),
          fifth: DERIVE.fifth(value),
          max: d.max ?? 99,
        } as ResolvedPercent
      }
      case 'resource':
        return {
          ...base,
          type: 'resource',
          ...resource(d, id),
        } as ResolvedResource
      case 'track': {
        const v = rec(raw(id)) ?? {}
        if (d.rule === 'boxes') {
          const rows = (d.rows ?? []).map(r => {
            const stored = asArray(get(v, r.id))
            const marks = Array.from({ length: r.boxes }, (_, i) =>
              stored[i] === true ? true : false
            )
            return { ...r, marks }
          })
          return {
            ...base,
            type: 'track',
            rule: 'boxes',
            rows,
            marked: rows.reduce(
              (n, r) => n + r.marks.filter(Boolean).length,
              0
            ),
            total: rows.reduce((n, r) => n + r.boxes, 0),
          } as ResolvedBoxes
        }
        const levels = d.levels ?? []
        const counts: Record<string, number> = {}
        for (const t of d.types ?? []) counts[t.id] = int(get(v, t.id)) ?? 0
        const total = Object.values(counts).reduce((n, c) => n + c, 0)
        const filled = Math.min(total, levels.length)
        const level = filled ? (levels[filled - 1] ?? null) : null
        return {
          ...base,
          type: 'track',
          rule: 'wod-stacking',
          counts,
          filled,
          levels: levels.length,
          level,
          penalty: level ? level.penalty : 0,
          incapacitated: level !== null && level.penalty === null,
        } as ResolvedStacking
      }
      case 'slots': {
        const v = rec(raw(id)) ?? {}
        const levels: ResolvedSlotLevel[] = []
        for (let n = 1; n <= d.levels; n++) {
          const s = rec(get(v, String(n)))
          const max = int(s?.max) ?? 0
          if (max > 0)
            levels.push({
              n,
              label: d.levelLabel.replace('{n}', String(n)),
              max,
              used: int(s?.used) ?? 0,
            })
        }
        return { ...base, type: 'slots', levels } as ResolvedSlots
      }
      case 'clock': {
        const v = rec(raw(id)) ?? {}
        const fills = d.fills.map(x => ({ ...x, n: int(get(v, x.id)) ?? 0 }))
        const used = fills.reduce((n, x) => n + x.n, 0)
        return {
          ...base,
          type: 'clock',
          fills,
          used,
          free: Math.max(0, d.segments - used),
        } as ResolvedClock
      }
      case 'state':
        return {
          ...base,
          type: 'state',
          option: stateOption(d, raw(id)),
        } as ResolvedState
      case 'mark': {
        const states = model.template.markStates?.[d.states] ?? []
        const state = states.find(s => s.id === raw(id)) ?? states[0]
        const bonus =
          d.bonus && isDeriveName(d.bonus.derive)
            ? DERIVE[d.bonus.derive](
                number(d.bonus.ability),
                proficiency(),
                state?.multiplier ?? 0
              )
            : null
        return {
          ...base,
          type: 'mark',
          state: state ?? { id: 'none', label: '' },
          states,
          bonus,
        } as ResolvedMark
      }
      case 'text':
      case 'longText': {
        const v = raw(id)
        return {
          ...base,
          type: d.type,
          value: typeof v === 'string' ? v : '',
        } as ResolvedText
      }
      case 'choice': {
        const v = raw(id)
        const option = d.options.find(o => o.id === v) ?? null
        return {
          ...base,
          type: 'choice',
          value: option ? option.id : null,
          option,
        } as ResolvedChoice
      }
      case 'tags': {
        const selected = asArray(raw(id))
        return {
          ...base,
          type: 'tags',
          options: d.options.filter(o => selected.includes(o.id)),
        } as ResolvedTags
      }
      case 'list': {
        const stored = asArray(raw(id)).filter(isObj) as unknown as ListItem[]
        const items = d.fixed
          ? d.fixed.map(fx => ({
              id: fx.id,
              name: fx.label,
              text: stored.find(x => x.id === fx.id)?.text ?? '',
            }))
          : stored
        return { ...base, type: 'list', items } as ResolvedList
      }
    }
  }

  const resolved = new Map<FieldId, ResolvedField>()
  for (const f of model.fields.values()) resolved.set(f.id, resolveField(f))

  return Object.freeze({
    model,
    get: (id: FieldId) => resolved.get(id),
    number,
    fields: Object.freeze([...resolved.values()]),
  })
}

function stateOption(f: FieldDefOf<'state'>, value: unknown): StateOption {
  // O schema exige ao menos 2 opções; a primeira é o padrão.
  return (f.options.find(o => o.id === value) ?? f.options[0]) as StateOption
}
