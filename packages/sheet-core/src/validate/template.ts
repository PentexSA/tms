import type { FieldDefOf, Roll, Section, Template } from '../contract'
import { type FieldTypeName, REGISTRY } from '../registry'
import type { Issue } from './issues'
import { isSafeText } from './safe-text'
import {
  asArray,
  flat1,
  isId,
  isIntIn,
  isListItemRef,
  isObj,
  NUM_LIMIT,
  numOr,
  type Obj,
  own,
  rec,
} from './util'

// Porta de validateTemplate (design/scripts/validate.mjs) com as mesmas
// mensagens e caminhos. Checa o que JSON Schema não expressa: referências entre
// campos, seções e rolagem, paleta de accent, campos restritos fora da ficha.
// Não substitui schema.json: na publicação, os dois rodam.
//
// Diferenças deliberadas, todas mais estritas: estrutura inesperada vira erro em
// vez de exceção; ids não podem ser nomes de Object.prototype (como em
// schema.json); lista que não é array é rejeitada.

// Chaves permitidas (allowlist). Chave desconhecida é erro: impede atributos
// como "onclick" ou campos que o renderizador ignoraria e algum código futuro
// poderia interpretar.
const KEYS = {
  template: [
    'schema',
    'system',
    'name',
    'family',
    'edition',
    'templateVersion',
    'locale',
    'skin',
    'license',
    'identity',
    'accent',
    'fields',
    'markStates',
    'ladders',
    'sections',
    'zoneLabels',
    'statusLabels',
    'dock',
    'roll',
    'actions',
  ],
  fieldCommon: [
    'type',
    'label',
    'shortLabel',
    'help',
    'editableIn',
    'specialty',
    'sublabel',
    'badge',
    'readOnly',
    'derive',
    'from',
  ],
  field: {
    rating: ['min', 'max', 'default', 'cap', 'valueLabels'],
    number: [
      'min',
      'max',
      'default',
      'display',
      'ladder',
      'suffix',
      'allowInput',
    ],
    percent: ['display', 'base', 'max'],
    resource: [
      'max',
      'permanent',
      'temp',
      'rule',
      'atZero',
      'allowInput',
      'defaultAction',
      'actions',
      'colorRole',
      'tempUncapped',
      'overMax',
      'perTurn',
      'spendLabel',
      'gainLabel',
    ],
    track: ['rule', 'levels', 'types', 'rows'],
    slots: ['levels', 'levelLabel', 'reset', 'defaultAction'],
    clock: ['segments', 'rule', 'fills'],
    state: ['options', 'cost'],
    mark: ['states', 'bonus'],
    text: ['maxLength', 'aspect', 'placeholder'],
    longText: ['maxLength', 'placeholder'],
    choice: ['options', 'glyph'],
    tags: ['options'],
    list: [
      'itemLabel',
      'item',
      'catalog',
      'searchable',
      'density',
      'fixed',
      'rollAs',
    ],
  } as const satisfies Record<FieldTypeName, readonly string[]>,
  section: [
    'id',
    'zone',
    'title',
    'layout',
    'groups',
    'fields',
    'filter',
    'searchable',
    'groupTabs',
    'badge',
    'permissions',
    'pinTop',
    'columns',
    'minColWidth',
    'collapsed',
  ],
  roll: [
    'model',
    'label',
    'die',
    'dice',
    'slots',
    'difficulty',
    'penalty',
    'specialty',
    'boosts',
    'presets',
    'advantage',
    'target',
    'conditions',
    'bonusDice',
    'ladder',
  ],
} as const

// Paridade com os tipos do contrato, checada pelo compilador nos dois sentidos:
// toda chave de um tipo está na allowlist, e a allowlist só cita chaves que o
// tipo tem. `fieldCommon` é mais larga que o schema de propósito (o schema
// restringe por tipo), então só conta no primeiro sentido. Se uma linha abaixo
// não compilar, o tipo indica a chave que divergiu.
type CommonKey = (typeof KEYS.fieldCommon)[number]
type TypeKey<T extends FieldTypeName> = (typeof KEYS.field)[T][number]
type MissingFieldKey = {
  [T in FieldTypeName]: Exclude<keyof FieldDefOf<T>, CommonKey | TypeKey<T>>
}[FieldTypeName]
type ExtraFieldKey = {
  [T in FieldTypeName]: Exclude<TypeKey<T>, keyof FieldDefOf<T>>
}[FieldTypeName]
type AllKeys<U> = U extends unknown ? keyof U : never
type Mismatch<Allowed, Typed> =
  | Exclude<Allowed, Typed>
  | Exclude<Typed, Allowed>
