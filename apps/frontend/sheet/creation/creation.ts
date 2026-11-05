import {
  type CreationAdvice,
  type CreationCheck,
  type CreationChoices,
  type CreationComponent,
  type CreationConfig,
  type CreationGroup,
  type CreationInput,
  type CreationProblem,
  type CreationRefusalCode,
  checkCreationBatch,
  conditionHolds,
  type FieldId,
  type FreebieLine,
  type PointBuyBudget,
  type PriorityBudget,
  type ResolvedSheet,
  type RoleName,
  resolve,
  type SheetData,
  type SheetModel,
} from '@tms/sheet-core'
import type { CharacterStateRow } from '../../components/chronicles/characterState'

// A criação por pontos no app (doc/plano-v4.md, Etapa 5). A conta é a do core
// (`checkCreation`), a mesma do servidor; aqui só se decide quando ela vale,
// onde cada contador aparece e como cada problema vira frase. Nada aqui
// conhece sistema: grupos, orçamentos e rótulos vêm do template.

/** Os metadados de criação que a API manda para dono e narrador. */
export interface CreationInfo {
  readonly revision: number
  readonly mode: 'points' | 'free'
  // O template tem `creation` (sem ela, a criação é sempre livre)
  readonly accounting: boolean
  readonly choices: CreationChoices
  readonly config: Record<string, unknown>
  readonly effective: CreationConfig
  readonly returned: { readonly reason: string; readonly at: string } | null
  // D-04: o narrador pediu ajuste (motivo e data); D-03: o dono avisou que
  // terminou. Ausentes no cache antigo: valem como null (fail secure)
  readonly adjust: { readonly reason: string; readonly at: string } | null
  readonly ready: { readonly at: string } | null
  // A crônica pede aprovação de ficha nova
  readonly approval: boolean
  readonly activatedAt?: string | Date | null
}

const reasonOf = (
  raw: unknown
): { readonly reason: string; readonly at: string } | null => {
  const r = raw as { reason?: unknown; at?: unknown } | null | undefined
  return r && typeof r === 'object' && typeof r.reason === 'string'
    ? { reason: r.reason, at: String(r.at) }
    : null
}

/** Lê o que veio da API (input hostil): forma errada vale como sem criação. */
export function creationInfoOf(raw: unknown): CreationInfo | null {
  const c = raw as Partial<CreationInfo> | null | undefined
  if (!c || typeof c !== 'object') return null
  if (typeof c.revision !== 'number' || !c.effective) return null
  return {
    revision: c.revision,
    mode: c.mode === 'points' ? 'points' : 'free',
    accounting: c.accounting === true,
    choices: (c.choices ?? {}) as CreationChoices,
    config: (c.config ?? {}) as Record<string, unknown>,
    effective: c.effective,
    returned: reasonOf(c.returned),
    adjust: reasonOf(c.adjust),
    ready:
      c.ready && typeof c.ready === 'object' && c.ready.at !== undefined
        ? { at: String(c.ready.at) }
        : null,
    approval: c.approval === true,
    activatedAt: c.activatedAt ?? null,
  }
}

/**
 * A linha do estado (D-02) da ficha aberta, para o `characterState`: o modo
 * e os marcadores que a API mandou. Sem `creation` (viewer, cache antigo),
 * nada é inventado.
 */
export function sheetStateRow(args: {
  readonly status: string
  readonly kind?: 'pc' | 'npc'
  readonly locked: boolean
  readonly info: CreationInfo | null
}): CharacterStateRow {
  const { info } = args
  return {
    status: args.status,
    kind: args.kind,
    locked: args.locked,
    creationMode: info?.mode ?? null,
    returned: info?.returned != null,
    adjust: info?.adjust != null,
    ready: info?.ready != null,
    activatedAt: info?.activatedAt ?? null,
  }
}

/**
 * A conta vale na criação por pontos, em `creating` (dono e narrador) e em
 * `pending` (só o narrador escreve, e ainda passa por ela).
 */
export function creationActive(
  info: CreationInfo | null,
  status: string
): boolean {
  return Boolean(
    info?.accounting &&
      info.mode === 'points' &&
      (status === 'creating' || status === 'pending')
  )
}

export const creationInputOf = (info: CreationInfo): CreationInput => ({
  config: info.effective,
  choices: info.choices,
})

/**
 * O grupo da conta que um bloco da ficha mostra (um grupo da seção ou a
 * seção inteira): todos os campos do bloco estão nos alvos dele.
 */
export function groupFor(
  model: SheetModel,
  fieldIds: readonly FieldId[]
): { readonly budget: string; readonly group: string } | null {
  if (!fieldIds.length) return null
  for (const b of model.template.creation?.budgets ?? []) {
    const groups =
      b.rule === 'priority-budget'
        ? b.groups.map(g => ({ id: g.id, targets: g.targets }))
        : [{ id: b.id, targets: b.targets }]
    for (const g of groups)
      if (fieldIds.every(id => g.targets.includes(id)))
        return { budget: b.id, group: g.id }
  }
  return null
}

