import {
  baseValue,
  conditionHolds,
  itemPoints,
  listItems,
  sheetData,
  withoutValue,
} from './accounting'
import { classifyChange } from './classify'
import type { SheetModel } from './compile'
import type {
  CreationBudget,
  CreationDef,
  FieldId,
  FreebieCost,
  SheetData,
} from './contract'
import { stored } from './fields'
import { type ResolvedSheet, resolve } from './resolve'
import type { Issue } from './validate'
import { targetKind } from './validate/accounting'
import { get, isIntIn, isObj, own, rec } from './validate/util'

// Contabilização da criação por pontos (doc/plano-v4.md §3.1, contrato em
// design/templates/README.md §14). O que se grava são só as escolhas
// (prioridades) e a configuração (orçamentos do narrador); de onde vem cada
// ponto é calculado aqui, sempre do estado final da ficha. Por isso a ordem
// em que os pontos foram distribuídos nunca muda o resultado.
//
// Por grupo: `inicial` é o valor de partida; `investido` é o que passou dele;
// `elegível` é a parte que os básicos podem pagar (até o `creation-cap`);
// `básicos` = min(elegível, orçamento); o resto é pago com bônus, ao preço
// único do grupo. Básicos e point-buy fecham exatos; bônus são um limite.

export const CREATION_MODES = ['points', 'free'] as const
export type CreationMode = (typeof CREATION_MODES)[number]

/** Configuração efetiva: template → padrão da crônica → ajuste da ficha. */
export interface CreationConfig {
  readonly mode: CreationMode
  // Orçamento por id: lista (um por prioridade) ou número.
  readonly budgets?: Readonly<Record<string, number | readonly number[]>>
  readonly freebies?: number
}

/** Uma camada da configuração (crônica ou ficha): só o que ela ajusta. */
export type CreationConfigLayer = Partial<CreationConfig>

/** O que o jogador escolhe: a ordem dos grupos, do primário ao último. */
export interface CreationChoices {
  readonly priorities?: Readonly<Record<string, readonly string[]>>
}

export interface CreationInput {
  readonly config: CreationConfig
  readonly choices?: CreationChoices
}

export const CREATION_PROBLEMS = [
  // Grupo com pontos sem a prioridade que dá o orçamento dele.
  'CREATION_PRIORITIES_REQUIRED',
  // Básicos sobrando (falta distribuir).
  'CREATION_BASICS_UNSPENT',
  // Custo de bônus acima do saldo.
  'CREATION_FREEBIES_EXCEEDED',
  // Point-buy acima ou abaixo do orçamento exato.
  'CREATION_POINTBUY_EXCEEDED',
  'CREATION_POINTBUY_UNSPENT',
  // Valor fora da tabela de point-buy.
  'CREATION_OUT_OF_RANGE',
  // Acima de um `hard-cap`.
  'CREATION_HARD_CAP',
  // Acima de um valor inicial travado.
  'CREATION_LOCKED',
  // Investimento sem preço: campo fora da conta ou grupo sem bônus.
  'CREATION_NOT_PURCHASABLE',
  // Abaixo do valor inicial: não gera crédito.
  'CREATION_BELOW_INITIAL',
] as const
export type CreationProblemCode = (typeof CREATION_PROBLEMS)[number]

/**
 * `blocking` impede salvar o rascunho e concluir; `incomplete` só impede
 * concluir. Nada de texto da ficha: código, ids do template e caminhos.
 */
export interface CreationProblem {
  readonly code: CreationProblemCode
  readonly severity: 'blocking' | 'incomplete'
  readonly budget?: string
  readonly group?: string
  // `values.<campo>` ou `values.<campo>#<item>`.
  readonly paths: readonly string[]
  // Quanto falta ou sobra, na unidade do problema.
  readonly amount?: number
}

export interface CreationComponent {
  readonly path: string
  readonly field: FieldId
  readonly item?: string
  readonly initial: number
  readonly value: number
  readonly invested: number
  readonly eligible: number
}

export interface CreationGroup {
  readonly id: string
  readonly label: string
  // null: prioridade ainda não escolhida.
  readonly budget: number | null
  // `points`: pontos acima do inicial; `items`: quantidade de itens;
  // `cost`: custo acumulado da tabela de point-buy.
  readonly measure: 'points' | 'items' | 'cost'
  readonly invested: number
  readonly eligible: number
  // Pagos com o orçamento do grupo.
  readonly basic: number
  // Orçamento ainda não usado.
  readonly missing: number
  // Pagos com bônus.
  readonly extra: number
  // Preço de bônus por unidade; null quando o grupo não compra com bônus.
  readonly price: number | null
  readonly freebieCost: number
  readonly components: readonly CreationComponent[]
}

