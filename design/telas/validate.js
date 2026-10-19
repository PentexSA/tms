// Gerado por design/scripts/build.mjs a partir de scripts/validate.mjs. Não edite à mão.
;(() => {
// Validação do contrato de template e de sheet_data.
//
// É a especificação executável das regras de segurança do contrato (§3.6 da avaliação):
// tudo o que o template pode referenciar por nome (type, derive, rule, effect, roll.model...)
// vem de uma lista fechada registrada no código. Nada é avaliado como expressão: não há eval
// nem new Function. Rótulos são texto puro. Cores são só referências a accent-N.
//
// Na implementação, este mesmo validador roda no cliente (conveniência) e no servidor
// (autoridade) a cada escrita em sheet_data. Fail secure: chave desconhecida, tipo sem
// validador ou valor malformado viram erro, nunca "passa".

const REGISTRY = {
  fieldTypes: ['rating', 'number', 'percent', 'resource', 'track', 'slots', 'clock', 'state', 'mark', 'text', 'longText', 'choice', 'tags', 'list'],
  numberDisplays: ['plain', 'score+mod', 'signed', 'ladder'],
  percentDisplays: ['percent', 'percent+half+fifth'],
  derive: ['abilityModifier', 'proficiencyBonus', 'dnd5eCheckBonus', 'vtmBloodPool', 'vtmBloodPerTurn', 'vtmGeneration', 'cocHitPoints', 'cocMagicPoints', 'cocSanityMax', 'half', 'fifth'],
  trackRules: ['wod-stacking', 'boxes'],
  resourceRules: ['tempFirst'],
  clockRules: ['mage-quint-paradox'],
  atZero: ['deathSaves'],
  effects: ['health.heal', 'resource.spend', 'resource.gain', 'rest.long', 'rest.short'],
  rollModels: ['pool-success', 'sum-vs-target', 'roll-under-percent', 'fudge', 'pbta-2d6'],
  dice: [2, 3, 4, 6, 8, 10, 12, 20, 100],
  diceNotation: ['1d20', '2d6', '1d100', '4dF'],
  boostEffects: ['autoSuccess', 'plus2'],
  specialtyRules: ['tenCountsDouble'],
  colorRoles: ['accent', 'alt-cool', 'alt-warm', 'neutral'],
  zones: ['identity', 'play', 'build', 'powers', 'lore'],
  layouts: ['grid', 'groups', 'list', 'pyramid', 'fields', 'facts', 'text'],
  filterRules: ['invested', 'proficient', 'aboveBase'],
  modes: ['play', 'edit'],
  roles: ['owner', 'storyteller', 'player'],
  defaultActions: ['spend1', 'gain1', 'damage1', 'use1'],
  modifierOps: ['add', 'set'],
  conditionRoll: ['advantage', 'disadvantage'],
  glyphs: ['augur-moon'],
  skins: ['wod', 'dnd', 'coc', 'fate'],
  slotResets: ['longRest', 'shortRest'],
}

// Chaves permitidas (allowlist). Chave desconhecida é erro: impede atributos como "onclick"
// ou campos que o renderizador ignoraria e algum código futuro poderia interpretar.
const KEYS = {
  template: ['schema', 'system', 'name', 'family', 'edition', 'templateVersion', 'locale', 'skin', 'license', 'identity', 'accent', 'fields', 'markStates', 'ladders', 'sections', 'zoneLabels', 'dock', 'roll', 'actions'],
  fieldCommon: ['type', 'label', 'shortLabel', 'help', 'editableIn', 'specialty', 'sublabel', 'badge', 'readOnly', 'derive', 'from'],
  field: {
    rating: ['min', 'max', 'default', 'cap', 'valueLabels'],
    number: ['min', 'max', 'default', 'display', 'ladder', 'suffix', 'allowInput'],
    percent: ['display', 'base', 'max'],
    resource: ['max', 'permanent', 'temp', 'rule', 'atZero', 'allowInput', 'defaultAction', 'actions', 'colorRole', 'tempUncapped', 'overMax', 'perTurn', 'spendLabel', 'gainLabel'],
    track: ['rule', 'levels', 'types', 'rows'],
    slots: ['levels', 'levelLabel', 'reset', 'defaultAction'],
    clock: ['segments', 'rule', 'fills'],
    state: ['options', 'cost'],
    mark: ['states', 'bonus'],
    text: ['maxLength', 'aspect', 'placeholder'],
    longText: ['maxLength', 'placeholder'],
    choice: ['options', 'glyph'],
    tags: ['options'],
    list: ['itemLabel', 'item', 'catalog', 'searchable', 'density', 'fixed', 'rollAs'],
  },
  section: ['id', 'zone', 'title', 'layout', 'groups', 'fields', 'filter', 'searchable', 'groupTabs', 'badge', 'permissions', 'pinTop', 'columns', 'minColWidth', 'collapsed'],
  roll: ['model', 'label', 'die', 'dice', 'slots', 'difficulty', 'penalty', 'specialty', 'boosts', 'presets', 'advantage', 'target', 'conditions', 'bonusDice', 'ladder'],
}

const ID = /^[a-zA-Z][a-zA-Z0-9-]*$/
const NUM_LIMIT = 1_000_000

// Texto puro: sem < > (nunca HTML), sem controles C0/C1 (exceto tab e quebras), sem DEL,
// sem controles bidi (U+202A–202E, U+2066–2069) e sem separadores U+2028/2029.
function isSafeText(s) {
  if (/[<>]/.test(s)) return false
  for (const ch of s) {
    const c = ch.codePointAt(0)
    if (c < 32 && c !== 9 && c !== 10 && c !== 13) return false
    if (c >= 0x7f && c <= 0x9f) return false
    if ((c >= 0x202a && c <= 0x202e) || (c >= 0x2066 && c <= 0x2069) || c === 0x2028 || c === 0x2029) return false
  }
  return true
}

const own = (o, k) => o != null && typeof o === 'object' && Object.hasOwn(o, k)
const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v)

// Derivações por nome (as mesmas do renderizador). Na implementação, um único módulo
// compartilhado entre cliente e servidor; aqui servem para conferir tetos derivados.
const BLOOD = { 4: 50, 5: 40, 6: 30, 7: 20, 8: 15, 9: 14, 10: 13, 11: 12, 12: 11, 13: 10, 14: 10, 15: 10 }
const DERIVE = {
  abilityModifier: s => Math.floor((s - 10) / 2),
  proficiencyBonus: l => 2 + Math.floor((Math.max(1, l) - 1) / 4),
  vtmBloodPool: g => BLOOD[g] ?? 10,
  vtmGeneration: d => 13 - Math.min(5, Math.max(0, d)),
  cocHitPoints: (con, siz) => Math.floor((con + siz) / 10),
  cocMagicPoints: pow => Math.floor(pow / 5),
  cocSanityMax: mythos => 99 - mythos,
  half: v => Math.floor(v / 2),
  fifth: v => Math.floor(v / 5),
}

// Item de lista pelo nome ({ list, item }): os pontos dele, ou 0 sem o item.
const isItemRef = x => isObj(x) && typeof x.list === 'string' && typeof x.item === 'string'
const itemValue = (values, ref) => {
  const it = (Array.isArray(values[ref.list]) ? values[ref.list] : []).find(i => i?.name === ref.item)
  return Number.isInteger(it?.value) ? it.value : 0
}
const input = (t, values, x, depth) => (isItemRef(x) ? itemValue(values, x) : numberOf(t, values, x, depth))

// Número de um campo a partir dos valores gravados (sem modificadores de estado).
function numberOf(t, values, id, depth = 0) {
  const f = t.fields[id]
  if (!f || depth > 4) return 0
  if (f.readOnly && f.derive && own(DERIVE, f.derive)) return DERIVE[f.derive](...[f.from].flat().map(x => input(t, values, x, depth + 1)))
  const v = own(values, id) ? values[id] : undefined
  if (Number.isInteger(v)) return v
  if (isObj(v) && Number.isInteger(v.permanent ?? v.current)) return v.permanent ?? v.current
  return f.default ?? f.min ?? 0
}

// Teto do valor atual de um resource; null quando não há teto conhecido.
function resourceCap(t, values, f, v) {
  if (f.permanent && !f.tempUncapped) return v.permanent
  if (f.overMax) return null
  if (typeof f.max === 'number') return f.max
  if (f.max?.stored) return v.max
  if (f.max?.field) return numberOf(t, values, f.max.field)
  if (f.max?.derive && own(DERIVE, f.max.derive)) return DERIVE[f.max.derive](...[f.max.from].flat().map(x => input(t, values, x, 0)))
  return null
}

function validateTemplate(t, palette) {
  const errors = []
  const err = (path, msg) => errors.push(`${t?.system ?? '?'} ${path}: ${msg}`)
  if (!isObj(t)) return ['template malformado']
  const text = (path, v, max = 200) => {
    if (typeof v !== 'string' || !v.length) return err(path, 'texto obrigatório')
    if (v.length > max) err(path, `texto acima de ${max} caracteres`)
    if (!isSafeText(v)) err(path, 'texto com caracteres proibidos (< >, controle ou bidi): rótulo é texto, nunca HTML')
  }
  const oneOf = (path, v, list, what) => {
    if (!list.includes(v)) err(path, `${what} '${v}' fora da lista fechada`)
  }
  const keys = (path, o, allowed) => {
    if (!isObj(o)) return err(path, 'precisa ser objeto')
    for (const k of Object.keys(o)) if (!allowed.includes(k)) err(`${path}.${k}`, 'chave desconhecida (rejeitada)')
  }
  const num = (path, v, min = -NUM_LIMIT, max = NUM_LIMIT) => {
    if (v == null) return
    if (!Number.isInteger(v) || v < min || v > max) err(path, `precisa ser inteiro entre ${min} e ${max}`)
  }
  const fields = isObj(t.fields) ? t.fields : {}
  const has = id => own(fields, id)
  const sources = (path, from) => {
    for (const src of [from].flat().filter(Boolean)) {
      if (!isItemRef(src)) { if (!has(src)) err(path, `campo '${src}' não existe`); continue }
      const l = has(src.list) ? fields[src.list] : undefined
      if (l?.type !== 'list') err(path, `campo '${src.list}' não é uma lista`)
      else if (Array.isArray(l.catalog) && !l.catalog.includes(src.item)) err(path, `'${src.item}' não está no catálogo de '${src.list}'`)
    }
  }
  const accentOk = v => v === 'accent-neutral' || palette.includes(v)

  // Toda string do template, em qualquer profundidade, é texto puro e limitada.
  const walk = (path, v, depth = 0) => {
    if (depth > 12) return err(path, 'aninhamento profundo demais')
    if (typeof v === 'string') {
      if (v.length > 1000) err(path, 'texto acima de 1000 caracteres')
      if (!isSafeText(v)) err(path, 'texto com caracteres proibidos (< >, controle ou bidi)')
    } else if (Array.isArray(v)) v.forEach((x, i) => walk(`${path}.${i}`, x, depth + 1))
    else if (isObj(v)) for (const [k, x] of Object.entries(v)) { if (k === '__proto__' || k === 'constructor' || k === 'prototype') err(`${path}.${k}`, 'chave proibida'); walk(`${path}.${k}`, x, depth + 1) }
  }
  walk('', t)

  keys('template', t, KEYS.template)
  if (t.schema !== 1) err('schema', 'versão de schema desconhecida')
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(t.system ?? '')) err('system', 'código de sistema inválido (kebab-case; a edição faz parte do código, ex.: vtm-v20)')
  text('name', t.name)
  oneOf('skin', t.skin, REGISTRY.skins, 'skin')
  if (!/^\d+\.\d+\.\d+$/.test(t.templateVersion ?? '')) err('templateVersion', 'use semver')

  for (const [id, f] of Object.entries(fields)) {
    const p = `fields.${id}`
    if (!ID.test(id)) err(p, 'id inválido')
    if (!isObj(f)) { err(p, 'campo malformado'); continue }
    oneOf(`${p}.type`, f.type, REGISTRY.fieldTypes, 'type')
    keys(p, f, [...KEYS.fieldCommon, ...(KEYS.field[f.type] ?? [])])
    text(`${p}.label`, f.label)
    if (f.shortLabel) text(`${p}.shortLabel`, f.shortLabel, 16)
    if (f.help) text(`${p}.help`, f.help, 400)
    for (const m of f.editableIn ?? []) oneOf(`${p}.editableIn`, m, REGISTRY.modes, 'modo')
    if (f.colorRole) oneOf(`${p}.colorRole`, f.colorRole, REGISTRY.colorRoles, 'colorRole')
    if (f.defaultAction) oneOf(`${p}.defaultAction`, f.defaultAction, REGISTRY.defaultActions, 'defaultAction')
    if (f.derive) oneOf(`${p}.derive`, f.derive, REGISTRY.derive, 'derive')
    sources(`${p}.from`, f.from)
    if (f.badge && !has(f.badge.field)) err(`${p}.badge.field`, `campo '${f.badge.field}' não existe`)
    if (f.maxLength != null) num(`${p}.maxLength`, f.maxLength, 1, 20000)
    if (f.default != null) num(`${p}.default`, f.default, f.min ?? (f.type === 'rating' ? 0 : -NUM_LIMIT), f.max ?? (f.type === 'rating' ? 10 : NUM_LIMIT))
    if (f.spendLabel) text(`${p}.spendLabel`, f.spendLabel, 24)
    if (f.gainLabel) text(`${p}.gainLabel`, f.gainLabel, 24)
    if (f.type === 'rating') {
      num(`${p}.min`, f.min, 0, 10)
      num(`${p}.max`, f.max, 1, 10)
      if (f.cap) {
        if (!has(f.cap.field)) err(`${p}.cap.field`, `campo '${f.cap.field}' não existe`)
        else if (!['rating', 'number'].includes(fields[f.cap.field].type)) err(`${p}.cap.field`, 'o teto precisa ser rating ou number')
      }
    }
    if (f.type === 'number') {
      num(`${p}.min`, f.min)
      num(`${p}.max`, f.max)
      if (f.display) oneOf(`${p}.display`, f.display, REGISTRY.numberDisplays, 'display')
      if (f.display === 'ladder' && !own(t.ladders, f.ladder)) err(`${p}.ladder`, `escada '${f.ladder}' não declarada em ladders`)
      if (f.suffix) text(`${p}.suffix`, f.suffix, 24)
    }
    if (f.type === 'percent') {
      if (f.display) oneOf(`${p}.display`, f.display, REGISTRY.percentDisplays, 'display')
      num(`${p}.max`, f.max, 1, 100)
      if (typeof f.base === 'number') num(`${p}.base`, f.base, 0, 100)
      else if (isObj(f.base)) {
        if (f.base.field && !has(f.base.field)) err(`${p}.base`, `campo '${f.base.field}' não existe`)
        if (f.base.derive) oneOf(`${p}.base.derive`, f.base.derive, REGISTRY.derive, 'derive')
      }
    }
    if (f.type === 'resource') {
      if (f.rule) oneOf(`${p}.rule`, f.rule, REGISTRY.resourceRules, 'rule')
      if (f.atZero) oneOf(`${p}.atZero`, f.atZero, REGISTRY.atZero, 'atZero')
      const max = f.max
      if (typeof max === 'number') num(`${p}.max`, max, 1, 9999)
      else if (isObj(max)) {
        if (max.derive) oneOf(`${p}.max.derive`, max.derive, REGISTRY.derive, 'derive')
        sources(`${p}.max.from`, max.from)
        if (max.field && !has(max.field)) err(`${p}.max.field`, `campo '${max.field}' não existe`)
        if (max.stored) { num(`${p}.max.min`, max.min, 0, 9999); num(`${p}.max.max`, max.max, 1, 9999) }
      }
      if (f.permanent) { num(`${p}.permanent.min`, f.permanent.min, 0, 100); num(`${p}.permanent.max`, f.permanent.max, 1, 100) }
      if (f.perTurn?.derive) oneOf(`${p}.perTurn.derive`, f.perTurn.derive, REGISTRY.derive, 'derive')
      for (const a of f.actions ?? []) {
        text(`${p}.actions.${a.id}.label`, a.label)
        oneOf(`${p}.actions.${a.id}.effect`, a.effect, REGISTRY.effects, 'effect')
        num(`${p}.actions.${a.id}.cost`, a.cost, 0, 100)
        if (a.params?.field && !has(a.params.field)) err(`${p}.actions.${a.id}.params.field`, `campo '${a.params.field}' não existe`)
      }
    }
    if (f.type === 'track') {
      oneOf(`${p}.rule`, f.rule, REGISTRY.trackRules, 'rule')
      if (f.rule === 'wod-stacking') {
        if (!Array.isArray(f.levels) || !f.levels.length || f.levels.length > 20) err(`${p}.levels`, 'wod-stacking precisa de 1 a 20 levels')
        for (const [i, l] of (f.levels ?? []).entries()) { text(`${p}.levels.${i}.label`, l.label); if (l.penalty !== null) num(`${p}.levels.${i}.penalty`, l.penalty, -10, 0) }
        if (!Array.isArray(f.types) || !f.types.length) err(`${p}.types`, 'declare os tipos de dano em ordem de gravidade')
        for (const ty of f.types ?? []) { if (!ID.test(ty.id ?? '')) err(`${p}.types`, 'id inválido'); text(`${p}.types.${ty.id}.label`, ty.label); text(`${p}.types.${ty.id}.glyph`, ty.glyph, 3) }
      }
      if (f.rule === 'boxes') {
        for (const r of f.rows ?? []) {
          text(`${p}.rows.${r.id}.label`, r.label)
          if (!Number.isInteger(r.boxes) || r.boxes < 1 || r.boxes > 20) err(`${p}.rows.${r.id}.boxes`, 'entre 1 e 20')
        }
      }
    }
    if (f.type === 'clock') {
      oneOf(`${p}.rule`, f.rule, REGISTRY.clockRules, 'rule')
      if (!Number.isInteger(f.segments) || f.segments < 2 || f.segments > 24) err(`${p}.segments`, 'entre 2 e 24')
      for (const fill of f.fills ?? []) { text(`${p}.fills.${fill.id}.label`, fill.label); oneOf(`${p}.fills.${fill.id}.colorRole`, fill.colorRole, REGISTRY.colorRoles, 'colorRole') }
    }
    if (f.type === 'slots') {
      num(`${p}.levels`, f.levels, 1, 9)
      if (f.reset) oneOf(`${p}.reset`, f.reset, REGISTRY.slotResets, 'reset')
    }
    if (f.type === 'state') {
      for (const o of f.options ?? []) {
        text(`${p}.options.${o.id}.label`, o.label)
        for (const m of o.modifiers ?? []) {
          if (!has(m.field)) err(`${p}.options.${o.id}.modifiers`, `campo '${m.field}' não existe`)
          oneOf(`${p}.options.${o.id}.modifiers.op`, m.op, REGISTRY.modifierOps, 'op')
          num(`${p}.options.${o.id}.modifiers.value`, m.value, -20, 20)
          if (!Number.isInteger(m.value)) err(`${p}.options.${o.id}.modifiers.value`, 'precisa ser inteiro')
        }
      }
      if (f.cost && !has(f.cost.resource)) err(`${p}.cost.resource`, `campo '${f.cost.resource}' não existe`)
    }
    if (f.type === 'mark') {
      if (!own(t.markStates, f.states)) err(`${p}.states`, `conjunto '${f.states}' não declarado em markStates`)
      if (f.bonus) { oneOf(`${p}.bonus.derive`, f.bonus.derive, REGISTRY.derive, 'derive'); if (!has(f.bonus.ability)) err(`${p}.bonus.ability`, 'campo não existe') }
    }
    if (['choice', 'tags'].includes(f.type)) {
      for (const o of f.options ?? []) { if (!ID.test(o.id ?? '')) err(`${p}.options`, `id '${o.id}' inválido`); text(`${p}.options.${o.id}.label`, o.label) }
      for (const o of f.options ?? []) if (o.roll) oneOf(`${p}.options.${o.id}.roll`, o.roll, REGISTRY.conditionRoll, 'roll')
      if (f.glyph) oneOf(`${p}.glyph`, f.glyph, REGISTRY.glyphs, 'glyph')
    }
    if (f.type === 'list') {
      for (const c of f.catalog ?? []) text(`${p}.catalog`, c, 80)
      for (const m of f.item?.meta ?? []) text(`${p}.item.meta.${m.id}.label`, m.label)
      if (f.item?.value) { num(`${p}.item.value.min`, f.item.value.min, 0, 10); num(`${p}.item.value.max`, f.item.value.max, 1, 10) }
    }
  }

  const sectionIds = new Set()
  const restricted = new Set()
  for (const s of t.sections ?? []) {
    const p = `sections.${s.id}`
    keys(p, s, KEYS.section)
    if (!ID.test(s.id ?? '')) err(p, 'id inválido')
    if (sectionIds.has(s.id)) err(p, 'id repetido')
    sectionIds.add(s.id)
    oneOf(`${p}.zone`, s.zone, REGISTRY.zones, 'zona')
    oneOf(`${p}.layout`, s.layout, REGISTRY.layouts, 'layout')
    text(`${p}.title`, s.title)
    num(`${p}.columns`, s.columns, 1, 6)
    num(`${p}.minColWidth`, s.minColWidth, 120, 600)
    const ids = [...(s.fields ?? []), ...(s.groups ?? []).flatMap(g => g.fields)]
    for (const g of s.groups ?? []) text(`${p}.groups.${g.id}.title`, g.title)
    for (const id of ids) if (!has(id)) err(`${p}`, `campo '${id}' não existe`)
    if (s.filter) { oneOf(`${p}.filter.rule`, s.filter.rule, REGISTRY.filterRules, 'filtro'); text(`${p}.filter.label`, s.filter.label) }
    if (s.badge && !has(s.badge.field)) err(`${p}.badge`, `campo '${s.badge.field}' não existe`)
    for (const r of [...(s.permissions?.read ?? []), ...(s.permissions?.write ?? [])]) oneOf(`${p}.permissions`, r, REGISTRY.roles, 'papel')
    if (s.permissions?.read) for (const id of ids) restricted.add(id)
  }

  // Abas: o app mostra uma aba por zona (build, powers, lore). O template só pode trocar o rótulo
  // da aba, curto o bastante para as 3 caberem a 360 dp com fonte grande.
  if (t.zoneLabels != null) {
    keys('zoneLabels', t.zoneLabels, ['build', 'powers', 'lore'])
    for (const [z, label] of Object.entries(isObj(t.zoneLabels) ? t.zoneLabels : {})) text(`zoneLabels.${z}`, label, 14)
  }

  // O que aparece fora da ficha (header, lista de personagens, mesa, dock) não pode vir
  // de seção com leitura restrita: senão vazaria para quem não pode ler a seção.
  const id = t.identity ?? {}
  for (const k of ['name', 'chip', 'subtitle', 'voice']) {
    if (id[k] && !has(id[k])) err(`identity.${k}`, `campo '${id[k]}' não existe`)
    if (id[k] && restricted.has(id[k])) err(`identity.${k}`, 'campo de seção com leitura restrita')
  }
  for (const k of id.summary ?? []) {
    if (!has(k)) err('identity.summary', `campo '${k}' não existe`)
    if (restricted.has(k)) err('identity.summary', `campo '${k}' é de seção com leitura restrita`)
  }
  for (const k of (id.columns ?? []).flat()) {
    if (!has(k)) err('identity.columns', `campo '${k}' não existe`)
    if (restricted.has(k)) err('identity.columns', `campo '${k}' é de seção com leitura restrita`)
  }
  if (id.chipFormat) {
    text('identity.chipFormat', id.chipFormat, 60)
    for (const m of id.chipFormat.matchAll(/\{([a-zA-Z0-9]+)\}/g)) if (!has(m[1])) err('identity.chipFormat', `campo '${m[1]}' não existe`)
  }

  if (t.accent?.from && !has(t.accent.from)) err('accent.from', `campo '${t.accent.from}' não existe`)
  for (const [k, v] of Object.entries(t.accent?.map ?? {})) {
    if (!accentOk(v)) err(`accent.map.${k}`, `'${v}' não é um accent-N da paleta validada`)
    const opts = fields[t.accent.from]?.options?.map(o => o.id) ?? []
    if (!opts.includes(k)) err(`accent.map.${k}`, 'não é uma opção do campo de origem')
  }
  if (!accentOk(t.accent?.fallback)) err('accent.fallback', 'precisa ser accent-neutral ou accent-N')

  const playable = ['resource', 'track', 'slots', 'clock', 'state', 'number', 'list', 'tags', 'rating']
  if (!Array.isArray(t.dock) || t.dock.length < 1 || t.dock.length > 3) err('dock', 'de 1 a 3 campos')
  for (const d of t.dock ?? []) {
    if (!has(d)) err('dock', `campo '${d}' não existe`)
    else if (!playable.includes(fields[d].type)) err('dock', `tipo '${fields[d].type}' não cabe no dock`)
    if (restricted.has(d)) err('dock', `campo '${d}' é de seção com leitura restrita`)
  }

  const r = t.roll ?? {}
  keys('roll', r, KEYS.roll)
  oneOf('roll.model', r.model, REGISTRY.rollModels, 'roll.model')
  text('roll.label', r.label, 24)
  if (r.die != null) oneOf('roll.die', r.die, REGISTRY.dice, 'dado')
  if (r.dice != null) oneOf('roll.dice', r.dice, REGISTRY.diceNotation, 'notação')
  if (r.difficulty) { num('roll.difficulty.min', r.difficulty.min, 1, 100); num('roll.difficulty.max', r.difficulty.max, 1, 100); num('roll.difficulty.default', r.difficulty.default, 1, 100) }
  if (r.target) { text('roll.target.label', r.target.label, 24); num('roll.target.min', r.target.min, -10, 100); num('roll.target.max', r.target.max, -10, 100); num('roll.target.default', r.target.default, -10, 100) }
  if (r.bonusDice) { num('roll.bonusDice.min', r.bonusDice.min, -3, 0); num('roll.bonusDice.max', r.bonusDice.max, 0, 3) }
  for (const sl of r.slots ?? []) { text(`roll.slots.${sl.id}.label`, sl.label); for (const s of sl.from ?? []) if (!sectionIds.has(s)) err(`roll.slots.${sl.id}`, `seção '${s}' não existe`) }
  for (const b of r.boosts ?? []) { oneOf(`roll.boosts.${b.id}.effect`, b.effect, REGISTRY.boostEffects, 'efeito'); if (!has(b.resource)) err(`roll.boosts.${b.id}`, 'recurso não existe'); num(`roll.boosts.${b.id}.cost`, b.cost, 0, 10) }
  if (r.specialty) oneOf('roll.specialty', r.specialty, REGISTRY.specialtyRules, 'regra de especialização')
  if (r.penalty?.field && !has(r.penalty.field)) err('roll.penalty', 'campo não existe')
  if (r.conditions?.field && !has(r.conditions.field)) err('roll.conditions', 'campo não existe')
  for (const pr of r.presets ?? []) { text(`roll.presets.${pr.id}.label`, pr.label); for (const fid of Object.values(pr.slots ?? {})) if (!has(fid)) err(`roll.presets.${pr.id}`, `campo '${fid}' não existe`) }
  if (r.ladder && !own(t.ladders, r.ladder)) err('roll.ladder', 'escada não declarada')

  for (const a of t.actions ?? []) {
    text(`actions.${a.id}.label`, a.label)
    oneOf(`actions.${a.id}.effect`, a.effect, REGISTRY.effects, 'effect')
    if (['resource.spend', 'resource.gain'].includes(a.effect)) {
      if (!has(a.params?.field) || fields[a.params.field].type !== 'resource') err(`actions.${a.id}.params.field`, 'precisa apontar para um resource')
      num(`actions.${a.id}.params.amount`, a.params?.amount, 1, 100)
    }
  }

  // Referências cruzadas que o JSON Schema não consegue expressar.
  if (r.penalty?.field && has(r.penalty.field) && fields[r.penalty.field].rule !== 'wod-stacking') err('roll.penalty.field', 'precisa ser uma trilha com níveis e penalidade (wod-stacking)')
  const slotIds = (r.slots ?? []).map(sl => sl.id)
  for (const pr of r.presets ?? []) for (const k of Object.keys(pr.slots ?? {})) if (!slotIds.includes(k)) err(`roll.presets.${pr.id}.slots.${k}`, 'slot inexistente na rolagem')
  const boostModel = { autoSuccess: ['pool-success'], plus2: ['fudge'] }
  for (const b of r.boosts ?? []) if (boostModel[b.effect] && !boostModel[b.effect].includes(r.model)) err(`roll.boosts.${b.id}`, `efeito '${b.effect}' não se aplica ao modelo ${r.model} (gastaria o recurso sem efeito)`)
  for (const [fid, f] of Object.entries(fields)) {
    for (const a of f.actions ?? []) {
      if (a.effect !== 'health.heal') continue
      const track = fields[a.params?.field]
      if (!track || track.rule !== 'wod-stacking') { err(`fields.${fid}.actions.${a.id}.params.field`, 'precisa ser uma trilha wod-stacking'); continue }
      for (const ty of a.params.types ?? []) if (!track.types.some(x => x.id === ty)) err(`fields.${fid}.actions.${a.id}.params.types`, `tipo '${ty}' não existe na trilha`)
    }
    if (f.type === 'track' && f.rule === 'boxes') for (const row of f.rows ?? []) if (row.boxValues && row.boxValues.length !== row.boxes) err(`fields.${fid}.rows.${row.id}.boxValues`, 'precisa ter um valor por caixa')
    if (f.type === 'clock' && f.rule === 'mage-quint-paradox') {
      const from = (f.fills ?? []).map(x => x.from).sort().join(',')
      if (from !== 'end,start') err(`fields.${fid}.fills`, 'a regra precisa de um preenchimento do início e um do fim')
    }
  }
  for (const s of t.sections ?? []) {
    if (s.layout !== 'pyramid') continue
    for (const fid of s.fields ?? []) if (fields[fid]?.type !== 'number' || fields[fid]?.display !== 'ladder') err(`sections.${s.id}`, `pirâmide aceita só number com escada ('${fid}')`)
  }
  for (const [name, states] of Object.entries(t.markStates ?? {})) {
    if (!Array.isArray(states) || states[0]?.id !== 'none') err(`markStates.${name}`, "o primeiro estado precisa ser 'none' (sem marca)")
  }
  return errors
}