export function findGroup(
  check: CreationCheck | null,
  where: { readonly budget: string; readonly group: string } | null
): CreationGroup | null {
  if (!check || !where) return null
  return (
    check.budgets
      .find(b => b.id === where.budget)
      ?.groups.find(g => g.id === where.group) ?? null
  )
}

export const RANKS = ['Primária', 'Secundária', 'Terciária', 'Quarta', 'Quinta']

/** "Primária", "Secundária"... e, depois da quinta, "6ª". */
export const rankLabel = (index: number): string =>
  RANKS[index] ?? `${index + 1}ª`

/**
 * O preço do próximo ponto, no cabeçalho, quando ele já sai do bônus (R-17):
 * na fase de bônus, com os básicos do grupo cheios. O preço é uniforme no
 * grupo (README §14), então um número por grupo basta.
 */
const nextPrice = (g: CreationGroup, phase?: CreationPhase): number | null =>
  phase === 'freebies' &&
  g.budget !== null &&
  g.missing === 0 &&
  g.measure !== 'cost'
    ? g.price
    : null

/** "5/7", "3/3 · +1 bônus", "13/13 · +2 bônus · +1 = 2 bônus". */
export function counterText(g: CreationGroup, phase?: CreationPhase): string {
  if (g.budget === null) return 'Escolha a prioridade'
  const base = `${g.basic}/${g.budget}`
  const extra = g.extra > 0 ? `${base} · +${g.extra} bônus` : base
  const price = nextPrice(g, phase)
  return price === null ? extra : `${extra} · +1 = ${price} bônus`
}

/** O mesmo, por extenso, para o leitor de tela. */
export function counterSpoken(g: CreationGroup, phase?: CreationPhase): string {
  if (g.budget === null) return `${g.label}: escolha a prioridade`
  const items = g.measure === 'items'
  const extra = g.extra > 0 ? `, mais ${g.extra} com bônus` : ''
  const price = nextPrice(g, phase)
  const next =
    price === null
      ? ''
      : `, cada ${items ? 'item' : 'ponto'} a mais custa ${price} de bônus`
  return `${g.label}: ${g.basic} de ${g.budget} ${items ? 'itens' : 'pontos'} básicos${extra}${next}`
}

// As frases-base do plano (§3.6)
export const REFUSAL_TEXT: Readonly<Record<CreationRefusalCode, string>> = {
  CREATION_BUDGET_EXCEEDED:
    'O gasto excede o orçamento ou um limite de criação. Redistribua os pontos.',
  CREATION_PRIORITIES_REQUIRED:
    'Escolha as prioridades deste grupo antes de distribuir os pontos.',
  CREATION_INCOMPLETE:
    'Distribua os pontos básicos restantes antes de concluir.',
}

export const PENDING_TEXT = 'A ficha aguarda aprovação do narrador.'

const isRefusal = (v: unknown): v is CreationRefusalCode =>
  typeof v === 'string' && Object.hasOwn(REFUSAL_TEXT, v)

/** O código de recusa da conta num corpo de erro (input hostil). */
export function creationRefusalOf(body: unknown): CreationRefusalCode | null {
  const code = (body as { code?: unknown } | null)?.code
  return isRefusal(code) ? code : null
}

const fieldLabel = (model: SheetModel, path: string): string => {
  const id = path.replace(/^values\./, '').split('#')[0] ?? ''
  return model.fields.get(id)?.def.label ?? 'Um campo'
}

/**
 * O rótulo do meta que dá o preço do item (o Custo da Qualidade), quando o
 * caminho é de um item de lista com regra `item-meta`; senão null.
 */
function itemPriceMeta(model: SheetModel, path: string): string | null {
  if (!path.includes('#')) return null
  const id = path.replace(/^values\./, '').split('#')[0] ?? ''
  const rule = model.template.costs?.freebie?.find(
    r => r.rule === 'item-meta' && r.targets.includes(id)
  )
  const def = model.fields.get(id)?.def
  if (!rule || def?.type !== 'list') return null
  return def.item.meta?.find(m => m.id === rule.meta)?.label ?? null
}

/** Uma frase por problema, com os rótulos do template; nunca texto da ficha. */
export function problemText(
  model: SheetModel,
  check: CreationCheck | null,
  p: CreationProblem
): string {
  const group =
    check?.budgets
      .find(b => b.id === p.budget)
      ?.groups.find(g => g.id === p.group)?.label ?? 'Um grupo'
  const field = p.paths[0] ? fieldLabel(model, p.paths[0]) : 'Um campo'
  const n = p.amount ?? 0
  switch (p.code) {
    case 'CREATION_PRIORITIES_REQUIRED':
      return `${group}: escolha a prioridade.`
    case 'CREATION_BASICS_UNSPENT':
      return `${group}: ${n === 1 ? 'falta 1 ponto' : `faltam ${n} pontos`} básicos.`
    case 'CREATION_FREEBIES_EXCEEDED':
      return n
        ? `Bônus: ${n} acima do saldo.`
        : 'Bônus: o gasto passa do saldo.'
    case 'CREATION_POINTBUY_EXCEEDED':
      return `${group}: ${n} acima do orçamento.`
    case 'CREATION_POINTBUY_UNSPENT':
      return `${group}: ${n === 1 ? 'falta 1 ponto' : `faltam ${n} pontos`}.`
    case 'CREATION_OUT_OF_RANGE':
      return `${field}: fora da faixa da criação.`
    case 'CREATION_HARD_CAP':
      return `${field}: acima do limite da criação.`
    case 'CREATION_LOCKED':
      return `${field}: não sobe na criação.`
    case 'CREATION_NOT_PURCHASABLE': {
      // O item de uma lista com preço por item (a Qualidade) gravado sem o
      // meta do preço (app antigo, API direta): "não se compra" enganava
      // (QAA-05). O que de fato não se compra (o Renome) segue igual.
      const meta = p.paths[0] ? itemPriceMeta(model, p.paths[0]) : null
      return meta
        ? `${field}: um item está sem ${meta}. Abra o item e informe o ${meta}.`
        : `${field}: não se compra na criação.`
    }
    case 'CREATION_BELOW_INITIAL':
      return `${field}: abaixo do valor inicial.`
  }
}