export interface CreationBudgetCheck {
  readonly id: string
  readonly label: string
  readonly rule: CreationBudget['rule']
  // Só em `priority-budget`: a ordem escolhida, ou null.
  readonly priorities: readonly string[] | null
  readonly groups: readonly CreationGroup[]
}

/** Uma linha de bônus fora dos orçamentos (FdV, Qualidades, Defeitos). */
export interface FreebieLine {
  readonly id: string
  readonly rule: FreebieCost['rule']
  readonly paths: readonly string[]
  readonly units: number
  // Custo em bônus (`credit`: o crédito, já limitado pelo `max`).
  readonly cost: number
}

export interface FreebieSummary {
  readonly available: number
  readonly credit: number
  readonly spent: number
  readonly remaining: number
}

export interface CreationCheck {
  readonly mode: CreationMode
  // Pode concluir: nenhum problema.
  readonly complete: boolean
  // Pode salvar o rascunho: nenhum problema `blocking`.
  readonly savable: boolean
  readonly budgets: readonly CreationBudgetCheck[]
  readonly lines: readonly FreebieLine[]
  readonly freebies: FreebieSummary | null
  readonly problems: readonly CreationProblem[]
}

const FREE: Omit<CreationCheck, 'mode'> = Object.freeze({
  complete: true,
  savable: true,
  budgets: Object.freeze([]),
  lines: Object.freeze([]),
  freebies: null,
  problems: Object.freeze([]),
})

const LIMIT = 1000

/**
 * A configuração efetiva, camada sobre camada. Sem `creation` no template,
 * a criação é sempre livre. Valores fora do formato são ignorados aqui; quem
 * grava uma camada passa antes por `validateCreationConfig`.
 */
export function effectiveCreationConfig(
  model: SheetModel,
  ...layers: readonly (CreationConfigLayer | null | undefined)[]
): CreationConfig {
  const def = model.template.creation
  if (!def) return { mode: 'free' }
  let mode: CreationMode = 'points'
  const budgets: Record<string, number | readonly number[]> = {}
  let freebies = def.freebies
  for (const layer of layers) {
    if (!layer) continue
    if (layer.mode === 'points' || layer.mode === 'free') mode = layer.mode
    for (const [id, v] of Object.entries(rec(layer.budgets) ?? {}))
      if (budgetOverride(def, id, v)) budgets[id] = v as number | number[]
    if (isIntIn(layer.freebies, 0, LIMIT)) freebies = layer.freebies
  }
  return {
    mode,
    ...(Object.keys(budgets).length && { budgets }),
    ...(freebies !== undefined && { freebies }),
  }
}

function budgetOverride(def: CreationDef, id: string, v: unknown): boolean {
  const b = def.budgets.find(x => x.id === id)
  if (!b) return false
  if (b.rule === 'priority-budget')
    return (
      Array.isArray(v) &&
      v.length === b.groups.length &&
      v.every(n => isIntIn(n, 0, LIMIT))
    )
  return isIntIn(v, 0, LIMIT)
}

/** Confere uma camada de configuração antes de gravá-la. */
export function validateCreationConfig(
  model: SheetModel,
  json: unknown
): Issue[] {
  const issues: Issue[] = []
  const err = (path: string, message: string) => issues.push({ path, message })
  if (!isObj(json)) return [{ path: '', message: 'precisa ser objeto' }]
  const def = model.template.creation
  for (const k of Object.keys(json))
    if (!['mode', 'budgets', 'freebies'].includes(k))
      err(k, 'chave desconhecida (rejeitada)')
  if (json.mode !== undefined) {
    if (!(CREATION_MODES as readonly unknown[]).includes(json.mode))
      err('mode', 'modo desconhecido')
    else if (json.mode === 'points' && !def)
      err('mode', 'o template não tem criação por pontos')
  }
  if (json.freebies !== undefined && !isIntIn(json.freebies, 0, LIMIT))
    err('freebies', `precisa ser inteiro entre 0 e ${LIMIT}`)
  if (json.budgets !== undefined) {
    if (!isObj(json.budgets)) err('budgets', 'precisa ser objeto')
    else
      for (const [id, v] of Object.entries(json.budgets)) {
        if (!def?.budgets.some(b => b.id === id))
          err(`budgets.${id}`, 'orçamento inexistente')
        else if (!budgetOverride(def, id, v))
          err(`budgets.${id}`, 'orçamento fora do formato')
      }
  }
  return issues
}

