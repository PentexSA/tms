import type { CompiledField, SheetModel } from './compile'
import type {
  FieldDefOf,
  FieldId,
  ListItem,
  SheetData,
  SheetValue,
  ValueOf,
} from './contract'
import { jsonEqual } from './equal'
import { parsePath, type SheetEvent } from './events'
import { stored } from './fields'
import type { FieldTypeName } from './registry'
import { resolve } from './resolve'
import { asArray, get, isObj, rec } from './validate/util'

// Classe de cada mudança (doc/painel-narrador.md §5.1, doc/plano-v3.md Etapa 4):
// `play` é o jogo (gastar, marcar, curar), `edit` é texto e identidade,
// `advance` é evolução (subir um traço, um poder novo). A política de escrita
// (policy.ts) decide quem grava cada classe em cada estado da ficha.
//
// Classifica o efeito, não o evento: compara a ficha resolvida antes e depois,
// no formato `stored` (o efetivo, com os padrões). Na dúvida, `advance`.

// Da menos à mais restrita.
export const CHANGE_CLASSES = ['play', 'edit', 'advance'] as const
export type ChangeClass = (typeof CHANGE_CLASSES)[number]

export interface ChangePart {
  // `values.<campo>`, `values.<campo>#<parte>` ou `specialties.<campo>`.
  readonly path: string
  readonly kind: ChangeClass
}

export interface BatchClassification {
  readonly parts: readonly ChangePart[]
  // A mais restrita das partes; null quando o lote não muda nenhum efetivo.
  readonly kind: ChangeClass | null
}

/** A mais restrita das classes (`advance` > `edit` > `play`), ou null. */
export function strictest(classes: Iterable<ChangeClass>): ChangeClass | null {
  let out = -1
  for (const c of classes) out = Math.max(out, CHANGE_CLASSES.indexOf(c))
  return out < 0 ? null : (CHANGE_CLASSES[out] ?? null)
}

// Uma parte que mudou: `at` é o que vem depois do `#` no caminho.
interface Part {
  readonly at?: string
  readonly kind: ChangeClass
}

type Classifier<T extends FieldTypeName> = (
  field: CompiledField<FieldDefOf<T>>,
  before: ValueOf<T> | undefined,
  after: ValueOf<T> | undefined
) => Part[]

// `editableIn: ["play"]` torna jogo o que, sem ele, seria `fallback`.
const playOr = (field: CompiledField, fallback: ChangeClass): ChangeClass =>
  field.editableIn.includes('play') ? 'play' : fallback

const whole =
  (kind: (field: CompiledField) => ChangeClass) =>
  (field: CompiledField): Part[] => [{ kind: kind(field) }]

const keys = (...objs: unknown[]): string[] => [
  ...new Set(objs.flatMap(o => (isObj(o) ? Object.keys(o) : []))),
]

// Uma parte por chave que mudou, cada uma com a classe que `kindOf` dá.
const byKey = (
  before: unknown,
  after: unknown,
  kindOf: (key: string) => ChangeClass
): Part[] =>
  keys(before, after)
    .filter(k => !jsonEqual(get(before, k), get(after, k)))
    .map(k => ({ at: k, kind: kindOf(k) }))

const RESOURCE_PLAY = new Set(['current', 'temp'])

const slots: Classifier<'slots'> = (_, before, after) =>
  keys(before, after).flatMap((n): Part[] => {
    const a = rec(get(before, n))
    const b = rec(get(after, n))
    // Um nível que aparece ou some muda o máximo
    if (!a || !b) return [{ at: n, kind: 'advance' }]
    return byKey(a, b, k => (k === 'used' ? 'play' : 'advance')).map(p => ({
      ...p,
      at: `${n}.${p.at}`,
    }))
  })

// Item com número (pontos, Posto, nível, custo): incluir ou remover é evolução.
const hasNumber = (item: ListItem): boolean =>
  item.value !== undefined ||
  Object.values(item.meta ?? {}).some(v => typeof v === 'number')

const list: Classifier<'list'> = (field, before, after) => {
  const def = field.def
  const play = field.editableIn.includes('play')
  const loose = play ? 'play' : 'edit'
  const items = (v: unknown) =>
    new Map(
      (asArray(v).filter(isObj) as unknown as ListItem[]).map(x => [x.id, x])
    )
  const a = items(before)
  const b = items(after)
  const numericMeta = (id: string, x: unknown, y: unknown) => {
    const m = def.item.meta?.find(m => m.id === id)
    return m ? m.type === 'number' : typeof (x ?? y) === 'number'
  }
  const parts: Part[] = []
  for (const id of new Set([...a.keys(), ...b.keys()])) {
    const x = a.get(id)
    const y = b.get(id)
    if (!x || !y) {
      const item = (x ?? y) as ListItem
      const kind: ChangeClass =
        item.value !== undefined
          ? 'advance'
          : play
            ? 'play'
            : hasNumber(item)
              ? 'advance'
              : 'edit'
      parts.push({ at: id, kind })
      continue
    }
    for (const k of keys(x, y)) {
      if (k === 'id' || jsonEqual(get(x, k), get(y, k))) continue
      if (k === 'meta') {
        for (const p of byKey(x.meta, y.meta, m =>
          numericMeta(m, get(x.meta, m), get(y.meta, m))
            ? playOr(field, 'advance')
            : loose
        ))
          parts.push({ at: `${id}.meta.${p.at}`, kind: p.kind })
        continue
      }
      const kind: ChangeClass =
        k === 'specialty'
          ? 'edit'
          : k === 'name' || k === 'text' || k === 'notes'
            ? loose
            : 'advance'
      parts.push({ at: `${id}.${k}`, kind })
    }
  }
  // A ordem dos itens que ficaram
  const order = (m: Map<string, unknown>, other: Map<string, unknown>) =>
    [...m.keys()].filter(id => other.has(id))
  if (!jsonEqual(order(a, b), order(b, a)))
    parts.push({ at: 'order', kind: loose })
  return parts
}

