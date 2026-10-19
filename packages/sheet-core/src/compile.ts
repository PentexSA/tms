import type {
  FieldDef,
  FieldId,
  FromRef,
  FromSource,
  Roll,
  Section,
  SectionGroup,
  TabZone,
  Template,
} from './contract'
import { parseTemplate } from './parse'
import {
  type FieldTypeName,
  type ModeName,
  REGISTRY,
  type SkinName,
  type ZoneName,
} from './registry'
import type { Issue } from './validate'

// Do JSON ao modelo (doc/arquitetura-motor-de-ficha.md §5.2). O app e a API só
// trabalham com o SheetModel: imutável, indexado e com as referências já
// conferidas. Template que esta versão não entende é recusado (fail secure):
// o app mostra "Atualize o app" em vez de adivinhar.

export class UnsupportedTemplateError extends Error {
  readonly issues: readonly Issue[]

  constructor(issues: readonly Issue[]) {
    super('template não suportado por esta versão do app')
    this.name = 'UnsupportedTemplateError'
    this.issues = issues
  }
}

export interface CompiledField<F extends FieldDef = FieldDef> {
  readonly id: FieldId
  readonly type: F['type']
  readonly def: F
  // Seções que citam o campo, na ordem do template. A primeira dá a zona.
  readonly sectionIds: readonly string[]
  readonly zone: ZoneName | null
  // Modos em que o campo muda (UX, não controle de acesso).
  readonly editableIn: readonly ModeName[]
  // Derivado: nunca é guardado; o servidor recalcula.
  readonly readOnly: boolean
}

export interface CompiledGroup {
  readonly id: string
  readonly title: string
  readonly fieldIds: readonly FieldId[]
}

export interface CompiledSection {
  readonly id: string
  readonly def: Section
  readonly zone: ZoneName
  // Todos os campos, em ordem (os de `groups` achatados).
  readonly fieldIds: readonly FieldId[]
  readonly groups: readonly CompiledGroup[] | null
  readonly restricted: boolean
}

export interface CompiledZone {
  readonly id: ZoneName
  // Rótulo da aba (`zoneLabels` ou o padrão); null nas zonas sem aba.
  readonly label: string | null
  readonly sections: readonly CompiledSection[]
}

export interface SheetModel {
  readonly key: string
  readonly system: string
  readonly version: string
  readonly skin: SkinName
  readonly template: Template
  readonly fields: ReadonlyMap<FieldId, CompiledField>
  readonly sections: ReadonlyMap<string, CompiledSection>
  // As 5 zonas, na ordem fixa do app.
  readonly zones: readonly CompiledZone[]
  // Campos numéricos em ordem de dependência (derivados, tetos e bases).
  readonly derivedOrder: readonly FieldId[]
  // Campos da criação de ficha: nome, selo, resumo e a zona `identity`.
  readonly identityFields: readonly FieldId[]
  readonly dock: readonly FieldId[]
  readonly roll: Roll
}

export const DEFAULT_ZONE_LABELS: Readonly<Record<TabZone, string>> = {
  build: 'Ficha',
  powers: 'Poderes',
  lore: 'Sobre',
}

const EDIT_ONLY: readonly ModeName[] = ['edit']
const DEFAULT_EDITABLE_IN: Readonly<
  Partial<Record<FieldTypeName, readonly ModeName[]>>
> = {
  text: ['play', 'edit'],
  longText: ['play', 'edit'],
}

const cache = new Map<string, { json: string; model: SheetModel }>()

/**
 * Valida e compila um template. Lança `UnsupportedTemplateError` quando o
 * template é inválido ou usa nomes que esta versão não conhece.
 *
 * O modelo é memoizado por `system@templateVersion` (versão publicada é
 * imutável); o mesmo par com conteúdo diferente é recompilado.
 */