/** Confere as escolhas do jogador: prioridades completas, sem repetição. */
export function validateCreationChoices(
  model: SheetModel,
  json: unknown
): Issue[] {
  const issues: Issue[] = []
  const err = (path: string, message: string) => issues.push({ path, message })
  if (!isObj(json)) return [{ path: '', message: 'precisa ser objeto' }]
  for (const k of Object.keys(json))
    if (k !== 'priorities') err(k, 'chave desconhecida (rejeitada)')
  if (json.priorities === undefined) return issues
  if (!isObj(json.priorities))
    return [{ path: 'priorities', message: 'precisa ser objeto' }]
  const budgets = model.template.creation?.budgets ?? []
  for (const [id, v] of Object.entries(json.priorities)) {
    const b = budgets.find(x => x.id === id)
    if (b?.rule !== 'priority-budget') {
      err(`priorities.${id}`, 'não é um orçamento por prioridade')
      continue
    }
    if (
      !validOrder(
        b.groups.map(g => g.id),
        v
      )
    )
      err(`priorities.${id}`, 'ordene todos os grupos, sem repetir')
  }
  return issues
}

function validOrder(groups: readonly string[], v: unknown): v is string[] {
  return (
    Array.isArray(v) &&
    v.length === groups.length &&
    new Set(v).size === v.length &&
    v.every(g => typeof g === 'string' && groups.includes(g))
  )
}

interface Initial {
  readonly value: number
  readonly locked: boolean
}

/**
 * A contabilização da ficha. Mesma entrada, mesmo resultado, no app e no
 * servidor. Criação livre (ou template sem `creation`) não tem conta.
 */