type Parity<K> = [K] extends [never] ? true : K
const _missingFieldKeys: Parity<MissingFieldKey> = true
const _extraFieldKeys: Parity<ExtraFieldKey> = true
const _templateKeys: Parity<
  Mismatch<(typeof KEYS.template)[number], keyof Template>
> = true
const _sectionKeys: Parity<
  Mismatch<(typeof KEYS.section)[number], keyof Section>
> = true
const _rollKeys: Parity<Mismatch<(typeof KEYS.roll)[number], AllKeys<Roll>>> =
  true
void [
  _missingFieldKeys,
  _extraFieldKeys,
  _templateKeys,
  _sectionKeys,
  _rollKeys,
]

const FORBIDDEN_KEYS: readonly string[] = [
  '__proto__',
  'constructor',
  'prototype',
]
const PLAYABLE: readonly unknown[] = [
  'resource',
  'track',
  'slots',
  'clock',
  'state',
  'number',
  'list',
  'tags',
  'rating',
]
// Efeito de boost → modelos de rolagem que o aplicam. Fora disso, o recurso
// seria gasto sem efeito.
const BOOST_MODELS: Readonly<Record<string, readonly unknown[]>> = {
  autoSuccess: ['pool-success'],
  plus2: ['fudge'],
}

export function validateTemplate(
  template: unknown,
  palette: readonly string[]
): Issue[] {
  if (!isObj(template)) return [{ path: '', message: 'template malformado' }]
  const issues: Issue[] = []
  try {
    check(template, palette, (path, message) => {
      issues.push({ path, message })
    })
  } catch {
    // Estrutura que escapou das checagens: nunca "passa" (fail secure).
    issues.push({
      path: '',
      message: 'template malformado (estrutura inesperada)',
    })
  }
  return issues
}