export function compileTemplate(json: unknown): SheetModel {
  const serialized = serialize(json)
  if (serialized === null)
    throw new UnsupportedTemplateError([
      { path: '', message: 'template malformado' },
    ])
  const probe = json as { system?: unknown; templateVersion?: unknown }
  const key = `${String(probe.system)}@${String(probe.templateVersion)}`
  const hit = cache.get(key)
  if (hit && hit.json === serialized) return hit.model

  // Cópia própria: quem passou o objeto não consegue mudar o modelo depois.
  const parsed = parseTemplate(JSON.parse(serialized))
  if (!parsed.ok) throw new UnsupportedTemplateError(parsed.issues)
  const model = build(deepFreeze(parsed.value), key)
  cache.set(key, { json: serialized, model })
  return model
}

function serialize(json: unknown): string | null {
  if (json === null || typeof json !== 'object' || Array.isArray(json))
    return null
  try {
    const s = JSON.stringify(json)
    return typeof s === 'string' ? s : null
  } catch {
    return null
  }
}

function build(template: Template, key: string): SheetModel {
  const sections = new Map<string, CompiledSection>()
  const sectionsOf = new Map<FieldId, string[]>()
  for (const s of template.sections) {
    const groups = s.groups ? s.groups.map(compileGroup) : null
    const fieldIds = s.fields ?? (groups ?? []).flatMap(g => g.fieldIds)
    sections.set(
      s.id,
      Object.freeze({
        id: s.id,
        def: s,
        zone: s.zone,
        fieldIds: Object.freeze([...fieldIds]),
        groups: groups ? Object.freeze(groups) : null,
        restricted: Boolean(s.permissions?.read),
      })
    )
    for (const id of fieldIds) {
      const list = sectionsOf.get(id) ?? []
      if (!list.includes(s.id)) list.push(s.id)
      sectionsOf.set(id, list)
    }
  }

  const fields = new Map<FieldId, CompiledField>()
  for (const [id, def] of Object.entries(template.fields)) {
    const sectionIds = sectionsOf.get(id) ?? []
    const first = sectionIds[0]
    fields.set(
      id,
      Object.freeze({
        id,
        type: def.type,
        def,
        sectionIds: Object.freeze(sectionIds),
        zone: first ? (sections.get(first)?.zone ?? null) : null,
        editableIn:
          def.editableIn ?? DEFAULT_EDITABLE_IN[def.type] ?? EDIT_ONLY,
        readOnly: def.type === 'number' && def.readOnly === true,
      })
    )
  }

  const zones = REGISTRY.zones.map(zone =>
    Object.freeze({
      id: zone,
      label: isTabZone(zone)
        ? (template.zoneLabels?.[zone] ?? DEFAULT_ZONE_LABELS[zone])
        : null,
      sections: Object.freeze(
        [...sections.values()].filter(s => s.zone === zone)
      ),
    })
  )

  return Object.freeze({
    key,
    system: template.system,
    version: template.templateVersion,
    skin: template.skin,
    template,
    fields: new FrozenMap(fields),
    sections: new FrozenMap(sections),
    zones: Object.freeze(zones),
    derivedOrder: Object.freeze(dependencyOrder(template)),
    identityFields: Object.freeze(identityFields(template, sections)),
    dock: template.dock,
    roll: template.roll,
  })
}

const compileGroup = (g: SectionGroup): CompiledGroup =>
  Object.freeze({
    id: g.id,
    title: g.title,
    fieldIds: Object.freeze([...g.fields]),
  })

const isTabZone = (zone: ZoneName): zone is TabZone =>
  zone === 'build' || zone === 'powers' || zone === 'lore'

// Campos de que o valor numérico de um campo depende (ver resolve.ts).
export function numericDeps(def: FieldDef): FieldId[] {
  // De um item de lista, a dependência é a própria lista
  const refs = (from: FromRef): FieldId[] =>
    (Array.isArray(from) ? from : [from]).map((x: FromSource) =>
      typeof x === 'string' ? x : x.list
    )
  switch (def.type) {
    case 'rating':
      return def.cap ? [def.cap.field] : []
    case 'number':
      return def.readOnly && def.from ? refs(def.from) : []
    case 'percent': {
      const base = def.base
      if (base == null || typeof base === 'number') return []
      return 'field' in base ? [base.field] : refs(base.from)
    }
    default:
      return []
  }
}