export function checkCreation(
  model: SheetModel,
  sheet: SheetData | unknown,
  input: CreationInput
): CreationCheck {
  const def = model.template.creation
  const { config } = input
  if (!def || config.mode !== 'points') return { mode: 'free', ...FREE }
  const data = sheetData(sheet)
  const r = resolve(model, data)
  const problems: CreationProblem[] = []
  const problem = (p: CreationProblem) => problems.push(p)

  // O padrão de um campo é o que ele vale sem valor gravado (a fórmula
  // acompanha as fontes finais).
  const defaults = new Map<FieldId, number | null>()
  const defaultOf = (id: FieldId) => {
    if (!defaults.has(id))
      defaults.set(id, baseValue(resolve(model, withoutValue(data, id)), id))
    return defaults.get(id) ?? 0
  }
  const pointBuyBase = new Map<FieldId, number>()
  for (const b of def.budgets)
    if (b.rule === 'point-buy')
      for (const id of b.targets) pointBuyBase.set(id, b.base)
  const initialOf = (id: FieldId): Initial => {
    for (const bl of def.baselines ?? [])
      if (
        bl.targets.includes(id) &&
        (!bl.when || conditionHolds(r, bl.when, id))
      )
        return { value: bl.value, locked: bl.locked === true }
    const base = pointBuyBase.get(id)
    return { value: base ?? defaultOf(id), locked: false }
  }
  const capOf = (id: FieldId, rule: 'creation-cap' | 'hard-cap') => {
    let out: number | null = null
    for (const c of def.caps ?? []) {
      if (c.rule !== rule || !c.targets.includes(id)) continue
      const max = typeof c.max === 'number' ? c.max : baseValue(r, c.max.field)
      if (max !== null) out = out === null ? max : Math.min(out, max)
    }
    return out
  }

  // Componentes de um campo: o valor, o permanente ou cada item da lista.
  const componentsOf = (id: FieldId): CreationComponent[] => {
    const f = model.fields.get(id)
    const kind = f
      ? targetKind(f.def as unknown as Record<string, unknown>)
      : null
    const soft = capOf(id, 'creation-cap')
    const hard = capOf(id, 'hard-cap')
    const out: CreationComponent[] = []
    const add = (
      path: string,
      initial: Initial,
      value: number,
      item?: string
    ) => {
      const invested = Math.max(0, value - initial.value)
      const top = soft === null ? value : Math.min(value, soft)
      out.push({
        path,
        field: id,
        ...(item !== undefined && { item }),
        initial: initial.value,
        value,
        invested,
        eligible: Math.max(0, top - initial.value),
      })
      if (hard !== null && value > hard)
        problem({
          code: 'CREATION_HARD_CAP',
          severity: 'blocking',
          paths: [path],
          amount: value - hard,
        })
      if (initial.locked && value > initial.value)
        problem({
          code: 'CREATION_LOCKED',
          severity: 'blocking',
          paths: [path],
          amount: value - initial.value,
        })
      if (value < initial.value)
        problem({
          code: 'CREATION_BELOW_INITIAL',
          severity: 'incomplete',
          paths: [path],
          amount: initial.value - value,
        })
    }
    if (kind === 'value' || kind === 'permanent')
      add(`values.${id}`, initialOf(id), baseValue(r, id) ?? 0)
    else if (kind === 'items') {
      const def = f?.def
      const min = def?.type === 'list' ? (def.item.value?.min ?? 0) : 0
      for (const item of listItems(r, id))
        add(
          `values.${id}#${item.id}`,
          { value: min, locked: false },
          itemPoints(model, id, item),
          item.id
        )
    }
    return out
  }

  // Preço de bônus por campo (`flat`); o validador garante um por campo
  const flat = new Map<FieldId, number>()
  for (const e of model.template.costs?.freebie ?? [])
    if (e.rule === 'flat' && e.cost !== undefined)
      for (const id of e.targets) flat.set(id, e.cost)

  const accounted = new Set<FieldId>()
  const budgets: CreationBudgetCheck[] = []
  for (const b of def.budgets) {
    const override = config.budgets?.[b.id]
    if (b.rule === 'priority-budget') {
      const chosen = input.choices?.priorities?.[b.id]
      const order = validOrder(
        b.groups.map(g => g.id),
        chosen
      )
        ? chosen
        : null
      const values =
        Array.isArray(override) && override.length === b.budgets.length
          ? override
          : b.budgets
      const groups = b.groups.map(g => {
        const rank = order ? order.indexOf(g.id) : -1
        return group(
          b.id,
          g.id,
          g.label,
          g.targets,
          rank < 0 ? null : (values[rank] ?? null),
          'points'
        )
      })
      budgets.push({
        id: b.id,
        label: b.label,
        rule: b.rule,
        priorities: order,
        groups,
      })
      continue
    }
    const budget = typeof override === 'number' ? override : b.budget
    if (b.rule === 'point-buy') {
      budgets.push({
        id: b.id,
        label: b.label,
        rule: b.rule,
        priorities: null,
        groups: [pointBuy(b.id, b.label, b.targets, budget, b.base, b.table)],
      })
      continue
    }
    const measure = b.rule === 'item-count' ? 'items' : 'points'
    budgets.push({
      id: b.id,
      label: b.label,
      rule: b.rule,
      priorities: null,
      groups: [group(b.id, b.id, b.label, b.targets, budget, measure)],
    })
  }

  function group(
    budgetId: string,
    id: string,
    label: string,
    targets: readonly FieldId[],
    budget: number | null,
    measure: 'points' | 'items'
  ): CreationGroup {
    const components = targets.flatMap(t => {
      accounted.add(t)
      return componentsOf(t)
    })
    const invested =
      measure === 'items'
        ? components.length
        : components.reduce((n, c) => n + c.invested, 0)
    const eligible =
      measure === 'items'
        ? components.length
        : components.reduce((n, c) => n + c.eligible, 0)
    const price = targets.length
      ? (flat.get(targets[0] as FieldId) ?? null)
      : null
    const paths = components
      .filter(c => measure === 'items' || c.invested > 0)
      .map(c => c.path)
    if (budget === null) {
      problem({
        code: 'CREATION_PRIORITIES_REQUIRED',
        severity: invested > 0 ? 'blocking' : 'incomplete',
        budget: budgetId,
        group: id,
        paths,
        amount: invested,
      })
      return {
        id,
        label,
        budget,
        measure,
        invested,
        eligible,
        basic: 0,
        missing: 0,
        extra: 0,
        price,
        freebieCost: 0,
        components,
      }
    }
    const basic = Math.min(eligible, budget)
    const extra = invested - basic
    if (budget > basic)
      problem({
        code: 'CREATION_BASICS_UNSPENT',
        severity: 'incomplete',
        budget: budgetId,
        group: id,
        paths: [],
        amount: budget - basic,
      })
    if (extra > 0 && price === null)
      problem({
        code: 'CREATION_NOT_PURCHASABLE',
        severity: 'blocking',
        budget: budgetId,
        group: id,
        paths,
        amount: extra,
      })
    return {
      id,
      label,
      budget,
      measure,
      invested,
      eligible,
      basic,
      missing: budget - basic,
      extra,
      price,
      freebieCost: price === null ? 0 : extra * price,
      components,
    }
  }

  function pointBuy(
    id: string,
    label: string,
    targets: readonly FieldId[],
    budget: number,
    base: number,
    table: readonly number[]
  ): CreationGroup {
    const components = targets.flatMap(t => {
      accounted.add(t)
      return componentsOf(t)
    })
    let spent = 0
    for (const c of components) {
      const cost = table[c.value - base]
      if (c.value < base || cost === undefined)
        problem({
          code: 'CREATION_OUT_OF_RANGE',
          severity: 'blocking',
          budget: id,
          group: id,
          paths: [c.path],
        })
      else spent += cost
    }
    if (spent > budget)
      problem({
        code: 'CREATION_POINTBUY_EXCEEDED',
        severity: 'blocking',
        budget: id,
        group: id,
        paths: components.filter(c => c.value > base).map(c => c.path),
        amount: spent - budget,
      })
    else if (spent < budget)
      problem({
        code: 'CREATION_POINTBUY_UNSPENT',
        severity: 'incomplete',
        budget: id,
        group: id,
        paths: [],
        amount: budget - spent,
      })
    return {
      id,
      label,
      budget,
      measure: 'cost',
      invested: spent,
      eligible: spent,
      basic: Math.min(spent, budget),
      missing: Math.max(0, budget - spent),
      extra: 0,
      price: null,
      freebieCost: 0,
      components,
    }
  }

  // Bônus fora dos orçamentos
  const lines: FreebieLine[] = []
  const freebieDefs = model.template.costs?.freebie ?? []
  for (const e of freebieDefs) {
    const targets = e.targets.filter(t => !accounted.has(t))
    if (!targets.length) continue
    for (const t of targets) accounted.add(t)
    if (e.rule === 'flat') {
      const components = targets.flatMap(componentsOf)
      // Lista sem pontos no item compra por item
      const units = targets.reduce((n, t) => {
        const f = model.fields.get(t)?.def
        if (f?.type === 'list' && !f.item.value)
          return n + listItems(r, t).length
        return (
          n +
          components
            .filter(c => c.field === t)
            .reduce((m, c) => m + c.invested, 0)
        )
      }, 0)
      lines.push({
        id: e.id,
        rule: e.rule,
        paths: components.filter(c => c.invested > 0).map(c => c.path),
        units,
        cost: units * (e.cost ?? 0),
      })
      continue
    }
    // `item-meta` e `credit`: o número do meta de cada item
    let units = 0
    const paths: string[] = []
    const missing: string[] = []
    for (const t of targets)
      for (const item of listItems(r, t)) {
        const n = get(item.meta, e.meta)
        const path = `values.${t}#${item.id}`
        paths.push(path)
        if (typeof n === 'number' && Number.isInteger(n) && n > 0) units += n
        else missing.push(path)
      }
    if (missing.length && e.rule === 'item-meta')
      problem({
        code: 'CREATION_NOT_PURCHASABLE',
        severity: 'blocking',
        paths: missing,
      })
    lines.push({
      id: e.id,
      rule: e.rule,
      paths,
      units,
      cost: e.rule === 'credit' ? Math.min(units, e.max ?? 0) : units,
    })
  }

  // Fail secure: evolução fora de qualquer conta não sobe na criação
  const ledger = new Set<FieldId>()
  const xp = model.template.costs?.xp
  if (xp) ledger.add(xp.total).add(xp.spent)
  const untracked = new Set(def.untracked ?? [])
  for (const [id, f] of model.fields) {
    if (f.readOnly || accounted.has(id) || untracked.has(id) || ledger.has(id))
      continue
    const now = r.get(id)
    const blank = resolve(model, withoutValue(data, id))
    const was = blank.get(id)
    if (!now || !was) continue
    const parts = classifyChange(f, stored(was, blank), stored(now, r))
    const advance = parts.filter(p => p.kind === 'advance').map(p => p.path)
    if (advance.length)
      problem({
        code: 'CREATION_NOT_PURCHASABLE',
        severity: 'blocking',
        paths: advance,
      })
  }

  const hasFreebies = freebieDefs.length > 0 || def.freebies !== undefined
  let freebies: FreebieSummary | null = null
  if (hasFreebies) {
    const available = config.freebies ?? def.freebies ?? 0
    const credit = lines
      .filter(l => l.rule === 'credit')
      .reduce((n, l) => n + l.cost, 0)
    const spent =
      budgets.flatMap(b => b.groups).reduce((n, g) => n + g.freebieCost, 0) +
      lines.filter(l => l.rule !== 'credit').reduce((n, l) => n + l.cost, 0)
    const remaining = available + credit - spent
    freebies = { available, credit, spent, remaining }
    if (remaining < 0)
      problem({
        code: 'CREATION_FREEBIES_EXCEEDED',
        severity: 'blocking',
        paths: [],
        amount: -remaining,
      })
  }

  return {
    mode: 'points',
    complete: problems.length === 0,
    savable: !problems.some(p => p.severity === 'blocking'),
    budgets,
    lines,
    freebies,
    problems,
  }
}