function check(
  t: Obj,
  palette: readonly string[],
  err: (path: string, message: string) => void
): void {
  const text = (path: string, v: unknown, max = 200) => {
    if (typeof v !== 'string' || !v.length)
      return err(path, 'texto obrigatório')
    if (v.length > max) err(path, `texto acima de ${max} caracteres`)
    if (!isSafeText(v))
      err(
        path,
        'texto com caracteres proibidos (< >, controle ou bidi): rótulo é texto, nunca HTML'
      )
  }
  const oneOf = (
    path: string,
    v: unknown,
    list: readonly unknown[],
    what: string
  ) => {
    if (!list.includes(v)) err(path, `${what} '${v}' fora da lista fechada`)
  }
  const keys = (path: string, o: unknown, allowed: readonly string[]) => {
    if (!isObj(o)) return err(path, 'precisa ser objeto')
    for (const k of Object.keys(o))
      if (!allowed.includes(k))
        err(`${path}.${k}`, 'chave desconhecida (rejeitada)')
  }
  const num = (path: string, v: unknown, min = -NUM_LIMIT, max = NUM_LIMIT) => {
    if (v == null) return
    if (!isIntIn(v, min, max))
      err(path, `precisa ser inteiro entre ${min} e ${max}`)
  }
  // Lista opcional: ausente vale vazia; presente e não array é erro.
  const list = (path: string, v: unknown): readonly unknown[] => {
    if (v == null) return []
    if (Array.isArray(v)) return v
    err(path, 'precisa ser lista')
    return []
  }
  // Lista opcional de objetos: item que não é objeto é erro e fica de fora.
  const objs = (path: string, v: unknown): Obj[] => {
    const out: Obj[] = []
    for (const [i, x] of list(path, v).entries()) {
      if (isObj(x)) out.push(x)
      else err(`${path}.${i}`, 'precisa ser objeto')
    }
    return out
  }

  const fields: Obj = isObj(t.fields) ? t.fields : {}
  const has = (id: unknown) => own(fields, id)
  const field = (id: unknown): Obj | undefined =>
    has(id) ? rec(fields[id as string]) : undefined
  // Entradas de uma derivação: campos ou um item (pelo nome) de uma lista
  const sources = (path: string, from: unknown) => {
    for (const src of flat1(from).filter(Boolean)) {
      if (!isListItemRef(src)) {
        if (!has(src)) err(path, `campo '${src}' não existe`)
        continue
      }
      const l = field(src.list)
      if (l?.type !== 'list') err(path, `campo '${src.list}' não é uma lista`)
      else if (
        Array.isArray(l.catalog) &&
        !(l.catalog as unknown[]).includes(src.item)
      )
        err(path, `'${src.item}' não está no catálogo de '${src.list}'`)
    }
  }
  // `default` com fórmula (§3): inteiro, derivação ou valor por opção de um choice
  const formula = (path: string, v: unknown, min: number, max: number) => {
    if (v == null) return
    if (!isObj(v)) return num(path, v, min, max)
    if (v.derive !== undefined) {
      oneOf(`${path}.derive`, v.derive, REGISTRY.derive, 'derive')
      return sources(`${path}.from`, v.from)
    }
    const choice = field(v.from)
    if (choice?.type !== 'choice')
      return err(`${path}.from`, `campo '${v.from}' não é um choice`)
    const options = asArray(choice.options).map(o => rec(o)?.id)
    for (const [k, n] of Object.entries(rec(v.map) ?? {})) {
      if (!options.includes(k))
        err(`${path}.map.${k}`, `opção '${k}' não existe em '${v.from}'`)
      num(`${path}.map.${k}`, n, min, max)
    }
  }
  const accentOk = (v: unknown) =>
    v === 'accent-neutral' || (typeof v === 'string' && palette.includes(v))

  // Toda string do template, em qualquer profundidade, é texto puro e limitada.
  const walk = (path: string, v: unknown, depth = 0): void => {
    if (depth > 12) return err(path, 'aninhamento profundo demais')
    if (typeof v === 'string') {
      if (v.length > 1000) err(path, 'texto acima de 1000 caracteres')
      if (!isSafeText(v))
        err(path, 'texto com caracteres proibidos (< >, controle ou bidi)')
    } else if (Array.isArray(v)) {
      v.forEach((x, i) => walk(`${path}.${i}`, x, depth + 1))
    } else if (isObj(v)) {
      for (const [k, x] of Object.entries(v)) {
        if (FORBIDDEN_KEYS.includes(k)) err(`${path}.${k}`, 'chave proibida')
        walk(`${path}.${k}`, x, depth + 1)
      }
    }
  }
  walk('', t)

  keys('template', t, KEYS.template)
  if (t.schema !== 1) err('schema', 'versão de schema desconhecida')
  const system = typeof t.system === 'string' ? t.system : ''
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(system))
    err(
      'system',
      'código de sistema inválido (kebab-case; a edição faz parte do código, ex.: vtm-v20)'
    )
  text('name', t.name)
  oneOf('skin', t.skin, REGISTRY.skins, 'skin')
  const version = typeof t.templateVersion === 'string' ? t.templateVersion : ''
  if (!/^\d+\.\d+\.\d+$/.test(version)) err('templateVersion', 'use semver')

  for (const [id, raw] of Object.entries(fields)) {
    const p = `fields.${id}`
    if (!isId(id)) err(p, 'id inválido')
    if (!isObj(raw)) {
      err(p, 'campo malformado')
      continue
    }
    const f = raw
    oneOf(`${p}.type`, f.type, REGISTRY.fieldTypes, 'type')
    const typeKeys = own(KEYS.field, f.type)
      ? KEYS.field[f.type as FieldTypeName]
      : []
    keys(p, f, [...KEYS.fieldCommon, ...typeKeys])
    text(`${p}.label`, f.label)
    if (f.shortLabel) text(`${p}.shortLabel`, f.shortLabel, 16)
    if (f.help) text(`${p}.help`, f.help, 400)
    for (const m of list(`${p}.editableIn`, f.editableIn))
      oneOf(`${p}.editableIn`, m, REGISTRY.modes, 'modo')
    if (f.colorRole)
      oneOf(`${p}.colorRole`, f.colorRole, REGISTRY.colorRoles, 'colorRole')
    if (f.defaultAction)
      oneOf(
        `${p}.defaultAction`,
        f.defaultAction,
        REGISTRY.defaultActions,
        'defaultAction'
      )
    if (f.derive) oneOf(`${p}.derive`, f.derive, REGISTRY.derive, 'derive')
    sources(`${p}.from`, f.from)
    const badge = rec(f.badge)
    if (f.badge && !has(badge?.field))
      err(`${p}.badge.field`, `campo '${badge?.field}' não existe`)
    if (f.maxLength != null) num(`${p}.maxLength`, f.maxLength, 1, 20000)
    if (f.type === 'rating')
      formula(`${p}.default`, f.default, numOr(f.min, 0), numOr(f.max, 10))
    else if (f.default != null)
      num(
        `${p}.default`,
        f.default,
        numOr(f.min, f.type === 'rating' ? 0 : -NUM_LIMIT),
        numOr(f.max, f.type === 'rating' ? 10 : NUM_LIMIT)
      )
    if (f.spendLabel) text(`${p}.spendLabel`, f.spendLabel, 24)
    if (f.gainLabel) text(`${p}.gainLabel`, f.gainLabel, 24)

    if (f.type === 'rating') {
      num(`${p}.min`, f.min, 0, 10)
      num(`${p}.max`, f.max, 1, 10)
      if (f.cap) {
        const cap = rec(f.cap)
        const capType = field(cap?.field)?.type
        if (!has(cap?.field))
          err(`${p}.cap.field`, `campo '${cap?.field}' não existe`)
        else if (capType !== 'rating' && capType !== 'number')
          err(`${p}.cap.field`, 'o teto precisa ser rating ou number')
      }
    }
    if (f.type === 'number') {
      num(`${p}.min`, f.min)
      num(`${p}.max`, f.max)
      if (f.display)
        oneOf(`${p}.display`, f.display, REGISTRY.numberDisplays, 'display')
      if (f.display === 'ladder' && !own(t.ladders, f.ladder))
        err(`${p}.ladder`, `escada '${f.ladder}' não declarada em ladders`)
      if (f.suffix) text(`${p}.suffix`, f.suffix, 24)
    }
    if (f.type === 'percent') {
      if (f.display)
        oneOf(`${p}.display`, f.display, REGISTRY.percentDisplays, 'display')
      num(`${p}.max`, f.max, 1, 100)
      const base = f.base
      if (typeof base === 'number') num(`${p}.base`, base, 0, 100)
      else if (isObj(base)) {
        if (base.field && !has(base.field))
          err(`${p}.base`, `campo '${base.field}' não existe`)
        if (base.derive)
          oneOf(`${p}.base.derive`, base.derive, REGISTRY.derive, 'derive')
      }
    }
    if (f.type === 'resource') {
      if (f.rule) oneOf(`${p}.rule`, f.rule, REGISTRY.resourceRules, 'rule')
      if (f.atZero) oneOf(`${p}.atZero`, f.atZero, REGISTRY.atZero, 'atZero')
      const max = f.max
      if (typeof max === 'number') num(`${p}.max`, max, 1, 9999)
      else if (isObj(max)) {
        if (max.derive)
          oneOf(`${p}.max.derive`, max.derive, REGISTRY.derive, 'derive')
        sources(`${p}.max.from`, max.from)
        if (max.field && !has(max.field))
          err(`${p}.max.field`, `campo '${max.field}' não existe`)
        if (max.stored) {
          num(`${p}.max.min`, max.min, 0, 9999)
          num(`${p}.max.max`, max.max, 1, 9999)
        }
      }
      if (f.permanent) {
        const permanent = rec(f.permanent)
        num(`${p}.permanent.min`, permanent?.min, 0, 100)
        num(`${p}.permanent.max`, permanent?.max, 1, 100)
        formula(
          `${p}.permanent.default`,
          permanent?.default,
          numOr(permanent?.min, 0),
          numOr(permanent?.max, 100)
        )
      }
      const perTurn = rec(f.perTurn)
      if (perTurn?.derive)
        oneOf(`${p}.perTurn.derive`, perTurn.derive, REGISTRY.derive, 'derive')
      for (const a of objs(`${p}.actions`, f.actions)) {
        text(`${p}.actions.${a.id}.label`, a.label)
        oneOf(
          `${p}.actions.${a.id}.effect`,
          a.effect,
          REGISTRY.effects,
          'effect'
        )
        num(`${p}.actions.${a.id}.cost`, a.cost, 0, 100)
        const params = rec(a.params)
        if (params?.field && !has(params.field))
          err(
            `${p}.actions.${a.id}.params.field`,
            `campo '${params.field}' não existe`
          )
      }
    }
    if (f.type === 'track') {
      oneOf(`${p}.rule`, f.rule, REGISTRY.trackRules, 'rule')
      if (f.rule === 'wod-stacking') {
        const levels = f.levels
        if (!Array.isArray(levels) || !levels.length || levels.length > 20)
          err(`${p}.levels`, 'wod-stacking precisa de 1 a 20 levels')
        for (const [i, raw] of list(`${p}.levels`, levels).entries()) {
          const l = rec(raw)
          if (!l) {
            err(`${p}.levels.${i}`, 'precisa ser objeto')
            continue
          }
          text(`${p}.levels.${i}.label`, l.label)
          if (l.penalty !== null)
            num(`${p}.levels.${i}.penalty`, l.penalty, -10, 0)
        }
        if (!Array.isArray(f.types) || !f.types.length)
          err(`${p}.types`, 'declare os tipos de dano em ordem de gravidade')
        for (const ty of objs(`${p}.types`, f.types)) {
          if (!isId(ty.id)) err(`${p}.types`, 'id inválido')
          text(`${p}.types.${ty.id}.label`, ty.label)
          text(`${p}.types.${ty.id}.glyph`, ty.glyph, 3)
        }
      }
      if (f.rule === 'boxes') {
        for (const r of objs(`${p}.rows`, f.rows)) {
          text(`${p}.rows.${r.id}.label`, r.label)
          if (!isIntIn(r.boxes, 1, 20))
            err(`${p}.rows.${r.id}.boxes`, 'entre 1 e 20')
        }
      }
    }
    if (f.type === 'clock') {
      oneOf(`${p}.rule`, f.rule, REGISTRY.clockRules, 'rule')
      if (!isIntIn(f.segments, 2, 24)) err(`${p}.segments`, 'entre 2 e 24')
      for (const fill of objs(`${p}.fills`, f.fills)) {
        text(`${p}.fills.${fill.id}.label`, fill.label)
        oneOf(
          `${p}.fills.${fill.id}.colorRole`,
          fill.colorRole,
          REGISTRY.colorRoles,
          'colorRole'
        )
        formula(
          `${p}.fills.${fill.id}.default`,
          fill.default,
          0,
          numOr(f.segments, 24)
        )
      }
    }
    if (f.type === 'slots') {
      num(`${p}.levels`, f.levels, 1, 9)
      if (f.reset) oneOf(`${p}.reset`, f.reset, REGISTRY.slotResets, 'reset')
    }
    if (f.type === 'state') {
      for (const o of objs(`${p}.options`, f.options)) {
        text(`${p}.options.${o.id}.label`, o.label)
        for (const m of objs(`${p}.options.${o.id}.modifiers`, o.modifiers)) {
          if (!has(m.field))
            err(
              `${p}.options.${o.id}.modifiers`,
              `campo '${m.field}' não existe`
            )
          oneOf(
            `${p}.options.${o.id}.modifiers.op`,
            m.op,
            REGISTRY.modifierOps,
            'op'
          )
          num(`${p}.options.${o.id}.modifiers.value`, m.value, -20, 20)
          if (!Number.isInteger(m.value))
            err(`${p}.options.${o.id}.modifiers.value`, 'precisa ser inteiro')
        }
      }
      const cost = rec(f.cost)
      if (f.cost && !has(cost?.resource))
        err(`${p}.cost.resource`, `campo '${cost?.resource}' não existe`)
    }
    if (f.type === 'mark') {
      if (!own(t.markStates, f.states))
        err(`${p}.states`, `conjunto '${f.states}' não declarado em markStates`)
      if (f.bonus) {
        const bonus = rec(f.bonus)
        oneOf(`${p}.bonus.derive`, bonus?.derive, REGISTRY.derive, 'derive')
        if (!has(bonus?.ability)) err(`${p}.bonus.ability`, 'campo não existe')
      }
    }
    if (f.type === 'choice' || f.type === 'tags') {
      const options = objs(`${p}.options`, f.options)
      for (const o of options) {
        if (!isId(o.id)) err(`${p}.options`, `id '${o.id}' inválido`)
        text(`${p}.options.${o.id}.label`, o.label)
      }
      for (const o of options)
        if (o.roll)
          oneOf(
            `${p}.options.${o.id}.roll`,
            o.roll,
            REGISTRY.conditionRoll,
            'roll'
          )
      if (f.glyph) oneOf(`${p}.glyph`, f.glyph, REGISTRY.glyphs, 'glyph')
    }
    if (f.type === 'list') {
      for (const c of list(`${p}.catalog`, f.catalog))
        text(`${p}.catalog`, c, 80)
      const item = rec(f.item)
      for (const m of objs(`${p}.item.meta`, item?.meta))
        text(`${p}.item.meta.${m.id}.label`, m.label)
      const value = rec(item?.value)
      if (item?.value) {
        num(`${p}.item.value.min`, value?.min, 0, 10)
        num(`${p}.item.value.max`, value?.max, 1, 10)
      }
    }
  }

  const sections = objs('sections', t.sections)
  const sectionIds = new Set<unknown>()
  const restricted = new Set<unknown>()
  for (const s of sections) {
    const p = `sections.${s.id}`
    keys(p, s, KEYS.section)
    if (!isId(s.id)) err(p, 'id inválido')
    if (sectionIds.has(s.id)) err(p, 'id repetido')
    sectionIds.add(s.id)
    oneOf(`${p}.zone`, s.zone, REGISTRY.zones, 'zona')
    oneOf(`${p}.layout`, s.layout, REGISTRY.layouts, 'layout')
    text(`${p}.title`, s.title)
    num(`${p}.columns`, s.columns, 1, 6)
    num(`${p}.minColWidth`, s.minColWidth, 120, 600)
    const groups = objs(`${p}.groups`, s.groups)
    const ids = [
      ...list(`${p}.fields`, s.fields),
      ...groups.flatMap(g => {
        if (g.fields == null)
          err(`${p}.groups.${g.id}.fields`, 'precisa ser lista')
        return list(`${p}.groups.${g.id}.fields`, g.fields)
      }),
    ]
    for (const g of groups) text(`${p}.groups.${g.id}.title`, g.title)
    for (const id of ids) if (!has(id)) err(`${p}`, `campo '${id}' não existe`)
    if (s.filter) {
      const filter = rec(s.filter)
      oneOf(`${p}.filter.rule`, filter?.rule, REGISTRY.filterRules, 'filtro')
      text(`${p}.filter.label`, filter?.label)
    }
    const sectionBadge = rec(s.badge)
    if (s.badge && !has(sectionBadge?.field))
      err(`${p}.badge`, `campo '${sectionBadge?.field}' não existe`)
    const permissions = rec(s.permissions)
    const roles = [
      ...list(`${p}.permissions.read`, permissions?.read),
      ...list(`${p}.permissions.write`, permissions?.write),
    ]
    for (const r of roles) oneOf(`${p}.permissions`, r, REGISTRY.roles, 'papel')
    if (permissions?.read) for (const id of ids) restricted.add(id)
  }

  // Abas: o app mostra uma aba por zona (build, powers, lore). O template só
  // pode trocar o rótulo, curto o bastante para as 3 caberem a 360 dp com
  // fonte grande.
  if (t.zoneLabels != null) {
    keys('zoneLabels', t.zoneLabels, ['build', 'powers', 'lore'])
    for (const [z, label] of Object.entries(rec(t.zoneLabels) ?? {}))
      text(`zoneLabels.${z}`, label, 14)
  }

  // Estados da ficha (doc/painel-narrador.md §5.1): o template só nomeia o
  // `dead` ("Torpor", "Desaparecido"); os outros têm nome fixo no app.
  if (t.statusLabels != null) {
    keys('statusLabels', t.statusLabels, ['dead'])
    for (const [s, label] of Object.entries(rec(t.statusLabels) ?? {}))
      text(`statusLabels.${s}`, label, 20)
  }

  // O que aparece fora da ficha (header, lista de personagens, mesa, dock) não
  // pode vir de seção com leitura restrita: vazaria para quem não pode lê-la.
  const identity = rec(t.identity) ?? {}
  for (const k of ['name', 'chip', 'subtitle', 'voice']) {
    const v = identity[k]
    if (v && !has(v)) err(`identity.${k}`, `campo '${v}' não existe`)
    if (v && restricted.has(v))
      err(`identity.${k}`, 'campo de seção com leitura restrita')
  }
  for (const k of list('identity.summary', identity.summary)) {
    if (!has(k)) err('identity.summary', `campo '${k}' não existe`)
    if (restricted.has(k))
      err('identity.summary', `campo '${k}' é de seção com leitura restrita`)
  }
  for (const [i, col] of list('identity.columns', identity.columns).entries())
    for (const k of list(`identity.columns.${i}`, col)) {
      if (!has(k)) err('identity.columns', `campo '${k}' não existe`)
      if (restricted.has(k))
        err('identity.columns', `campo '${k}' é de seção com leitura restrita`)
    }
  if (identity.emblem)
    oneOf('identity.emblem', identity.emblem, REGISTRY.emblems, 'emblem')
  if (identity.chipFormat) {
    text('identity.chipFormat', identity.chipFormat, 60)
    if (typeof identity.chipFormat === 'string')
      for (const m of identity.chipFormat.matchAll(/\{([a-zA-Z0-9]+)\}/g))
        if (!has(m[1])) err('identity.chipFormat', `campo '${m[1]}' não existe`)
  }

  const accent = rec(t.accent)
  if (accent?.from && !has(accent.from))
    err('accent.from', `campo '${accent.from}' não existe`)
  const accentOptions = asArray(field(accent?.from)?.options).map(
    o => rec(o)?.id
  )
  for (const [k, v] of Object.entries(rec(accent?.map) ?? {})) {
    if (!accentOk(v))
      err(`accent.map.${k}`, `'${v}' não é um accent-N da paleta validada`)
    if (!accentOptions.includes(k))
      err(`accent.map.${k}`, 'não é uma opção do campo de origem')
  }
  if (!accentOk(accent?.fallback))
    err('accent.fallback', 'precisa ser accent-neutral ou accent-N')

  if (!Array.isArray(t.dock) || t.dock.length < 1 || t.dock.length > 3)
    err('dock', 'de 1 a 3 campos')
  for (const d of asArray(t.dock)) {
    const type = field(d)?.type
    if (!has(d)) err('dock', `campo '${d}' não existe`)
    else if (!PLAYABLE.includes(type))
      err('dock', `tipo '${type}' não cabe no dock`)
    if (restricted.has(d))
      err('dock', `campo '${d}' é de seção com leitura restrita`)
  }

  keys('roll', t.roll ?? {}, KEYS.roll)
  const r = rec(t.roll) ?? {}
  oneOf('roll.model', r.model, REGISTRY.rollModels, 'roll.model')
  text('roll.label', r.label, 24)
  if (r.die != null) oneOf('roll.die', r.die, REGISTRY.dice, 'dado')
  if (r.dice != null)
    oneOf('roll.dice', r.dice, REGISTRY.diceNotation, 'notação')
  if (r.difficulty) {
    const difficulty = rec(r.difficulty)
    num('roll.difficulty.min', difficulty?.min, 1, 100)
    num('roll.difficulty.max', difficulty?.max, 1, 100)
    num('roll.difficulty.default', difficulty?.default, 1, 100)
  }
  if (r.target) {
    const target = rec(r.target)
    text('roll.target.label', target?.label, 24)
    num('roll.target.min', target?.min, -10, 100)
    num('roll.target.max', target?.max, -10, 100)
    num('roll.target.default', target?.default, -10, 100)
  }
  if (r.bonusDice) {
    const bonusDice = rec(r.bonusDice)
    num('roll.bonusDice.min', bonusDice?.min, -3, 0)
    num('roll.bonusDice.max', bonusDice?.max, 0, 3)
  }
  const slots = objs('roll.slots', r.slots)
  for (const sl of slots) {
    text(`roll.slots.${sl.id}.label`, sl.label)
    for (const s of list(`roll.slots.${sl.id}.from`, sl.from))
      if (!sectionIds.has(s))
        err(`roll.slots.${sl.id}`, `seção '${s}' não existe`)
  }
  const boosts = objs('roll.boosts', r.boosts)
  for (const b of boosts) {
    oneOf(
      `roll.boosts.${b.id}.effect`,
      b.effect,
      REGISTRY.boostEffects,
      'efeito'
    )
    if (!has(b.resource)) err(`roll.boosts.${b.id}`, 'recurso não existe')
    num(`roll.boosts.${b.id}.cost`, b.cost, 0, 10)
  }
  if (r.specialty)
    oneOf(
      'roll.specialty',
      r.specialty,
      REGISTRY.specialtyRules,
      'regra de especialização'
    )
  const penalty = rec(r.penalty)
  if (penalty?.field && !has(penalty.field))
    err('roll.penalty', 'campo não existe')
  const conditions = rec(r.conditions)
  if (conditions?.field && !has(conditions.field))
    err('roll.conditions', 'campo não existe')
  const presets = objs('roll.presets', r.presets)
  for (const pr of presets) {
    text(`roll.presets.${pr.id}.label`, pr.label)
    for (const fid of Object.values(rec(pr.slots) ?? {}))
      if (!has(fid)) err(`roll.presets.${pr.id}`, `campo '${fid}' não existe`)
  }
  if (r.ladder && !own(t.ladders, r.ladder))
    err('roll.ladder', 'escada não declarada')

  for (const a of objs('actions', t.actions)) {
    text(`actions.${a.id}.label`, a.label)
    oneOf(`actions.${a.id}.effect`, a.effect, REGISTRY.effects, 'effect')
    if (a.effect === 'resource.spend' || a.effect === 'resource.gain') {
      const params = rec(a.params)
      if (!has(params?.field) || field(params?.field)?.type !== 'resource')
        err(`actions.${a.id}.params.field`, 'precisa apontar para um resource')
      num(`actions.${a.id}.params.amount`, params?.amount, 1, 100)
    }
  }

  // Referências cruzadas que o JSON Schema não consegue expressar.
  if (
    penalty?.field &&
    has(penalty.field) &&
    field(penalty.field)?.rule !== 'wod-stacking'
  )
    err(
      'roll.penalty.field',
      'precisa ser uma trilha com níveis e penalidade (wod-stacking)'
    )
  // O atalho só fixa o que o slot ofereceria: um campo fora das seções do
  // slot deixaria o atalho sempre indisponível
  const sectionFields = (id: unknown): unknown[] => {
    const sec = sections.find(x => x.id === id)
    return sec
      ? [
          ...asArray(sec.fields),
          ...asArray(sec.groups).flatMap(g => asArray(rec(g)?.fields)),
        ]
      : []
  }
  for (const pr of presets)
    for (const [k, fid] of Object.entries(rec(pr.slots) ?? {})) {
      const sl = slots.find(x => x.id === k)
      if (!sl)
        err(`roll.presets.${pr.id}.slots.${k}`, 'slot inexistente na rolagem')
      else if (
        has(fid) &&
        !asArray(sl.from).some(sid => sectionFields(sid).includes(fid))
      )
        err(
          `roll.presets.${pr.id}.slots.${k}`,
          `campo '${fid}' fora das seções do slot`
        )
    }
  for (const b of boosts) {
    const models =
      typeof b.effect === 'string' && Object.hasOwn(BOOST_MODELS, b.effect)
        ? BOOST_MODELS[b.effect]
        : undefined
    if (models && !models.includes(r.model))
      err(
        `roll.boosts.${b.id}`,
        `efeito '${b.effect}' não se aplica ao modelo ${r.model} (gastaria o recurso sem efeito)`
      )
  }
  // health.heal: no sheet de um recurso (paga o custo) ou no menu da ficha
  // (Regenerar, sem custo)
  const checkHeal = (p: string, a: Obj | undefined) => {
    if (a?.effect !== 'health.heal') return
    const params = rec(a.params)
    const track = field(params?.field)
    if (!track || track.rule !== 'wod-stacking') {
      err(`${p}.params.field`, 'precisa ser uma trilha wod-stacking')
      return
    }
    const typeIds = asArray(track.types).map(x => rec(x)?.id)
    for (const ty of asArray(params?.types))
      if (!typeIds.includes(ty))
        err(`${p}.params.types`, `tipo '${ty}' não existe na trilha`)
  }
  for (const a of asArray(t.actions).map(rec)) checkHeal(`actions.${a?.id}`, a)
  for (const [fid, raw] of Object.entries(fields)) {
    const f = rec(raw)
    if (!f) continue
    for (const a of asArray(f.actions).map(rec))
      checkHeal(`fields.${fid}.actions.${a?.id}`, a)
    if (f.type === 'track' && f.rule === 'boxes')
      for (const row of asArray(f.rows).map(rec)) {
        const boxValues = row?.boxValues
        if (
          boxValues &&
          (!Array.isArray(boxValues) || boxValues.length !== row?.boxes)
        )
          err(
            `fields.${fid}.rows.${row?.id}.boxValues`,
            'precisa ter um valor por caixa'
          )
      }
    if (f.type === 'clock' && f.rule === 'mage-quint-paradox') {
      const from = asArray(f.fills)
        .map(x => rec(x)?.from)
        .sort()
        .join(',')
      if (from !== 'end,start')
        err(
          `fields.${fid}.fills`,
          'a regra precisa de um preenchimento do início e um do fim'
        )
    }
  }
  for (const s of sections) {
    if (s.layout !== 'pyramid') continue
    for (const fid of asArray(s.fields)) {
      const pf = field(fid)
      if (pf?.type !== 'number' || pf?.display !== 'ladder')
        err(
          `sections.${s.id}`,
          `pirâmide aceita só number com escada ('${fid}')`
        )
    }
  }
  for (const [name, states] of Object.entries(rec(t.markStates) ?? {})) {
    if (!Array.isArray(states) || rec(states[0])?.id !== 'none')
      err(
        `markStates.${name}`,
        "o primeiro estado precisa ser 'none' (sem marca)"
      )
  }
}
