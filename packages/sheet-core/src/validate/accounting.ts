import { REGISTRY } from '../registry'
import {
  asArray,
  isId,
  isIntIn,
  isObj,
  NUM_LIMIT,
  type Obj,
  own,
  rec,
} from './util'

// Validação de `creation` e `costs` (design/templates/README.md §14), porta
// fiel do trecho de design/scripts/validate.mjs, com as mesmas mensagens.
// Além da forma, recusa o que tornaria a conta ambígua: um campo em duas
// contas, preço de bônus diferente dentro de um grupo e tabela de point-buy
// que não cabe no campo.

export interface AccountingChecker {
  err(path: string, message: string): void
  text(path: string, v: unknown, max?: number): void
  keys(path: string, o: unknown, allowed: readonly string[]): void
  num(path: string, v: unknown, min?: number, max?: number): void
  field(id: unknown): Obj | undefined
}

// Como cada tipo de campo entra na conta: o valor, o permanente de um recurso
// ou os itens de uma lista. null: o campo não é contabilizável.
export type TargetKind = 'value' | 'permanent' | 'items'

export function targetKind(f: Obj | undefined): TargetKind | null {
  if (!f) return null
  if (f.type === 'rating') return 'value'
  if (f.type === 'number') return f.readOnly ? null : 'value'
  if (f.type === 'resource') return isObj(f.permanent) ? 'permanent' : null
  if (f.type === 'list') return 'items'
  return null
}