/**
 * Um aviso que não bloqueia (D-07, D-09), como frase: rótulos do template e
 * números, nunca o nome que o jogador digitou. Não entra no "Faltam" da
 * barra nem esconde o "Concluir": a conta não o lê. Rascunho do time.
 */
export function adviceText(model: SheetModel, a: CreationAdvice): string {
  const def = model.fields.get(a.field)?.def
  const label = def?.label ?? 'Um campo'
  if (a.code === 'ADVICE_OUTSIDE') {
    const outside =
      def?.type === 'list' || def?.type === 'choice'
        ? (def.recommend?.outside ?? 'fora do recomendado')
        : 'fora do recomendado'
    return def?.type === 'choice'
      ? `${label}: ${outside}.`
      : `${label}: ${a.amount} ${outside}.`
  }
  const rule = model.template.creation?.advice?.find(r =>
    r.targets.includes(a.field)
  )
  const meta =
    def?.type === 'list' && rule
      ? def.item.meta?.find(m => m.id === rule.meta)
      : undefined
  return meta && rule
    ? `${label}: ${a.amount} com ${meta.label} acima de ${rule.max}.`
    : `${label}: ${a.amount} acima do limite da criação.`
}

/**
 * Os avisos como itens do "O que falta" (`kind: 'confirm'`): o texto e o
 * alvo (o campo e os caminhos). O P05-D os desenha como itens tocáveis no
 * `useCreationNotices`; até lá, o painel os mostra como texto.
 */
export interface AdviceNotice {
  readonly key: string
  readonly kind: 'confirm'
  readonly text: string
  readonly field: FieldId
  readonly paths: readonly string[]
}

export const adviceNotices = (
  model: SheetModel,
  advice: readonly CreationAdvice[]
): readonly AdviceNotice[] =>
  advice.map(a => ({
    key: `${a.code}:${a.field}`,
    kind: 'confirm',
    text: adviceText(model, a),
    field: a.field,
    paths: a.paths,
  }))

/** O botão de concluir conforme quem conclui e a aprovação (§3.4). */
export function completeLabel(
  info: CreationInfo,
  roles: ReadonlySet<RoleName>
): string {
  if (roles.has('storyteller'))
    return info.approval ? 'Concluir e aprovar' : 'Concluir criação'
  return info.approval ? 'Enviar para aprovação' : 'Concluir criação'
}

/**
 * A ordem nova das prioridades quando o grupo vai para a posição `rank`: troca
 * de lugar com quem estava lá. Sem ordem salva, parte da ordem do template.
 */
export function reorder(
  current: readonly string[] | undefined,
  groups: readonly string[],
  group: string,
  rank: number
): string[] {
  const order =
    current && current.length === groups.length ? [...current] : [...groups]
  const from = order.indexOf(group)
  if (from < 0 || rank < 0 || rank >= order.length) return order
  const other = order[rank] as string
  order[rank] = group
  order[from] = other
  return order
}

/**
 * O aviso da prioridade escolhida (R-28): escolher um grupo põe ou troca os
 * outros de lugar sozinho, e o toast passa a dizer quem mudou. "Prioridades
 * salvas. Sociais ficou Secundária (5) e Mentais, Terciária (3): toque no
 * grupo para trocar." Rótulos do template e números do orçamento efetivo.
 */
export function priorityNote(
  budget: Pick<PriorityBudget, 'groups'>,
  values: readonly number[],
  before: readonly string[] | undefined,
  after: readonly string[],
  group: string
): string {
  const saved = before && before.length === after.length ? before : null
  const moved = after
    .map((id, rank) => ({ id, rank }))
    .filter(({ id, rank }) => id !== group && saved?.indexOf(id) !== rank)
  if (!moved.length) return 'Prioridades salvas'
  const parts = moved.map(({ id, rank }, i) => {
    const label = budget.groups.find(g => g.id === id)?.label ?? id
    const place = `${rankLabel(rank)} (${values[rank] ?? 0})`
    return i === 0 ? `${label} ficou ${place}` : `${label}, ${place}`
  })
  const list =
    parts.length === 1
      ? parts[0]
      : `${parts.slice(0, -1).join(', ')} e ${parts.at(-1)}`
  return `Prioridades salvas. ${list}: toque no grupo para trocar.`
}

