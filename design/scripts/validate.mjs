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

export const REGISTRY = {
  fieldTypes: ['rating', 'number', 'percent', 'resource', 'track', 'slots', 'clock', 'state', 'mark', 'text', 'longText', 'choice', 'tags', 'list'],
  numberDisplays: ['plain', 'score+mod', 'signed', 'ladder'],
  percentDisplays: ['percent', 'percent+half+fifth'],
  derive: ['abilityModifier', 'proficiencyBonus', 'dnd5eCheckBonus', 'vtmBloodPool', 'vtmBloodPerTurn', 'vtmGeneration', 'cocHitPoints', 'cocMagicPoints', 'cocSanityMax', 'half', 'fifth', 'difference', 'sum'],
  trackRules: ['wod-stacking', 'boxes'],
  resourceRules: ['tempFirst'],
  clockRules: ['mage-quint-paradox'],
  alertRules: ['track-at-level', 'resource-at-most', 'resource-below-share'],
  atZero: ['deathSaves'],
  effects: ['health.heal', 'resource.spend', 'resource.gain', 'resource.restore', 'rest.long', 'rest.short'],
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
  roles: ['owner', 'storyteller'],
  defaultActions: ['spend1', 'gain1', 'damage1', 'use1'],
  modifierOps: ['add', 'set'],
  conditionRoll: ['advantage', 'disadvantage'],
  glyphs: ['augur-moon'],
  emblems: ['ankh', 'nine-star', 'claws'],
  skins: ['wod', 'dnd', 'coc', 'fate'],
  slotResets: ['longRest', 'shortRest'],
  // Contabilização da criação e da evolução (doc/plano-v4.md §3)
  budgetRules: ['priority-budget', 'fixed-budget', 'item-count', 'point-buy'],
  capRules: ['creation-cap', 'hard-cap'],
  costRules: ['flat', 'per-current', 'item-meta', 'credit'],
}