// Um classificador por tipo da lista fechada: o build quebra se faltar um.
const CLASSIFIERS: { readonly [T in FieldTypeName]: Classifier<T> } = {
  rating: whole(f => playOr(f, 'advance')),
  number: whole(f => playOr(f, 'advance')),
  percent: whole(f => playOr(f, 'advance')),
  mark: whole(f => playOr(f, 'advance')),
  tags: whole(f => playOr(f, 'advance')),
  resource: (_, before, after) =>
    byKey(before, after, k => (RESOURCE_PLAY.has(k) ? 'play' : 'advance')),
  track: (_, before, after) => byKey(before, after, () => 'play'),
  clock: (_, before, after) => byKey(before, after, () => 'play'),
  state: whole(() => 'play'),
  slots,
  choice: whole(() => 'edit'),
  text: whole(() => 'edit'),
  longText: whole(() => 'edit'),
  list,
}

/**
 * As partes que mudaram num campo, entre dois valores efetivos (o formato
 * `stored`). Valores iguais: nenhuma parte. Uma diferença que o tipo não sabe
 * classificar é `advance`.
 */
export function classifyChange(
  field: CompiledField,
  before: SheetValue | undefined,
  after: SheetValue | undefined
): ChangePart[] {
  if (jsonEqual(before, after)) return []
  const classify = CLASSIFIERS[field.type] as Classifier<FieldTypeName>
  const parts = classify(
    field as CompiledField<FieldDefOf<FieldTypeName>>,
    before,
    after
  )
  const base = `values.${field.id}`
  if (!parts.length) return [{ path: base, kind: 'advance' }]
  return parts.map(p => ({
    path: p.at === undefined ? base : `${base}#${p.at}`,
    kind: p.kind,
  }))
}

/**
 * A classe de mexer no campo pelo editor de Evoluir, sem saber o valor novo:
 * o app desabilita o que a política vai recusar (o servidor confere o lote de
 * verdade com `classifyBatch`). O editor de recurso muda o permanente e o
 * máximo guardado, quando há; o de espaços, o máximo de cada nível. Lista: a classe da parte mais solta (nome, notas),
 * para não travar o que passa; a parte de evolução o servidor recusa com o
 * motivo.
 */
export function editClass(field: CompiledField): ChangeClass {
  const { def } = field
  switch (def.type) {
    case 'rating':
    case 'number':
    case 'percent':
    case 'mark':
    case 'tags':
      return playOr(field, 'advance')
    case 'resource': {
      // Sem permanente nem máximo guardado, o editor só muda o atual
      const stored = typeof def.max === 'object' && 'stored' in def.max
      return def.permanent || stored ? 'advance' : 'play'
    }
    case 'slots':
      return 'advance'
    case 'track':
    case 'clock':
    case 'state':
      return 'play'
    case 'list':
      return playOr(field, 'edit')
    default:
      return 'edit'
  }
}

// O lote aplicado sem conferir nada: quem chama já passou pelo applyBatch.
function applied(sheet: SheetData, events: readonly SheetEvent[]): SheetData {
  const values: Record<string, unknown> = { ...sheet.values }
  const specialties: Record<string, unknown> = { ...(sheet.specialties ?? {}) }
  for (const e of events) {
    const p = parsePath(e.path)
    if (!p) continue
    const bucket = p.scope === 'values' ? values : specialties
    if (e.to === null || e.to === undefined) delete bucket[p.fieldId]
    else bucket[p.fieldId] = e.to
  }
  return { values, specialties } as SheetData
}

/**
 * A classe de cada parte que o lote muda, comparando a ficha resolvida antes
 * e depois. Pega o que o lote não cita: trocar a tribo muda a FdV permanente
 * padrão, e a parte vem com o caminho da FdV. Campos derivados ficam de fora
 * (a classe vem das fontes). Só lê: `before` não muda.
 */
export function classifyBatch(
  model: SheetModel,
  before: SheetData,
  events: readonly SheetEvent[]
): BatchClassification {
  const a = resolve(model, before)
  const b = resolve(model, applied(before, events))
  const parts: ChangePart[] = []
  for (const [id, field] of model.fields) {
    if (field.readOnly) continue
    const ra = a.get(id)
    const rb = b.get(id)
    if (!ra || !rb) continue
    parts.push(...classifyChange(field, stored(ra, a), stored(rb, b)))
  }
  for (const id of model.fields.keys() as Iterable<FieldId>)
    if (a.specialty(id) !== b.specialty(id))
      parts.push({ path: `specialties.${id}`, kind: 'edit' })
  return { parts, kind: strictest(parts.map(p => p.kind)) }
}