/**
 * Em que a distribuição gasta: os pontos básicos de cada grupo ou o saldo de
 * bônus. Em `basics`, o grupo cheio trava; em `freebies`, passar do grupo é
 * pago com bônus, até o saldo acabar.
 */
export type CreationPhase = 'basics' | 'freebies'

/**
 * Por que um toque não entra (R-20): o motivo, para a tela e para o aviso que
 * some quando a causa some (sheetStore). `budget`, `cap`: só do app, na fase
 * de Básicos; os outros repetem a conta do servidor.
 */
export type RefusalCause =
  | 'priorities' // grupo sem prioridade escolhida
  | 'budget' // em Básicos: os pontos básicos do grupo acabaram
  | 'cap' // em Básicos: o traço chegou ao creation-cap
  | 'freebies' // o saldo de bônus não cobre o custo
  | 'ceiling' // hard-cap (Arete ≤ 3, Esfera ≤ Arete)
  | 'locked' // baseline travado (Aparência do Nosferatu)
  | 'not-purchasable' // sem preço de bônus
  | 'other' // outro problema bloqueante da conta

export interface CreationNotice {
  readonly cause: RefusalCause
  // Só rótulos do template e números da conta; nunca texto da ficha
  readonly text: string
  // "Ver orçamento" (T-07): leva à aba onde a fase é escolhida
  readonly action?: 'budget'
}

/** Onde um caminho está na conta: o componente e o grupo ou a linha dele. */
type Placed =
  | {
      readonly component: CreationComponent
      readonly budget: string
      readonly group: CreationGroup
      readonly line?: undefined
    }
  | {
      readonly component: CreationComponent
      readonly line: FreebieLine
      readonly budget?: undefined
      readonly group?: undefined
    }

// Um índice por conta: cada linha da ficha acha o próprio componente sem
// varrer a conta inteira a cada mudança do store (a conta é imutável; uma
// conta nova é outro índice)
const placed = new WeakMap<CreationCheck, ReadonlyMap<string, Placed>>()
function placeOf(check: CreationCheck, path: string): Placed | undefined {
  let index = placed.get(check)
  if (!index) {
    const map = new Map<string, Placed>()
    for (const b of check.budgets)
      for (const group of b.groups)
        for (const component of group.components)
          if (!map.has(component.path))
            map.set(component.path, { component, budget: b.id, group })
    for (const line of check.lines)
      for (const component of line.components ?? [])
        if (!map.has(component.path))
          map.set(component.path, { component, line })
    index = map
    placed.set(check, index)
  }
  return index.get(path)
}

/** "resta 1", "restam 10". */
export const restam = (n: number): string =>
  n === 1 ? 'resta 1' : `restam ${n}`

/** O componente da conta num caminho ("values.alert", "values.x#item"). */
export function componentAt(
  check: CreationCheck | null,
  path: string
): CreationComponent | null {
  return check ? (placeOf(check, path)?.component ?? null) : null
}

/**
 * "(Clã: Nosferatu)": a escolha da ficha que trava o valor inicial. O mesmo
 * critério da conta (checkCreation): o primeiro baseline do campo cuja
 * condição vale.
 */
function lockReason(
  model: SheetModel,
  resolved: ResolvedSheet | undefined,
  c: CreationComponent
): string {
  if (!resolved) return ''
  for (const bl of model.template.creation?.baselines ?? []) {
    if (!bl.targets.includes(c.field)) continue
    if (bl.when && !conditionHolds(resolved, bl.when, c.field)) continue
    if (!bl.locked || !bl.when) return ''
    const r = resolved.get(bl.when.field)
    return r?.type === 'choice' && r.option
      ? ` (${r.field.def.label}: ${r.option.label})`
      : ''
  }
  return ''
}