// Valida sheet_data contra o template. O servidor aplica isto a cada escrita.
function validateSheet(t, sheet, who = '?') {
  const errors = []
  const err = (path, msg) => errors.push(`${who} ${path}: ${msg}`)
  if (!isObj(sheet) || !isObj(sheet.values)) return [`${who}: sheet_data malformado (esperado { values, specialties })`]
  for (const k of Object.keys(sheet)) if (!['values', 'specialties'].includes(k)) err(k, 'chave desconhecida (rejeitada)')
  const fields = t.fields
  const int = (p, v, min, max) => {
    if (!Number.isInteger(v)) return err(p, 'precisa ser inteiro')
    if (min != null && v < min) err(p, `abaixo do mínimo ${min}`)
    if (max != null && v > max) err(p, `acima do máximo ${max}`)
  }
  const str = (p, v, max) => {
    if (typeof v !== 'string') return err(p, 'precisa ser texto')
    if (v.length > max) err(p, `acima de ${max} caracteres`)
  }
  const onlyKeys = (p, v, allowed) => {
    if (!isObj(v)) return err(p, 'precisa ser objeto') || false
    for (const k of Object.keys(v)) if (!allowed.includes(k)) err(`${p}.${k}`, 'chave desconhecida (rejeitada)')
    return true
  }
  const textMax = f => f.maxLength ?? (f.type === 'longText' ? 4000 : 200)

  for (const [id, v] of Object.entries(sheet.values)) {
    const p = `values.${id}`
    if (!own(fields, id)) { err(p, 'campo não existe no template (rejeitado)'); continue }
    const f = fields[id]
    if (f.readOnly) { err(p, 'campo derivado: o servidor calcula, o cliente não grava'); continue }
    try {
      switch (f.type) {
        case 'rating': int(p, v, f.min ?? 0, f.max ?? 5); break
        case 'number': int(p, v, f.min ?? -NUM_LIMIT, f.max ?? NUM_LIMIT); break
        case 'percent': int(p, v, 0, f.max ?? 99); break
        case 'text': case 'longText': str(p, v, textMax(f)); break
        case 'choice': if (!f.options.some(o => o.id === v)) err(p, 'opção inexistente'); break
        case 'state': if (!f.options.some(o => o.id === v)) err(p, 'estado inexistente'); break
        case 'mark': if (!t.markStates[f.states].some(s => s.id === v)) err(p, 'marca inexistente'); break
        case 'tags':
          if (!Array.isArray(v) || v.length > f.options.length || new Set(v).size !== v.length || v.some(x => !f.options.some(o => o.id === x))) err(p, 'tags inválidas')
          break
        case 'resource': {
          if (!onlyKeys(p, v, ['current', 'max', 'permanent', 'temp'])) break
          int(`${p}.current`, v.current, 0, 9999)
          if (f.permanent) {
            int(`${p}.permanent`, v.permanent, f.permanent.min, f.permanent.max)
            if (!f.tempUncapped && v.current > v.permanent) err(`${p}.current`, 'acima do permanente')
          } else if (v.permanent != null) err(`${p}.permanent`, 'campo sem permanente')
          if (f.temp) { if (v.temp != null) int(`${p}.temp`, v.temp, 0, 9999) } else if (v.temp != null) err(`${p}.temp`, 'campo sem temporário')
          if (f.max?.stored) int(`${p}.max`, v.max, f.max.min, f.max.max)
          else if (v.max != null) err(`${p}.max`, 'o máximo é derivado: o cliente não grava')
          {
            // Teto efetivo: permanente, número fixo, máximo gravado, outro campo ou derivação.
            const cap = resourceCap(t, sheet.values, f, v)
            if (cap != null && Number.isInteger(v.current) && v.current > cap) err(`${p}.current`, `acima do máximo (${cap})`)
          }
          break
        }
        case 'track':
          if (f.rule === 'wod-stacking') {
            const kinds = f.types.map(ty => ty.id)
            if (!onlyKeys(p, v, kinds)) break
            for (const k of kinds) int(`${p}.${k}`, v[k] ?? 0, 0, f.levels.length)
            if (kinds.reduce((n, k) => n + (v[k] ?? 0), 0) > f.levels.length) err(p, 'mais dano que níveis')
          } else {
            if (!onlyKeys(p, v, f.rows.map(r => r.id))) break
            for (const r of f.rows) if (!Array.isArray(v[r.id]) || v[r.id].length !== r.boxes || v[r.id].some(b => typeof b !== 'boolean')) err(`${p}.${r.id}`, `precisa de ${r.boxes} caixas booleanas`)
          }
          break
        case 'clock': {
          if (!onlyKeys(p, v, f.fills.map(x => x.id))) break
          for (const x of f.fills) int(`${p}.${x.id}`, v[x.id] ?? 0, 0, f.segments)
          if (f.fills.reduce((n, x) => n + (v[x.id] ?? 0), 0) > f.segments) err(p, 'preenchimentos acima do número de casas')
          break
        }
        case 'slots':
          if (!isObj(v)) { err(p, 'precisa ser objeto'); break }
          for (const [lvl, s] of Object.entries(v)) {
            if (!/^[1-9]$/.test(lvl) || Number(lvl) > f.levels) { err(`${p}.${lvl}`, 'nível inexistente'); continue }
            if (!onlyKeys(`${p}.${lvl}`, s, ['max', 'used'])) continue
            int(`${p}.${lvl}.max`, s.max, 0, 9)
            int(`${p}.${lvl}.used`, s.used, 0, s.max)
          }
          break
        case 'list': {
          if (!Array.isArray(v)) { err(p, 'precisa ser lista'); break }
          if (v.length > 200) err(p, 'lista grande demais')
          const metaIds = (f.item?.meta ?? []).map(mm => mm.id)
          const fixedIds = f.fixed?.map(x => x.id)
          const seen = new Set()
          for (const [i, it] of v.entries()) {
            const q = `${p}.${i}`
            if (!onlyKeys(q, it, ['id', 'name', 'text', 'value', 'specialty', 'notes', 'meta'])) continue
            str(`${q}.id`, it.id, 40)
            if (seen.has(it.id)) err(`${q}.id`, 'id repetido')
            seen.add(it.id)
            if (fixedIds && !fixedIds.includes(it.id)) err(`${q}.id`, 'item fixo inexistente')
            if (it.name != null) str(`${q}.name`, it.name, 80)
            if (it.text != null) str(`${q}.text`, it.text, 200)
            if (it.notes != null) { if (!f.item?.notes) err(`${q}.notes`, 'lista sem notas'); else str(`${q}.notes`, it.notes, 2000) }
            if (it.specialty != null) { if (!f.item?.specialty) err(`${q}.specialty`, 'lista sem especialização'); else str(`${q}.specialty`, it.specialty, 80) }
            if (it.value != null) { if (!f.item?.value) err(`${q}.value`, 'lista sem valor'); else int(`${q}.value`, it.value, f.item.value.min ?? 0, f.item.value.max ?? 5) }
            if (it.meta != null && onlyKeys(`${q}.meta`, it.meta, metaIds)) {
              for (const mm of f.item.meta) {
                const mv = it.meta[mm.id]
                if (mv == null) continue
                if (mm.type === 'number') int(`${q}.meta.${mm.id}`, mv, mm.min ?? -NUM_LIMIT, mm.max ?? NUM_LIMIT)
                else str(`${q}.meta.${mm.id}`, mv, 80)
              }
            }
          }
          break
        }
        default:
          err(p, `tipo '${f.type}' sem validador (rejeitado)`)
      }
    } catch {
      err(p, 'valor malformado')
    }
  }
  if (sheet.specialties != null) {
    if (!isObj(sheet.specialties)) err('specialties', 'precisa ser objeto')
    else for (const [id, s] of Object.entries(sheet.specialties)) {
      if (!own(fields, id) || !fields[id].specialty) err(`specialties.${id}`, 'campo não aceita especialização')
      str(`specialties.${id}`, s, 80)
    }
  }
  return errors
}

window.TMSValidate = { REGISTRY, isSafeText, validateTemplate, validateSheet }
})()