// Os campos e tudo de que os valores calculados deles dependem (o máximo do
// Sangue lê a Geração, que lê os Antecedentes). Serve a quem manda só parte da
// ficha (lista da crônica): sem as dependências, o derivado sairia errado.
export function withValueDeps(
  template: Template,
  ids: Iterable<FieldId>
): Set<FieldId> {
  const out = new Set<FieldId>()
  const refs = (from: FromRef): FieldId[] =>
    (Array.isArray(from) ? from : [from]).map((x: FromSource) =>
      typeof x === 'string' ? x : x.list
    )
  const visit = (id: FieldId) => {
    if (out.has(id)) return
    out.add(id)
    const def = Object.hasOwn(template.fields, id)
      ? template.fields[id]
      : undefined
    if (!def) return
    const deps = numericDeps(def)
    if (def.type === 'resource') {
      const max = def.max
      if (max && typeof max === 'object' && 'field' in max) deps.push(max.field)
      else if (max && typeof max === 'object' && 'derive' in max)
        deps.push(...refs(max.from))
      if (def.perTurn) deps.push(...refs(def.perTurn.from))
    }
    for (const d of deps) visit(d)
  }
  for (const id of ids) visit(id)
  return out
}

// Ordem topológica do grafo de dependências numéricas. Ciclo é erro: o
// validador não pega, por exemplo, dois `rating` com `cap` um no outro.
function dependencyOrder(template: Template): FieldId[] {
  const order: FieldId[] = []
  const state = new Map<FieldId, 'visiting' | 'done'>()
  const visit = (id: FieldId, path: readonly FieldId[]) => {
    const seen = state.get(id)
    if (seen === 'done') return
    if (seen === 'visiting')
      throw new UnsupportedTemplateError([
        {
          path: `fields.${id}`,
          message: `dependência circular (${[...path, id].join(' → ')})`,
        },
      ])
    state.set(id, 'visiting')
    const def = Object.hasOwn(template.fields, id)
      ? template.fields[id]
      : undefined
    for (const dep of def ? numericDeps(def) : []) visit(dep, [...path, id])
    state.set(id, 'done')
    if (def && numericDeps(def).length) order.push(id)
  }
  for (const id of Object.keys(template.fields)) visit(id, [])
  return order
}

function identityFields(
  template: Template,
  sections: ReadonlyMap<string, CompiledSection>
): FieldId[] {
  const { identity } = template
  // Com colunas, a ordem é a da ficha impressa (coluna a coluna)
  const ids = [
    identity.name,
    ...(identity.columns ?? []).flat(),
    identity.chip,
    identity.subtitle,
    ...(identity.summary ?? []),
    ...[...sections.values()]
      .filter(s => s.zone === 'identity')
      .flatMap(s => s.fieldIds),
  ]
  const out: FieldId[] = []
  for (const id of ids) {
    if (!id || out.includes(id) || !Object.hasOwn(template.fields, id)) continue
    const def = template.fields[id]
    if (def?.type === 'number' && def.readOnly) continue
    out.push(id)
  }
  return out
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const v of Object.values(value)) deepFreeze(v)
  }
  return value
}

// Map que recusa escrita depois de montado (Object.freeze não protege um Map).
class FrozenMap<K, V> extends Map<K, V> {
  #sealed = false

  constructor(entries: Iterable<readonly [K, V]>) {
    // Sem passar as entradas ao super: ele chamaria this.set antes de #sealed existir.
    super()
    for (const [k, v] of entries) super.set(k, v)
    this.#sealed = true
  }

  override set(key: K, value: V): this {
    if (this.#sealed) throw new TypeError('SheetModel é imutável')
    return super.set(key, value)
  }

  override delete(): boolean {
    throw new TypeError('SheetModel é imutável')
  }

  override clear(): void {
    throw new TypeError('SheetModel é imutável')
  }
}