/** A frase de um problema que um toque piorou (T-57: custo, não estado). */
function refusalNotice(
  model: SheetModel,
  sheets: { readonly before: SheetData; readonly after: SheetData },
  checks: {
    readonly before: CreationCheck | null
    readonly after: CreationCheck | null
  },
  code: CreationRefusalCode,
  problems: readonly CreationProblem[]
): CreationNotice {
  const find = (c: CreationProblem['code']) => problems.find(p => p.code === c)
  const locked = find('CREATION_LOCKED')
  const lockedAt = locked?.paths[0]
  const lockedC = lockedAt ? componentAt(checks.after, lockedAt) : null
  if (locked && lockedAt && lockedC)
    return {
      cause: 'locked',
      text: `${fieldLabel(model, lockedAt)}: fica em ${lockedC.initial} na criação${lockReason(model, resolve(model, sheets.after), lockedC)}.`,
    }
  const hard = find('CREATION_HARD_CAP')
  const hardAt = hard?.paths[0]
  const ceiling = hardAt
    ? componentAt(checks.after, hardAt)?.ceiling
    : undefined
  if (hard && hardAt && ceiling !== undefined)
    return {
      cause: 'ceiling',
      text: `${fieldLabel(model, hardAt)}: na criação, vai até ${ceiling}.`,
    }
  const priorities = find('CREATION_PRIORITIES_REQUIRED')
  if (priorities) {
    const group = checks.after?.budgets
      .find(b => b.id === priorities.budget)
      ?.groups.find(g => g.id === priorities.group)?.label
    return {
      cause: 'priorities',
      text: group
        ? `${group}: escolha a prioridade antes de distribuir os pontos.`
        : REFUSAL_TEXT.CREATION_PRIORITIES_REQUIRED,
    }
  }
  const notPurchasable = find('CREATION_NOT_PURCHASABLE')
  if (notPurchasable)
    return {
      cause: 'not-purchasable',
      text: problemText(model, checks.after, notPurchasable),
    }
  const before = checks.before?.freebies
  const after = checks.after?.freebies
  if (find('CREATION_FREEBIES_EXCEEDED') && before && after) {
    // O custo líquido do toque, com os descontos derivados (a FdV que passa
    // a vir da Coragem custa menos que o preço de tabela)
    const cost = before.remaining - after.remaining
    const left = before.remaining
    return {
      cause: 'freebies',
      text:
        left < 0
          ? `Bônus: o saldo já está ${-left} acima; este ponto custa ${cost}.`
          : `${-after.remaining === 1 ? 'Faltaria 1' : `Faltariam ${-after.remaining}`} de bônus: custa ${cost}, ${restam(left)}.`,
    }
  }
  const first = problems[0]
  return {
    cause: 'other',
    text:
      first && code === 'CREATION_BUDGET_EXCEEDED'
        ? problemText(model, checks.after, first)
        : REFUSAL_TEXT[code],
  }
}

/**
 * Por que uma mudança no rascunho da criação não entra, ou null. A mesma
 * avaliação parcial do "Salvar" (`checkCreationBatch`), agora a cada toque, e
 * em `basics` também o grupo que passaria do orçamento ou o traço que passaria
 * do teto dos básicos. Só o app trava aqui: gastar bônus continua valendo no
 * servidor. Do motivo mais específico para o mais geral (T-07).
 */
export function draftRefusal(
  model: SheetModel,
  sheets: { readonly before: SheetData; readonly after: SheetData },
  checks: {
    readonly before: CreationCheck | null
    readonly after: CreationCheck | null
  },
  input: CreationInput,
  phase: CreationPhase
): CreationNotice | null {
  const refused = checkCreationBatch(model, sheets.before, sheets.after, input)
  if (refused)
    return refusalNotice(model, sheets, checks, refused.code, refused.problems)
  if (phase !== 'basics' || !checks.after) return null
  const freebies = checks.after.freebies !== null
  for (const b of checks.after.budgets)
    for (const g of b.groups) {
      const was = checks.before?.budgets
        .find(x => x.id === b.id)
        ?.groups.find(x => x.id === g.id)
      if (g.budget === null || g.extra <= (was?.extra ?? 0)) continue
      // O que passou dos básicos veio do teto do traço ou do grupo cheio
      const over = (c: CreationComponent) => c.invested - c.eligible
      const capped = g.components.find(c => {
        const old = was?.components.find(x => x.path === c.path)
        return c.cap !== undefined && over(c) > (old ? over(old) : 0)
      })
      const action =
        freebies && g.price !== null ? { action: 'budget' as const } : {}
      if (capped?.cap !== undefined)
        return {
          cause: 'cap',
          text: capText(model, capped, g, freebies),
          ...action,
        }
      return { cause: 'budget', text: basicsSpentText(g, freebies), ...action }
    }
  return null
}

/** "Prontidão: com pontos básicos, vai até 3. Acima disso, cada ponto ..." */
function capText(
  model: SheetModel,
  c: CreationComponent,
  g: CreationGroup,
  freebies: boolean
): string {
  const first = `${fieldLabel(model, c.path)}: com pontos básicos, vai até ${c.cap}.`
  return freebies && g.price !== null
    ? `${first} Acima disso, cada ponto custa ${g.price} de bônus.`
    : first
}

/**
 * O que o próximo ponto de um campo faria, antes do toque (T-20, R-17).
 * `blocked`: a trava prevista; `text`: o motivo ou o custo; `cost`: bônus
 * pelo preço de tabela (0: pago com básicos); `inline`: o texto aparece
 * escrito na linha, porque o cabeçalho do grupo não o diz.
 */
export interface StepAdvice {
  readonly blocked: RefusalCause | null
  readonly text: string | null
  readonly cost: number | null
  readonly inline: boolean
}

const advice = (
  blocked: RefusalCause | null,
  text: string | null,
  cost: number | null = null,
  inline = false
): StepAdvice => ({ blocked, text, cost, inline })

const bonus = (n: number) => `+1 = ${n} bônus`

/**
 * A previsão do "+", pela conta que o store já tem e pelo preço de tabela,
 * sem reavaliar a ficha. É uma previsão, não a decisão: os descontos
 * derivados (a FdV que passa a vir da Coragem) podem fazer o ponto custar
 * menos. Por isso o "+" bloqueado continua tocável, e quem decide é o
 * draftRefusal, com a conta exata, e depois o servidor. Caminho fora de
 * qualquer conta: null (o toque decide).
 */