const problemKey = (p: CreationProblem) =>
  [p.code, p.budget ?? '', p.group ?? '', [...p.paths].sort().join(',')].join(
    '|'
  )

export type CreationRefusalCode =
  | 'CREATION_PRIORITIES_REQUIRED'
  | 'CREATION_BUDGET_EXCEEDED'
  | 'CREATION_INCOMPLETE'

export interface CreationRefusal {
  readonly code: CreationRefusalCode
  readonly problems: readonly CreationProblem[]
}

const refusalOf = (problems: readonly CreationProblem[]): CreationRefusal => ({
  code: problems.every(p => p.code === 'CREATION_PRIORITIES_REQUIRED')
    ? 'CREATION_PRIORITIES_REQUIRED'
    : 'CREATION_BUDGET_EXCEEDED',
  problems,
})

/**
 * Avaliação parcial de um lote em `creating` (§3.1): aceita básicos ainda
 * faltando, mas recusa o que piora a conta (bônus acima do saldo, teto,
 * avanço sem prioridade). Compara o resultado inteiro do lote, então uma
 * redistribuição que tira de um campo e põe em outro passa. Um problema que
 * já existia e não piorou não trava o resto da ficha (identidade, notas).
 */
export function checkCreationBatch(
  model: SheetModel,
  before: SheetData | unknown,
  after: SheetData | unknown,
  input: CreationInput
): CreationRefusal | null {
  const b = checkCreation(model, after, input)
  if (b.savable) return null
  const a = checkCreation(model, before, input)
  const known = new Map<string, number>()
  for (const p of a.problems)
    if (p.severity === 'blocking') known.set(problemKey(p), p.amount ?? 0)
  const worse = b.problems.filter(p => {
    if (p.severity !== 'blocking') return false
    const was = known.get(problemKey(p))
    return was === undefined || (p.amount ?? 0) > was
  })
  return worse.length ? refusalOf(worse) : null
}

