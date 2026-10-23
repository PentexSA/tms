import type {
  CreationCheck,
  CreationChoices,
  CreationConfig,
  CreationGroup,
  CreationInput,
  CreationProblem,
  CreationRefusalCode,
  FieldId,
  RoleName,
  SheetModel,
} from '@tms/sheet-core'

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
  // A crônica pede aprovação de ficha nova
  readonly approval: boolean
  readonly activatedAt?: string | Date | null
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
    returned:
      c.returned && typeof c.returned.reason === 'string'
        ? { reason: c.returned.reason, at: String(c.returned.at) }
        : null,
    approval: c.approval === true,
    activatedAt: c.activatedAt ?? null,
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

/** "5/7", "3/3 · +1 bônus", "Escolha a prioridade". */
export function counterText(g: CreationGroup): string {
  if (g.budget === null) return 'Escolha a prioridade'
  const base = `${g.basic}/${g.budget}`
  return g.extra > 0 ? `${base} · +${g.extra} bônus` : base
}

/** O mesmo, por extenso, para o leitor de tela. */
export function counterSpoken(g: CreationGroup): string {
  if (g.budget === null) return `${g.label}: escolha a prioridade`
  const unit = g.measure === 'items' ? 'itens' : 'pontos'
  const extra = g.extra > 0 ? `, mais ${g.extra} com bônus` : ''
  return `${g.label}: ${g.basic} de ${g.budget} ${unit} básicos${extra}`
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
    case 'CREATION_NOT_PURCHASABLE':
      return `${field}: não se compra na criação.`
    case 'CREATION_BELOW_INITIAL':
      return `${field}: abaixo do valor inicial.`
  }
}

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