export function stepAdvice(
  model: SheetModel,
  check: CreationCheck,
  phase: CreationPhase,
  path: string,
  resolved?: ResolvedSheet
): StepAdvice | null {
  const freebies = check.freebies
  const limits = (c: CreationComponent): StepAdvice | null => {
    if (c.locked && c.value >= c.initial)
      return advice(
        'locked',
        `Fica em ${c.initial} na criação${lockReason(model, resolved, c)}.`
      )
    if (c.ceiling !== undefined && c.value >= c.ceiling)
      return advice('ceiling', `Na criação, vai até ${c.ceiling}.`)
    return null
  }
  const at = placeOf(check, path)
  if (!at) return null
  const c = at.component
  const g = at.group
  if (g?.budget === null)
    return advice(
      'priorities',
      `${g.label}: escolha a prioridade antes de distribuir os pontos.`
    )
  const limit = limits(c)
  if (limit) return limit
  // Abaixo do inicial (no point-buy, abaixo da base), o ponto só devolve o
  // que faltava
  if (c.value < c.initial) return advice(null, null, 0)
  if (g) {
    if (g.measure === 'cost') return pointBuyAdvice(model, at.budget, g, c)
    return groupAdvice(g, c, phase, freebies)
  }
  const { price } = at.line
  if (price === undefined || !freebies) return null
  // Linha de bônus fora dos orçamentos (FdV, Humanidade): o cabeçalho não
  // diz o preço, a linha diz
  return price > freebies.remaining
    ? advice(
        'freebies',
        `${bonus(price)}; ${restam(Math.max(0, freebies.remaining))}.`,
        price,
        true
      )
    : advice(null, bonus(price), price, true)
}

/** O próximo ponto num grupo de orçamento: básico, teto, preço ou saldo. */
function groupAdvice(
  g: CreationGroup,
  c: CreationComponent,
  phase: CreationPhase,
  freebies: CreationCheck['freebies']
): StepAdvice {
  const atCap = c.cap !== undefined && c.value >= c.cap
  const price = freebies !== null ? g.price : null
  // O cabeçalho diz "3/13": o teto do traço, com o grupo incompleto, só a
  // linha explica
  const inline = g.missing > 0
  if (phase === 'basics') {
    if (atCap)
      return advice(
        'cap',
        `Com pontos básicos, vai até ${c.cap}.${price !== null ? ` Acima disso, ${bonus(price)}.` : ''}`,
        null,
        inline
      )
    if (g.missing === 0)
      return advice('budget', basicsSpentText(g, freebies !== null))
    return advice(null, null, 0)
  }
  if (!atCap && g.missing > 0) return advice(null, null, 0)
  // Daqui em diante, o ponto sai do bônus
  if (price === null || freebies === null)
    return atCap
      ? advice(
          'not-purchasable',
          `Com pontos básicos, vai até ${c.cap}; acima disso, não se compra com bônus.`,
          null,
          inline
        )
      : advice(
          'not-purchasable',
          `${g.label}: os pontos básicos acabaram, e o grupo não se compra com bônus.`
        )
  return price > freebies.remaining
    ? advice(
        'freebies',
        `${bonus(price)}; ${restam(Math.max(0, freebies.remaining))}.`,
        price,
        inline
      )
    : advice(null, bonus(price), price, inline)
}

/**
 * O que um item novo na lista faria na conta, antes do toque (a prévia da
 * folha "Adicionar …", P07-C §3.1): uma linha por folha, não por opção, porque
 * o custo é o mesmo para todas as opções. Pelo grupo do orçamento da lista
 * (básicos, depois bônus) ou pela linha de bônus por item (Custo da
 * Qualidade, crédito do Defeito). É previsão: o toque decide, pela conta
 * exata, com a recusa dentro da folha. Fora de qualquer conta: null.
 */
export function addAdvice(
  model: SheetModel,
  check: CreationCheck,
  phase: CreationPhase,
  list: FieldId
): string | null {
  const freebies = check.freebies
  const g = findGroup(check, groupFor(model, [list]))
  if (g) {
    if (g.budget === null)
      return `${g.label}: escolha a prioridade antes de distribuir os pontos.`
    if (g.missing > 0)
      return `Entra com os pontos básicos (faltam ${g.missing} de ${g.budget}).`
    if (phase === 'basics') return basicsSpentText(g, freebies !== null)
    if (g.price === null || !freebies)
      return `${g.label}: os pontos básicos acabaram, e o grupo não se compra com bônus.`
    return g.measure === 'items'
      ? `${g.label}: o próximo custa ${g.price} de bônus; ${restam(Math.max(0, freebies.remaining))}.`
      : `${bonus(g.price)}; ${restam(Math.max(0, freebies.remaining))}.`
  }
  const rule = model.template.costs?.freebie?.find(r =>
    r.targets.includes(list)
  )
  const def = model.fields.get(list)?.def
  const meta =
    rule?.meta && def?.type === 'list'
      ? def.item.meta?.find(m => m.id === rule.meta)
      : undefined
  if (!rule || !freebies) return null
  if (rule.rule === 'item-meta' && meta)
    return `Custa o ${meta.label} do item em bônus (começa em ${meta.min ?? 0}); ${restam(Math.max(0, freebies.remaining))}.`
  if (rule.rule === 'credit' && meta)
    return `Devolve o ${meta.label} do item, até ${rule.max ?? 0} no total.`
  if (rule.rule === 'flat' && rule.cost !== undefined)
    return `${bonus(rule.cost)}; ${restam(Math.max(0, freebies.remaining))}.`
  return null
}