// Chaves permitidas (allowlist). Chave desconhecida é erro: impede atributos como "onclick"
// ou campos que o renderizador ignoraria e algum código futuro poderia interpretar.
const KEYS = {
  template: ['schema', 'system', 'name', 'family', 'edition', 'templateVersion', 'locale', 'skin', 'license', 'identity', 'accent', 'fields', 'markStates', 'ladders', 'sections', 'zoneLabels', 'statusLabels', 'alerts',
    'recoveries', 'dock', 'roll', 'actions', 'creation', 'costs'],
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
// O tipo de campo e o parâmetro de cada regra de alerta (REGISTRY.alertRules)
const ALERT_PARAMS = {
  'track-at-level': { type: 'track', key: 'level' },
  'resource-at-most': { type: 'resource', key: 'value' },
  'resource-below-share': { type: 'resource', key: 'share' },
}
const NUM_LIMIT = 1_000_000

// Texto puro: sem < > (nunca HTML), sem controles C0/C1 (exceto tab e quebras), sem DEL,
// sem controles bidi (U+202A–202E, U+2066–2069) e sem separadores U+2028/2029.
export function isSafeText(s) {
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
  difference: (a, b = 0) => a - b,
  sum: (...values) => values.reduce((total, v) => total + v, 0),
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
  // Sem valor gravado: o `default` (que pode ser fórmula) ou o mínimo
  if (f.type === 'resource' && f.permanent) return formulaValue(t, values, f.permanent.default, f.permanent.min ?? 0, f.permanent.max ?? 100, depth)
  if (f.default == null || typeof f.default === 'number') return f.default ?? f.min ?? 0
  return formulaValue(t, values, f.default, f.min ?? 0, f.max ?? 10, depth)
}

// `default` com fórmula: inteiro, derivação ou valor por opção de um choice, limitado a min..max.
function formulaValue(t, values, formula, min, max, depth) {
  const clamp = n => Math.min(max, Math.max(min, n))
  if (typeof formula === 'number') return Number.isInteger(formula) ? clamp(formula) : min
  if (isObj(formula) && formula.derive !== undefined) {
    if (!own(DERIVE, formula.derive)) return clamp(0)
    const n = DERIVE[formula.derive](...[formula.from].flat().map(x => input(t, values, x, depth + 1)))
    return Number.isFinite(n) ? clamp(Math.trunc(n)) : min
  }
  if (isObj(formula) && typeof formula.from === 'string' && isObj(formula.map)) {
    const choice = own(values, formula.from) ? values[formula.from] : undefined
    const n = own(formula.map, choice) ? formula.map[choice] : undefined
    return Number.isInteger(n) ? clamp(n) : min
  }
  return min
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

// `creation` e `costs` (README §14): orçamentos, tetos e preços. Além da forma, recusa o que
// tornaria a conta ambígua: um campo em duas contas, preço de bônus diferente dentro de um
// grupo e tabela de point-buy que não cabe no campo.
const FORBIDDEN_IDS = ['constructor', 'prototype', 'toString', 'toLocaleString', 'valueOf', 'hasOwnProperty', 'isPrototypeOf', 'propertyIsEnumerable']
const isId = v => typeof v === 'string' && ID.test(v) && !FORBIDDEN_IDS.includes(v)
const isIntIn = (v, min, max) => Number.isInteger(v) && v >= min && v <= max
const asArray = v => (Array.isArray(v) ? v : [])
const rec = v => (isObj(v) ? v : undefined)

// Como cada tipo de campo entra na conta: o valor, o permanente de um recurso
// ou os itens de uma lista. null: o campo não é contabilizável.
function targetKind(f) {
  if (!f) return null
  if (f.type === 'rating') return 'value'
  if (f.type === 'number') return f.readOnly ? null : 'value'
  if (f.type === 'resource') return isObj(f.permanent) ? 'permanent' : null
  if (f.type === 'list') return 'items'
  return null
}

const ACCOUNTING_KEYS = {
  creation: ['freebies', 'budgets', 'caps', 'baselines', 'untracked'],
  budget: {
    'priority-budget': ['id', 'label', 'rule', 'budgets', 'groups'],
    'fixed-budget': ['id', 'label', 'rule', 'budget', 'targets'],
    'item-count': ['id', 'label', 'rule', 'budget', 'targets'],
    'point-buy': ['id', 'label', 'rule', 'budget', 'base', 'table', 'targets'],
  },
  group: ['id', 'label', 'targets'],
  cap: ['rule', 'targets', 'max'],
  baseline: ['targets', 'value', 'locked', 'when'],
  condition: ['field', 'in', 'equalsTarget', 'itemIn'],
  costs: ['freebie', 'xp'],
  freebie: ['id', 'rule', 'targets', 'cost', 'meta', 'max'],
  xp: ['total', 'spent', 'rules'],
  xpRule: ['id', 'rule', 'targets', 'cost', 'factor', 'new', 'when'],
  xpWhen: ['if', 'cost', 'factor', 'new', 'unavailable'],
}
const FREEBIE_RULES = ['flat', 'item-meta', 'credit']
const XP_RULES = ['flat', 'per-current']
const POINTS = 1000

function checkAccounting(t, c) {
  const { err, text, keys, num, field } = c
  // Lista obrigatória de 1 a `max` itens
  const items = (path, v, max) => {
    if (!Array.isArray(v) || !v.length || v.length > max) {
      err(path, `de 1 a ${max} itens`)
      return Array.isArray(v) ? v.slice(0, max) : []
    }
    return v
  }
  const objs = (path, v, max) =>
    items(path, v, max).flatMap((x, i) => {
      if (isObj(x)) return [x]
      err(`${path}.${i}`, 'precisa ser objeto')
      return []
    })
  // Ids de campo distintos, cada um contabilizável do jeito que a regra pede
  const targets = (path, v, allowed) => {
    const out = []
    for (const id of items(path, v, 100)) {
      const f = field(id)
      if (!f) {
        err(path, `campo '${id}' não existe`)
        continue
      }
      if (out.includes(id)) err(path, `campo '${id}' repetido`)
      const kind = targetKind(f)
      if (!kind || !allowed.includes(kind))
        err(path, `campo '${id}' não entra nesta conta`)
      else out.push(id)
    }
    return out
  }
  const required = (path, v, min, max) => {
    if (v === undefined || v === null) err(path, 'obrigatório')
    else num(path, v, min, max)
  }
  // Lista que conta pontos precisa de pontos no item
  const points = (path, id) => {
    if (!isObj(rec(field(id)?.item)?.value))
      err(path, `lista '${id}' sem pontos no item`)
  }
  const options = id =>
    asArray(field(id)?.options).map(o => rec(o)?.id)
  const condition = (path, v, ids) => {
    keys(path, v, ACCOUNTING_KEYS.condition)
    const cond = rec(v)
    if (!cond) return
    if (field(cond.field)?.type !== 'choice')
      err(`${path}.field`, `campo '${cond.field}' não é um choice`)
    if (cond.in === undefined && cond.equalsTarget === undefined)
      err(path, 'declare in ou equalsTarget')
    if (cond.in !== undefined)
      for (const o of items(`${path}.in`, cond.in, 50))
        if (!options(cond.field).includes(o))
          err(`${path}.in`, `opção '${o}' não existe em '${cond.field}'`)
    if (cond.equalsTarget !== undefined && cond.equalsTarget !== true)
      err(`${path}.equalsTarget`, 'só aceita true')
    if (cond.itemIn === undefined) return
    const lists = ids.map(field).filter(f => f?.type === 'list')
    if (!ids.length || lists.length !== ids.length)
      return err(`${path}.itemIn`, 'só vale para listas')
    for (const name of items(`${path}.itemIn`, cond.itemIn, 200)) {
      text(`${path}.itemIn`, name, 80)
      if (!lists.some(l => asArray(l?.catalog).includes(name)))
        err(`${path}.itemIn`, `'${name}' não está no catálogo das listas`)
    }
  }
  // Cada campo em no máximo uma conta de cada tipo: sem seletor sobreposto
  const owner = (seen, path, ids) => {
    for (const id of ids) {
      const prev = seen.get(id)
      if (prev) err(path, `campo '${id}' já está em ${prev}`)
      else seen.set(id, path)
    }
  }

  const ledger = new Set()
  const costs = rec(t.costs)
  const xp = rec(costs?.xp)
  if (xp) for (const k of ['total', 'spent']) ledger.add(String(xp[k]))

  // Preço de bônus de cada campo (só `flat` paga pontos)
  const freebieOf = new Map()
  const metaRuled = new Set()
  if (t.costs !== undefined) {
    keys('costs', t.costs, ACCOUNTING_KEYS.costs)
    if (costs?.freebie !== undefined) {
      const ids = new Set()
      for (const [i, e] of objs('costs.freebie', costs.freebie, 50).entries()) {
        const p = `costs.freebie.${i}`
        keys(p, e, ACCOUNTING_KEYS.freebie)
        if (!isId(e.id) || ids.has(e.id)) err(`${p}.id`, 'id inválido ou repetido')
        ids.add(e.id)
        if (!FREEBIE_RULES.includes(e.rule))
          err(`${p}.rule`, `regra '${e.rule}' fora da lista fechada`)
        const meta = e.rule === 'item-meta' || e.rule === 'credit'
        const ts = targets(
          `${p}.targets`,
          e.targets,
          meta ? ['items'] : ['value', 'permanent', 'items']
        )
        for (const id of ts) {
          if (freebieOf.has(id) || metaRuled.has(id))
            err(`${p}.targets`, `campo '${id}' já tem preço de bônus`)
          else if (meta) metaRuled.add(id)
          else freebieOf.set(id, { path: p, cost: e.cost })
          if (ledger.has(id)) err(`${p}.targets`, `campo '${id}' é do extrato de XP`)
        }
        if (e.rule === 'flat') {
          required(`${p}.cost`, e.cost, 1, POINTS)
          for (const k of ['meta', 'max'])
            if (e[k] !== undefined) err(`${p}.${k}`, 'não se aplica à regra')
        }
        if (meta) {
          if (e.cost !== undefined) err(`${p}.cost`, 'não se aplica à regra')
          for (const id of ts) {
            const m = asArray(rec(field(id)?.item)?.meta)
              .map(rec)
              .find(x => x?.id === e.meta)
            if (m?.type !== 'number')
              err(`${p}.meta`, `'${id}' não tem meta numérico '${e.meta}'`)
          }
          if (e.rule === 'credit') required(`${p}.max`, e.max, 0, POINTS)
          else if (e.max !== undefined) err(`${p}.max`, 'não se aplica à regra')
        }
      }
    }
    if (costs?.xp !== undefined) {
      keys('costs.xp', costs.xp, ACCOUNTING_KEYS.xp)
      for (const k of ['total', 'spent']) {
        const f = field(xp?.[k])
        if (f?.type !== 'number' || f.readOnly)
          err(`costs.xp.${k}`, `campo '${xp?.[k]}' precisa ser number gravável`)
      }
      if (xp?.total === xp?.spent)
        err('costs.xp.spent', 'total e gasto são campos diferentes')
      const seen = new Map()
      const ids = new Set()
      // Sem `rules`, o template só mapeia o extrato: nenhum traço tem preço
      const rules = xp?.rules === undefined ? [] : objs('costs.xp.rules', xp.rules, 100)
      for (const [i, r] of rules.entries()) {
        const p = `costs.xp.rules.${i}`
        keys(p, r, ACCOUNTING_KEYS.xpRule)
        if (!isId(r.id) || ids.has(r.id)) err(`${p}.id`, 'id inválido ou repetido')
        ids.add(r.id)
        if (!XP_RULES.includes(r.rule))
          err(`${p}.rule`, `regra '${r.rule}' fora da lista fechada`)
        const ts = targets(`${p}.targets`, r.targets, [
          'value',
          'permanent',
          'items',
        ])
        owner(seen, p, ts)
        for (const id of ts) {
          if (ledger.has(id)) err(`${p}.targets`, `campo '${id}' é do extrato de XP`)
          if (field(id)?.type === 'list') points(`${p}.targets`, id)
        }
        const price = (path, o, needed) => {
          const need = r.rule === 'flat' ? 'cost' : 'factor'
          const other = r.rule === 'flat' ? 'factor' : 'cost'
          if (o[other] !== undefined) err(`${path}.${other}`, 'não se aplica à regra')
          if (o[need] !== undefined || needed)
            required(`${path}.${need}`, o[need], 1, need === 'cost' ? POINTS : 100)
          if (o.new !== undefined) num(`${path}.new`, o.new, 1, POINTS)
        }
        price(p, r, true)
        const when = r.when === undefined ? [] : objs(`${p}.when`, r.when, 50)
        for (const [j, w] of when.entries()) {
          const wp = `${p}.when.${j}`
          keys(wp, w, ACCOUNTING_KEYS.xpWhen)
          condition(`${wp}.if`, w.if, ts)
          price(wp, w, false)
          if (w.unavailable !== undefined && w.unavailable !== true)
            err(`${wp}.unavailable`, 'só aceita true')
          if (
            w.unavailable === undefined &&
            w.cost === undefined &&
            w.factor === undefined &&
            w.new === undefined
          )
            err(wp, 'a exceção não muda nada')
        }
      }
    }
  }

  if (t.creation === undefined) return
  keys('creation', t.creation, ACCOUNTING_KEYS.creation)
  const creation = rec(t.creation) ?? {}
  if (creation.freebies !== undefined)
    num('creation.freebies', creation.freebies, 0, POINTS)
  const budgeted = new Map()
  const budgetIds = new Set()
  for (const [i, b] of objs('creation.budgets', creation.budgets, 20).entries()) {
    const p = `creation.budgets.${i}`
    if (!isId(b.id) || budgetIds.has(b.id)) err(`${p}.id`, 'id inválido ou repetido')
    budgetIds.add(b.id)
    text(`${p}.label`, b.label, 40)
    if (!REGISTRY.budgetRules.includes(b.rule)) {
      err(`${p}.rule`, `regra '${b.rule}' fora da lista fechada`)
      continue
    }
    keys(p, b, ACCOUNTING_KEYS.budget[b.rule] ?? [])
    // Grupos do orçamento: um por prioridade, ou o próprio orçamento
    const groups = []
    if (b.rule === 'priority-budget') {
      const gs = objs(`${p}.groups`, b.groups, 5)
      if (gs.length < 2) err(`${p}.groups`, 'de 2 a 5 grupos')
      const values = items(`${p}.budgets`, b.budgets, 5)
      if (values.length !== gs.length)
        err(`${p}.budgets`, 'um orçamento por grupo')
      for (const [j, v] of values.entries())
        required(`${p}.budgets.${j}`, v, 0, POINTS)
      const gids = new Set()
      for (const [j, g] of gs.entries()) {
        const gp = `${p}.groups.${j}`
        keys(gp, g, ACCOUNTING_KEYS.group)
        if (!isId(g.id) || gids.has(g.id)) err(`${gp}.id`, 'id inválido ou repetido')
        gids.add(g.id)
        text(`${gp}.label`, g.label, 40)
        groups.push({
          path: gp,
          ids: targets(`${gp}.targets`, g.targets, ['value', 'permanent', 'items']),
        })
      }
    } else {
      required(`${p}.budget`, b.budget, 0, POINTS)
      const kinds =
        b.rule === 'item-count'
          ? ['items']
          : b.rule === 'point-buy'
            ? ['value']
            : ['value', 'permanent', 'items']
      groups.push({ path: p, ids: targets(`${p}.targets`, b.targets, kinds) })
    }
    if (b.rule === 'point-buy') {
      required(`${p}.base`, b.base, -POINTS, POINTS)
      const table = items(`${p}.table`, b.table, 30)
      if (table.length < 2) err(`${p}.table`, 'de 2 a 30 valores')
      for (const [j, v] of table.entries()) {
        required(`${p}.table.${j}`, v, 0, POINTS)
        if (j === 0 && v !== 0) err(`${p}.table.0`, 'o valor base custa 0')
        if (j > 0 && typeof v === 'number' && v < Number(table[j - 1]))
          err(`${p}.table.${j}`, 'o custo acumulado não diminui')
      }
      const base = typeof b.base === 'number' ? b.base : 0
      const top = base + table.length - 1
      for (const id of groups[0]?.ids ?? []) {
        const f = field(id)
        const min =
          typeof f?.min === 'number' ? f.min : f?.type === 'rating' ? 0 : -NUM_LIMIT
        const max = typeof f?.max === 'number' ? f.max : NUM_LIMIT
        if (base < min || top > max)
          err(`${p}.table`, `a tabela sai da faixa de '${id}'`)
        if (freebieOf.has(id))
          err(`${p}.targets`, `campo '${id}' de point-buy não compra com bônus`)
      }
    }
    for (const g of groups) {
      owner(budgeted, g.path, g.ids)
      // Preço uniforme: todos sem bônus, ou todos com o mesmo preço por ponto
      const prices = new Set(g.ids.map(id => freebieOf.get(id)?.cost))
      if (prices.size > 1)
        err(`${g.path}.targets`, 'preço de bônus diferente dentro do grupo')
      for (const id of g.ids) {
        if (b.rule !== 'item-count' && field(id)?.type === 'list')
          points(`${g.path}.targets`, id)
        if (metaRuled.has(id))
          err(`${g.path}.targets`, `campo '${id}' com preço por item não entra em orçamento`)
        if (ledger.has(id)) err(`${g.path}.targets`, `campo '${id}' é do extrato de XP`)
      }
    }
  }

  const tracked = id =>
    budgeted.has(id) || freebieOf.has(id) || metaRuled.has(id)
  const caps =
    creation.caps === undefined ? [] : objs('creation.caps', creation.caps, 20)
  for (const [i, cap] of caps.entries()) {
    const p = `creation.caps.${i}`
    keys(p, cap, ACCOUNTING_KEYS.cap)
    if (!REGISTRY.capRules.includes(cap.rule))
      err(`${p}.rule`, `regra '${cap.rule}' fora da lista fechada`)
    const ts = targets(`${p}.targets`, cap.targets, ['value', 'permanent', 'items'])
    for (const id of ts) {
      if (!tracked(id)) err(`${p}.targets`, `campo '${id}' fora da conta da criação`)
      if (field(id)?.type === 'list') points(`${p}.targets`, id)
    }
    const max = cap.max
    if (isObj(max)) {
      keys(`${p}.max`, max, ['field'])
      const f = field(max.field)
      if (f?.type !== 'rating' && f?.type !== 'number')
        err(`${p}.max.field`, 'o teto precisa ser rating ou number')
      if (cap.rule === 'creation-cap')
        err(`${p}.max`, 'o teto dos básicos é um número')
    } else required(`${p}.max`, max, 0, POINTS)
  }
  const baselines =
    creation.baselines === undefined
      ? []
      : objs('creation.baselines', creation.baselines, 20)
  for (const [i, bl] of baselines.entries()) {
    const p = `creation.baselines.${i}`
    keys(p, bl, ACCOUNTING_KEYS.baseline)
    const ts = targets(`${p}.targets`, bl.targets, ['value', 'permanent'])
    for (const id of ts) {
      if (!tracked(id)) err(`${p}.targets`, `campo '${id}' fora da conta da criação`)
      const f = field(id)
      const range = f?.type === 'resource' ? rec(f.permanent) : f
      const min = typeof range?.min === 'number' ? range.min : 0
      const max = typeof range?.max === 'number' ? range.max : NUM_LIMIT
      if (!isIntIn(bl.value, min, max))
        err(`${p}.value`, `precisa caber na faixa de '${id}'`)
    }
    if (bl.locked !== undefined && bl.locked !== true)
      err(`${p}.locked`, 'só aceita true')
    if (bl.when !== undefined) {
      condition(`${p}.when`, bl.when, ts)
      if (rec(bl.when)?.itemIn !== undefined)
        err(`${p}.when.itemIn`, 'não se aplica ao valor inicial')
    }
  }
  if (creation.untracked !== undefined)
    for (const id of items('creation.untracked', creation.untracked, 200)) {
      if (!own(t.fields, id)) err('creation.untracked', `campo '${id}' não existe`)
      else if (tracked(id))
        err('creation.untracked', `campo '${id}' já está na conta da criação`)
    }
}

export function validateTemplate(t, palette) {
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
  // `default` com fórmula (§3): inteiro, derivação ou valor por opção de um choice
  const formula = (path, v, min, max) => {
    if (v == null) return
    if (!isObj(v)) return num(path, v, min, max)
    if (v.derive !== undefined) { oneOf(`${path}.derive`, v.derive, REGISTRY.derive, 'derive'); return sources(`${path}.from`, v.from) }
    const choice = has(v.from) ? fields[v.from] : undefined
    if (choice?.type !== 'choice') return err(`${path}.from`, `campo '${v.from}' não é um choice`)
    const options = (choice.options ?? []).map(o => o?.id)
    for (const [k, n] of Object.entries(isObj(v.map) ? v.map : {})) {
      if (!options.includes(k)) err(`${path}.map.${k}`, `opção '${k}' não existe em '${v.from}'`)
      num(`${path}.map.${k}`, n, min, max)
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
    if (f.type === 'rating') formula(`${p}.default`, f.default, f.min ?? 0, f.max ?? 10)
    else if (f.default != null) num(`${p}.default`, f.default, f.min ?? (f.type === 'rating' ? 0 : -NUM_LIMIT), f.max ?? (f.type === 'rating' ? 10 : NUM_LIMIT))
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
      if (f.permanent) { num(`${p}.permanent.min`, f.permanent.min, 0, 100); num(`${p}.permanent.max`, f.permanent.max, 1, 100); formula(`${p}.permanent.default`, f.permanent.default, f.permanent.min ?? 0, f.permanent.max ?? 100) }
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
      for (const fill of f.fills ?? []) { text(`${p}.fills.${fill.id}.label`, fill.label); oneOf(`${p}.fills.${fill.id}.colorRole`, fill.colorRole, REGISTRY.colorRoles, 'colorRole'); formula(`${p}.fills.${fill.id}.default`, fill.default, 0, f.segments ?? 24) }
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

  // Estados da ficha (doc/painel-narrador.md §5.1): o template só nomeia o `dead` ("Torpor").
  if (t.statusLabels != null) {
    keys('statusLabels', t.statusLabels, ['dead'])
    for (const [s, label] of Object.entries(isObj(t.statusLabels) ? t.statusLabels : {})) text(`statusLabels.${s}`, label, 20)
  }

  // Alertas da Mesa (doc/plano-v3.md, Etapa 8): regra da lista fechada, o tipo do campo que
  // ela lê e só o parâmetro dela, nunca expressão.
  const alertIds = new Set()
  const alerts = Array.isArray(t.alerts) ? t.alerts : []
  if (alerts.length > 10) err('alerts', 'no máximo 10 alertas')
  for (const a of alerts) {
    const p = `alerts.${a.id}`
    keys(p, a, ['id', 'label', 'rule', 'field', 'level', 'value', 'share'])
    if (typeof a.id !== 'string' || !ID.test(a.id) || alertIds.has(a.id)) err(`${p}.id`, 'id inválido ou repetido')
    alertIds.add(a.id)
    text(`${p}.label`, a.label, 40)
    oneOf(`${p}.rule`, a.rule, REGISTRY.alertRules, 'regra de alerta')
    const f = has(a.field) ? fields[a.field] : undefined
    if (!f) err(`${p}.field`, `campo '${a.field}' não existe`)
    const param = ALERT_PARAMS[a.rule]
    if (!param) continue
    if (f && f.type !== param.type) err(`${p}.field`, `a regra '${a.rule}' lê um campo ${param.type}`)
    for (const k of ['level', 'value', 'share']) if (k !== param.key && a[k] !== undefined) err(`${p}.${k}`, 'parâmetro de outra regra')
    if (param.key === 'level') {
      const total = f?.rule === 'boxes' ? (f.rows ?? []).reduce((n, r) => n + (Number(r?.boxes) || 0), 0) : (f?.levels ?? []).length
      if (!Number.isInteger(a.level) || a.level < 1 || a.level > Math.max(total, 1)) err(`${p}.level`, `precisa ser inteiro entre 1 e ${Math.max(total, 1)}`)
    }
    if (param.key === 'value' && (!Number.isInteger(a.value) || a.value < 0 || a.value > NUM_LIMIT)) err(`${p}.value`, `precisa ser inteiro entre 0 e ${NUM_LIMIT}`)
    if (param.key === 'share' && !(typeof a.share === 'number' && a.share > 0 && a.share < 1)) err(`${p}.share`, 'precisa ser um número entre 0 e 1')
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
  if (id.emblem) oneOf('identity.emblem', id.emblem, REGISTRY.emblems, 'emblem')
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
  // O atalho só fixa o que o slot ofereceria: um campo fora das seções do slot deixaria o atalho sempre indisponível
  const sectionFields = id => { const sec = (t.sections ?? []).find(x => x.id === id); return sec ? [...(sec.fields ?? []), ...(sec.groups ?? []).flatMap(g => g.fields ?? [])] : [] }
  for (const pr of r.presets ?? []) for (const [k, fid] of Object.entries(pr.slots ?? {})) {
    const sl = (r.slots ?? []).find(x => x.id === k)
    if (!sl) err(`roll.presets.${pr.id}.slots.${k}`, 'slot inexistente na rolagem')
    else if (has(fid) && !(sl.from ?? []).some(sid => sectionFields(sid).includes(fid))) err(`roll.presets.${pr.id}.slots.${k}`, `campo '${fid}' fora das seções do slot`)
  }
  const boostModel = { autoSuccess: ['pool-success'], plus2: ['fudge'] }
  for (const b of r.boosts ?? []) if (boostModel[b.effect] && !boostModel[b.effect].includes(r.model)) err(`roll.boosts.${b.id}`, `efeito '${b.effect}' não se aplica ao modelo ${r.model} (gastaria o recurso sem efeito)`)
  // health.heal: no sheet de um recurso (paga o custo) ou no menu da ficha (Regenerar, sem custo)
  const checkHeal = (p, a) => {
    if (a.effect !== 'health.heal') return
    const track = fields[a.params?.field]
    if (!track || track.rule !== 'wod-stacking') { err(`${p}.params.field`, 'precisa ser uma trilha wod-stacking'); return }
    for (const ty of a.params.types ?? []) if (!track.types.some(x => x.id === ty)) err(`${p}.params.types`, `tipo '${ty}' não existe na trilha`)
  }
  for (const a of t.actions ?? []) checkHeal(`actions.${a.id}`, a)
  if (t.recoveries !== undefined) {
    if (!Array.isArray(t.recoveries) || !t.recoveries.length || t.recoveries.length > 12) err('recoveries', 'de 1 a 12 períodos')
    else {
      const ids = new Set()
      for (const [i, recovery] of t.recoveries.entries()) {
        const p = `recoveries.${i}`
        if (!isObj(recovery)) { err(p, 'precisa ser objeto'); continue }
        keys(p, recovery, ['id', 'label', 'help', 'effects'])
        if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(recovery.id ?? '') || ['constructor', 'prototype', '__proto__'].includes(recovery.id) || ids.has(recovery.id)) err(`${p}.id`, 'id inválido ou repetido')
        ids.add(recovery.id)
        text(`${p}.label`, recovery.label)
        text(`${p}.help`, recovery.help, 1000)
        if (!Array.isArray(recovery.effects) || !recovery.effects.length || recovery.effects.length > 20) { err(`${p}.effects`, 'de 1 a 20 efeitos'); continue }
        for (const [j, e] of recovery.effects.entries()) {
          const ep = `${p}.effects.${j}`
          if (!isObj(e)) { err(ep, 'precisa ser objeto'); continue }
          keys(ep, e, ['effect', 'params'])
          oneOf(`${ep}.effect`, e.effect, REGISTRY.effects, 'effect')
          if (['rest.long', 'rest.short'].includes(e.effect)) {
            if (e.params !== undefined) err(`${ep}.params`, 'efeito sem parâmetros')
            continue
          }
          const restore = e.effect === 'resource.restore'
          const health = e.effect === 'health.heal'
          if (!isObj(e.params)) { err(`${ep}.params`, 'precisa ser objeto'); continue }
          keys(`${ep}.params`, e.params, health ? ['field', 'types'] : restore ? ['field'] : ['field', 'amount'])
          if (health) {
            checkHeal(ep, e)
            if (!Array.isArray(e.params.types) || !e.params.types.length || e.params.types.length > 5 || new Set(e.params.types).size !== e.params.types.length) err(`${ep}.params.types`, 'de 1 a 5 tipos distintos')
          } else {
            const resource = fields[e.params.field]
            if (resource?.type !== 'resource' || resource.readOnly || resource.derive) err(`${ep}.params.field`, 'precisa apontar para um resource gravável')
            if (restore && !resource?.permanent) err(`${ep}.params.field`, 'recurso precisa ter permanente')
            if (!restore && (!Number.isInteger(e.params.amount) || e.params.amount < 1 || e.params.amount > 99)) err(`${ep}.params.amount`, 'precisa ser inteiro entre 1 e 99')
          }
        }
      }
    }
  }
  for (const [fid, f] of Object.entries(fields)) {
    for (const a of f.actions ?? []) checkHeal(`fields.${fid}.actions.${a.id}`, a)
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
  checkAccounting(t, { err, text, keys, num, field: id => (has(id) && isObj(fields[id]) ? fields[id] : undefined) })
  return errors
}

// Valida sheet_data contra o template. O servidor aplica isto a cada escrita.
export function validateSheet(t, sheet, who = '?') {
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