const KEYS = {
  creation: ['freebies', 'budgets', 'caps', 'baselines', 'untracked'],
  budget: {
    'priority-budget': ['id', 'label', 'rule', 'budgets', 'groups'],
    'fixed-budget': ['id', 'label', 'rule', 'budget', 'targets'],
    'item-count': ['id', 'label', 'rule', 'budget', 'targets'],
    'point-buy': ['id', 'label', 'rule', 'budget', 'base', 'table', 'targets'],
  } as Readonly<Record<string, readonly string[]>>,
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
const FREEBIE_RULES: readonly unknown[] = ['flat', 'item-meta', 'credit']
const XP_RULES: readonly unknown[] = ['flat', 'per-current']
const POINTS = 1000

export function checkAccounting(t: Obj, c: AccountingChecker): void {
  const { err, text, keys, num, field } = c
  // Lista obrigatória de 1 a `max` itens
  const items = (path: string, v: unknown, max: number): unknown[] => {
    if (!Array.isArray(v) || !v.length || v.length > max) {
      err(path, `de 1 a ${max} itens`)
      return Array.isArray(v) ? v.slice(0, max) : []
    }
    return v
  }
  const objs = (path: string, v: unknown, max: number): Obj[] =>
    items(path, v, max).flatMap((x, i) => {
      if (isObj(x)) return [x]
      err(`${path}.${i}`, 'precisa ser objeto')
      return []
    })
  // Ids de campo distintos, cada um contabilizável do jeito que a regra pede
  const targets = (
    path: string,
    v: unknown,
    allowed: readonly TargetKind[]
  ): string[] => {
    const out: string[] = []
    for (const id of items(path, v, 100)) {
      const f = field(id)
      if (!f) {
        err(path, `campo '${id}' não existe`)
        continue
      }
      if (out.includes(id as string)) err(path, `campo '${id}' repetido`)
      const kind = targetKind(f)
      if (!kind || !allowed.includes(kind))
        err(path, `campo '${id}' não entra nesta conta`)
      else out.push(id as string)
    }
    return out
  }
  const required = (path: string, v: unknown, min: number, max: number) => {
    if (v === undefined || v === null) err(path, 'obrigatório')
    else num(path, v, min, max)
  }
  // Lista que conta pontos precisa de pontos no item
  const points = (path: string, id: string) => {
    if (!isObj(rec(field(id)?.item)?.value))
      err(path, `lista '${id}' sem pontos no item`)
  }
  const options = (id: unknown): unknown[] =>
    asArray(field(id)?.options).map(o => rec(o)?.id)
  const condition = (path: string, v: unknown, ids: readonly string[]) => {
    keys(path, v, KEYS.condition)
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
  const owner = (seen: Map<string, string>, path: string, ids: string[]) => {
    for (const id of ids) {
      const prev = seen.get(id)
      if (prev) err(path, `campo '${id}' já está em ${prev}`)
      else seen.set(id, path)
    }
  }

  const ledger = new Set<string>()
  const costs = rec(t.costs)
  const xp = rec(costs?.xp)
  if (xp) for (const k of ['total', 'spent']) ledger.add(String(xp[k]))

  // Preço de bônus de cada campo (só `flat` paga pontos)
  const freebieOf = new Map<string, { path: string; cost: unknown }>()
  const metaRuled = new Set<string>()
  if (t.costs !== undefined) {
    keys('costs', t.costs, KEYS.costs)
    if (costs?.freebie !== undefined) {
      const ids = new Set<unknown>()
      for (const [i, e] of objs('costs.freebie', costs.freebie, 50).entries()) {
        const p = `costs.freebie.${i}`
        keys(p, e, KEYS.freebie)
        if (!isId(e.id) || ids.has(e.id))
          err(`${p}.id`, 'id inválido ou repetido')
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
          if (ledger.has(id))
            err(`${p}.targets`, `campo '${id}' é do extrato de XP`)
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
      keys('costs.xp', costs.xp, KEYS.xp)
      for (const k of ['total', 'spent']) {
        const f = field(xp?.[k])
        if (f?.type !== 'number' || f.readOnly)
          err(`costs.xp.${k}`, `campo '${xp?.[k]}' precisa ser number gravável`)
      }
      if (xp?.total === xp?.spent)
        err('costs.xp.spent', 'total e gasto são campos diferentes')
      const seen = new Map<string, string>()
      const ids = new Set<unknown>()
      // Sem `rules`, o template só mapeia o extrato: nenhum traço tem preço
      const rules =
        xp?.rules === undefined ? [] : objs('costs.xp.rules', xp.rules, 100)
      for (const [i, r] of rules.entries()) {
        const p = `costs.xp.rules.${i}`
        keys(p, r, KEYS.xpRule)
        if (!isId(r.id) || ids.has(r.id))
          err(`${p}.id`, 'id inválido ou repetido')
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
          if (ledger.has(id))
            err(`${p}.targets`, `campo '${id}' é do extrato de XP`)
          if (field(id)?.type === 'list') points(`${p}.targets`, id)
        }
        const price = (path: string, o: Obj, needed: boolean) => {
          const need = r.rule === 'flat' ? 'cost' : 'factor'
          const other = r.rule === 'flat' ? 'factor' : 'cost'
          if (o[other] !== undefined)
            err(`${path}.${other}`, 'não se aplica à regra')
          if (o[need] !== undefined || needed)
            required(
              `${path}.${need}`,
              o[need],
              1,
              need === 'cost' ? POINTS : 100
            )
          if (o.new !== undefined) num(`${path}.new`, o.new, 1, POINTS)
        }
        price(p, r, true)
        const when = r.when === undefined ? [] : objs(`${p}.when`, r.when, 50)
        for (const [j, w] of when.entries()) {
          const wp = `${p}.when.${j}`
          keys(wp, w, KEYS.xpWhen)
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
  keys('creation', t.creation, KEYS.creation)
  const creation = rec(t.creation) ?? {}
  if (creation.freebies !== undefined)
    num('creation.freebies', creation.freebies, 0, POINTS)
  const budgeted = new Map<string, string>()
  const budgetIds = new Set<unknown>()
  for (const [i, b] of objs(
    'creation.budgets',
    creation.budgets,
    20
  ).entries()) {
    const p = `creation.budgets.${i}`
    if (!isId(b.id) || budgetIds.has(b.id))
      err(`${p}.id`, 'id inválido ou repetido')
    budgetIds.add(b.id)
    text(`${p}.label`, b.label, 40)
    if (!(REGISTRY.budgetRules as readonly unknown[]).includes(b.rule)) {
      err(`${p}.rule`, `regra '${b.rule}' fora da lista fechada`)
      continue
    }
    keys(p, b, KEYS.budget[b.rule as string] ?? [])
    // Grupos do orçamento: um por prioridade, ou o próprio orçamento
    const groups: { path: string; ids: string[] }[] = []
    if (b.rule === 'priority-budget') {
      const gs = objs(`${p}.groups`, b.groups, 5)
      if (gs.length < 2) err(`${p}.groups`, 'de 2 a 5 grupos')
      const values = items(`${p}.budgets`, b.budgets, 5)
      if (values.length !== gs.length)
        err(`${p}.budgets`, 'um orçamento por grupo')
      for (const [j, v] of values.entries())
        required(`${p}.budgets.${j}`, v, 0, POINTS)
      const gids = new Set<unknown>()
      for (const [j, g] of gs.entries()) {
        const gp = `${p}.groups.${j}`
        keys(gp, g, KEYS.group)
        if (!isId(g.id) || gids.has(g.id))
          err(`${gp}.id`, 'id inválido ou repetido')
        gids.add(g.id)
        text(`${gp}.label`, g.label, 40)
        groups.push({
          path: gp,
          ids: targets(`${gp}.targets`, g.targets, [
            'value',
            'permanent',
            'items',
          ]),
        })
      }
    } else {
      required(`${p}.budget`, b.budget, 0, POINTS)
      const kinds: TargetKind[] =
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
          typeof f?.min === 'number'
            ? f.min
            : f?.type === 'rating'
              ? 0
              : -NUM_LIMIT
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
          err(
            `${g.path}.targets`,
            `campo '${id}' com preço por item não entra em orçamento`
          )
        if (ledger.has(id))
          err(`${g.path}.targets`, `campo '${id}' é do extrato de XP`)
      }
    }
  }

  const tracked = (id: string) =>
    budgeted.has(id) || freebieOf.has(id) || metaRuled.has(id)
  const caps =
    creation.caps === undefined ? [] : objs('creation.caps', creation.caps, 20)
  for (const [i, cap] of caps.entries()) {
    const p = `creation.caps.${i}`
    keys(p, cap, KEYS.cap)
    if (!(REGISTRY.capRules as readonly unknown[]).includes(cap.rule))
      err(`${p}.rule`, `regra '${cap.rule}' fora da lista fechada`)
    const ts = targets(`${p}.targets`, cap.targets, [
      'value',
      'permanent',
      'items',
    ])
    for (const id of ts) {
      if (!tracked(id))
        err(`${p}.targets`, `campo '${id}' fora da conta da criação`)
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
    keys(p, bl, KEYS.baseline)
    const ts = targets(`${p}.targets`, bl.targets, ['value', 'permanent'])
    for (const id of ts) {
      if (!tracked(id))
        err(`${p}.targets`, `campo '${id}' fora da conta da criação`)
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
      if (!own(t.fields, id))
        err('creation.untracked', `campo '${id}' não existe`)
      else if (tracked(id as string))
        err('creation.untracked', `campo '${id}' já está na conta da criação`)
    }
}