/**
 * A previsão do "+" de um meta que é preço do item (T-08): o Custo da
 * Qualidade (`item-meta`) e o Bônus do Defeito (`credit`). Pela conta que o
 * store tem: com o meta já mudado na folha, quem decide é o "Aplicar" (a
 * conta exata) e depois o servidor. Meta fora dessas regras: null.
 */
export function metaAdvice(
  model: SheetModel,
  check: CreationCheck,
  list: FieldId,
  meta: string
): StepAdvice | null {
  const rule = model.template.costs?.freebie?.find(
    r =>
      (r.rule === 'item-meta' || r.rule === 'credit') &&
      r.meta === meta &&
      r.targets.includes(list)
  )
  const freebies = check.freebies
  if (!rule || !freebies) return null
  if (rule.rule === 'credit') {
    const line = check.lines.find(l => l.id === rule.id)
    const max = rule.max ?? 0
    return (line?.cost ?? 0) >= max
      ? advice(null, `+1 não devolve mais: o crédito já está em ${max}.`)
      : advice(null, `+1 = devolve 1, até ${max}.`)
  }
  return freebies.remaining < 1
    ? advice(
        'freebies',
        `${bonus(1)}; ${restam(Math.max(0, freebies.remaining))}.`,
        1
      )
    : advice(null, `${bonus(1)}; ${restam(freebies.remaining)}.`, 1)
}

/** Point-buy (D&D): o degrau da tabela do template e o fim dela. */
function pointBuyAdvice(
  model: SheetModel,
  budgetId: string,
  g: CreationGroup,
  c: CreationComponent
): StepAdvice | null {
  const def = model.template.creation?.budgets.find(
    (b): b is PointBuyBudget => b.id === budgetId && b.rule === 'point-buy'
  )
  if (!def) return null
  const now = def.table[c.value - def.base]
  const next = def.table[c.value + 1 - def.base]
  if (next === undefined)
    return advice(
      'ceiling',
      `Na criação, vai até ${def.base + def.table.length - 1}.`,
      null,
      true
    )
  const step = next - (now ?? 0)
  const unit = (n: number) => (n === 1 ? '1 ponto' : `${n} pontos`)
  return step > g.missing
    ? advice(
        'budget',
        `+1 = ${unit(step)}; ${g.missing === 1 ? 'falta 1' : `faltam ${g.missing}`} de ${g.budget}.`,
        null,
        true
      )
    : advice(null, `+1 = ${unit(step)}`, null, true)
}

/**
 * O saldo de bônus por extenso (T-18): "Bônus: restam 10 de 15", que não se
 * lê como "usei 10"; acima do saldo, quanto passa. Null sem bônus.
 */
export function freebiesBalance(check: CreationCheck | null): string | null {
  const f = check?.freebies
  if (!f) return null
  return f.remaining < 0
    ? `Bônus: ${-f.remaining} acima do saldo`
    : `Bônus: ${restam(f.remaining)} de ${f.available + f.credit}`
}

/**
 * A sobra de bônus ao concluir ou enviar (T-18): "Sobram 4 pontos de bônus.
 * Eles não viram XP." Concluir com sobra continua permitido (README §14,
 * item 6: a sobra não vira XP). Null sem bônus ou sem sobra.
 */
export function freebiesLeftNote(n: number | null): string | null {
  if (n === null || n <= 0) return null
  return n === 1
    ? 'Sobra 1 ponto de bônus. Ele não vira XP.'
    : `Sobram ${n} pontos de bônus. Eles não viram XP.`
}

/**
 * A sobra que as confirmações mostram: só com a conta fechada. Com básicos
 * faltando, o servidor recusa concluir (CREATION_INCOMPLETE), e "Sobram 15"
 * diria que só faltam bônus.
 */
export const completionFreebies = (
  check: CreationCheck | null
): number | null =>
  check?.complete && check.freebies ? check.freebies.remaining : null

/** As linhas extras das confirmações de concluir e aprovar (T-18, T-32). */
export const freebiesNotes = (n: number | null): readonly string[] => {
  const note = freebiesLeftNote(n)
  return note ? [note] : NO_NOTES
}

const NO_NOTES: readonly string[] = []

/** Uma linha do extrato do bônus: a fonte e, às vezes, o porquê. */
export interface LedgerEntry {
  readonly key: string
  readonly text: string
  readonly detail: string | null
}

export interface FreebieLedger {
  readonly entries: readonly LedgerEntry[]
  readonly total: string
}