/** Por que a conta não deixa concluir, ou null quando fecha. */
export function completionRefusal(
  check: CreationCheck
): CreationRefusal | null {
  if (check.complete) return null
  const blocking = check.problems.filter(p => p.severity === 'blocking')
  if (blocking.length) return refusalOf(blocking)
  return { code: 'CREATION_INCOMPLETE', problems: check.problems }
}

/**
 * Valores iniciais que precisam ficar estáveis depois da conclusão: os
 * campos ainda não gravados cujo padrão é fórmula (a Humanidade lê as
 * Virtudes). Gravá-los ao concluir impede que uma evolução posterior das
 * fontes suba o derivado de graça.
 */
export function creationFreeze(
  model: SheetModel,
  sheet: SheetData | unknown
): Readonly<Record<FieldId, unknown>> {
  const data = sheetData(sheet)
  const r: ResolvedSheet = resolve(model, data)
  const out: Record<FieldId, unknown> = {}
  for (const [id, f] of model.fields) {
    if (own(data.values, id)) continue
    const d = f.def
    const formula =
      (d.type === 'rating' && isObj(d.default)) ||
      (d.type === 'resource' && isObj(d.permanent?.default)) ||
      (d.type === 'clock' && d.fills.some(x => isObj(x.default)))
    if (!formula) continue
    const resolved = r.get(id)
    const value = resolved ? stored(resolved, r) : undefined
    if (value !== undefined) out[id] = value
  }
  return out
}