/** "que vem de Consciência + Autocontrole": a fonte do valor de partida. */
function startSource(model: SheetModel, field: FieldId): string | null {
  const def = model.fields.get(field)?.def
  const formula =
    def?.type === 'rating'
      ? def.default
      : def?.type === 'resource'
        ? def.permanent?.default
        : undefined
  if (!formula || typeof formula !== 'object') return null
  const from: readonly FieldId[] = Array.isArray(formula.from)
    ? formula.from
    : [formula.from as FieldId]
  const labels = from.map(id => model.fields.get(id)?.def.label ?? id)
  return labels.length ? labels.join(' + ') : null
}

/**
 * O extrato dos pontos de bônus (R-17): de onde veio cada gasto e cada
 * crédito, com o total igual ao saldo da conta. Tudo vem da `CreationCheck`,
 * a mesma conta do servidor: nada aqui só o servidor sabe. Sem nome de item
 * (texto da ficha), só contagem. Null sem bônus ou sem nada gasto.
 */
export function freebieLedger(
  model: SheetModel,
  check: CreationCheck | null
): FreebieLedger | null {
  const f = check?.freebies
  if (!check || !f) return null
  const label = (id: FieldId) => model.fields.get(id)?.def.label ?? id
  const entries: LedgerEntry[] = []
  for (const b of check.budgets)
    for (const g of b.groups) {
      if (g.freebieCost <= 0 || g.price === null) continue
      const name =
        b.rule === 'priority-budget' ? `${b.label} › ${g.label}` : g.label
      // O que passou do teto dos básicos foi pago com bônus mesmo com o
      // grupo incompleto (T-07)
      const over = g.components
        .filter(c => c.cap !== undefined && c.invested > c.eligible)
        .map(
          c => `${label(c.field)} acima de ${c.cap}: ${c.invested - c.eligible}`
        )
      entries.push({
        key: `${b.id}.${g.id}`,
        text: `${name}: ${g.extra} × ${g.price} = ${g.freebieCost}`,
        detail: over.length ? over.join(' · ') : null,
      })
    }
  for (const l of check.lines) {
    if (l.units <= 0 && l.cost <= 0) continue
    const fields = [
      ...new Set(
        (l.components ?? []).filter(c => c.invested > 0).map(c => c.field)
      ),
    ]
    const first = l.paths[0]?.replace(/^values\./, '').split('#')[0] ?? ''
    const name = fields.length
      ? fields.map(label).join(', ')
      : label(first as FieldId)
    if (l.rule === 'flat') {
      // O valor de partida derivado (a FdV que parte da Coragem): é o
      // desconto que ninguém via (IA-12, NW-22)
      const starts = (l.components ?? [])
        .filter(c => c.invested > 0)
        .map(c => {
          const source = startSource(model, c.field)
          return source ? `parte de ${c.initial}, que vem de ${source}` : null
        })
        .filter((x): x is string => x !== null)
      entries.push({
        key: l.id,
        text: `${name}: ${l.units} × ${l.price ?? 0} = ${l.cost}`,
        detail: starts.length ? starts.join(' · ') : null,
      })
    } else if (l.rule === 'item-meta') {
      const n = l.paths.length
      entries.push({
        key: l.id,
        text: `${name} (${n === 1 ? '1 item' : `${n} itens`}): ${l.cost}`,
        detail: null,
      })
    } else
      entries.push({
        key: l.id,
        text:
          l.units === l.cost
            ? `${name}: devolvem ${l.units}`
            : `${name}: devolvem ${l.units}, contam ${l.cost}`,
        detail: null,
      })
  }
  if (!entries.length) return null
  const total = f.available + f.credit
  return {
    entries,
    total: [
      `Gastos ${f.spent}`,
      f.credit ? `crédito ${f.credit}` : null,
      f.remaining < 0
        ? `${-f.remaining} acima do saldo de ${total}`
        : `${restam(f.remaining)} de ${total}`,
    ]
      .filter(Boolean)
      .join(' · '),
  }
}

/**
 * Todos os pontos básicos distribuídos (cada grupo com a prioridade escolhida
 * e o orçamento cheio) e ainda há bônus para gastar: a hora de avisar que a
 * distribuição passa a gastar os pontos de bônus.
 */
export function basicsDone(check: CreationCheck | null): boolean {
  if (!check?.freebies || check.freebies.remaining <= 0) return false
  const groups = check.budgets.flatMap(b => b.groups)
  return (
    groups.length > 0 && groups.every(g => g.budget !== null && g.missing === 0)
  )
}

/** "Físicos: os 7 pontos básicos já foram usados. Para passar disso, ..." */
export function basicsSpentText(g: CreationGroup, freebies: boolean): string {
  const items = g.measure === 'items'
  const spent = `${g.label}: os ${g.budget} ${items ? 'itens' : 'pontos'} básicos já foram usados.`
  return freebies && g.price !== null
    ? `${spent} Para passar disso, use os pontos de bônus (${g.price} por ${items ? 'item' : 'ponto'}).`
    : spent
}

/** O corpo de um erro da API (`error.value`), ou null. */
export const errorBodyOf = (error: unknown): unknown =>
  (error as { value?: unknown } | null)?.value ?? null
