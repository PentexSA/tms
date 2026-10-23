import type { CapRule } from '../registry'
import type { FieldId } from './fields'

// Contabilização da criação e da evolução (design/templates/README.md §14,
// doc/plano-v4.md §3). O template declara orçamentos, tetos e preços; o core
// calcula (checkCreation, costOf). Nada aqui é expressão: só listas fechadas e
// comparações declarativas.

/**
 * Comparação declarativa com um `choice` da ficha. `in`: a opção escolhida
 * está na lista. `equalsTarget`: a opção escolhida é o id do campo-alvo (a
 * Esfera de afinidade). `itemIn`: o item-alvo de uma lista tem um destes nomes
 * do catálogo (Disciplinas do clã). Todas as chaves presentes precisam valer.
 */
export interface AccountingCondition {
  readonly field: FieldId
  readonly in?: readonly string[]
  readonly equalsTarget?: boolean
  readonly itemIn?: readonly string[]
}

export interface BudgetGroupDef {
  readonly id: string
  readonly label: string
  readonly targets: readonly FieldId[]
}

/** Orçamentos por prioridade: o jogador ordena os grupos (Atributos 7/5/3). */
export interface PriorityBudget {
  readonly id: string
  readonly label: string
  readonly rule: 'priority-budget'
  // Do primário ao último; um por grupo.
  readonly budgets: readonly number[]
  readonly groups: readonly BudgetGroupDef[]
}

/**
 * Orçamento fixo de pontos (`fixed-budget`: Disciplinas 3) ou de itens
 * (`item-count`: os Dons iniciais).
 */
export interface FixedBudget {
  readonly id: string
  readonly label: string
  readonly rule: 'fixed-budget' | 'item-count'
  readonly budget: number
  readonly targets: readonly FieldId[]
}

/**
 * Custo cumulativo por valor (point-buy do D&D: 8 custa 0, 15 custa 9).
 * `table[i]` é o custo total de ter `base + i`; fora da tabela, recusado.
 */
export interface PointBuyBudget {
  readonly id: string
  readonly label: string
  readonly rule: 'point-buy'
  readonly budget: number
  readonly base: number
  readonly table: readonly number[]
  readonly targets: readonly FieldId[]
}

export type CreationBudget = PriorityBudget | FixedBudget | PointBuyBudget

/**
 * `creation-cap`: até onde os pontos básicos pagam (Habilidade 3); acima,
 * só bônus. `hard-cap`: limite da criação, com básicos ou bônus (Arete 3;
 * Esfera até o Arete, com `max: { field }`).
 */
export interface CreationCap {
  readonly rule: CapRule
  readonly targets: readonly FieldId[]
  readonly max: number | { readonly field: FieldId }
}

/**
 * Valor inicial condicional: substitui o padrão do campo na conta. `locked`
 * proíbe comprar acima dele na criação.
 */
export interface CreationBaseline {
  readonly targets: readonly FieldId[]
  readonly value: number
  readonly locked?: boolean
  readonly when?: AccountingCondition
}

export interface CreationDef {
  // Saldo de pontos de bônus.
  readonly freebies?: number
  readonly budgets: readonly CreationBudget[]
  readonly caps?: readonly CreationCap[]
  readonly baselines?: readonly CreationBaseline[]
  // Campos de evolução que a criação não contabiliza (fail secure: o que não
  // está em nenhuma conta nem aqui não sobe na criação por pontos).
  readonly untracked?: readonly FieldId[]
}

/**
 * Preço em pontos de bônus. `flat`: `cost` por ponto (ou por item, num
 * orçamento `item-count`). `item-meta`: cada item custa o número do seu
 * `meta[meta]` (Qualidades). `credit`: os itens devolvem a soma de
 * `meta[meta]`, até `max` (Defeitos).
 */
export interface FreebieCost {
  readonly id: string
  readonly rule: 'flat' | 'item-meta' | 'credit'
  readonly targets: readonly FieldId[]
  readonly cost?: number
  readonly meta?: string
  readonly max?: number
}

/** Exceção de preço: a primeira que vale substitui os parâmetros da regra. */
export interface XpWhen {
  readonly if: AccountingCondition
  readonly cost?: number
  readonly factor?: number
  readonly new?: number
  readonly unavailable?: boolean
}

/**
 * Preço em XP de subir um nível. `flat`: `cost` por nível. `per-current`:
 * valor atual × `factor`. `new`: preço do primeiro ponto; sem ele, comprar a
 * partir de 0 só vale em `flat` (nunca de graça).
 */
export interface XpCost {
  readonly id: string
  readonly rule: 'flat' | 'per-current'
  readonly targets: readonly FieldId[]
  readonly cost?: number
  readonly factor?: number
  readonly new?: number
  readonly when?: readonly XpWhen[]
}

/** O extrato de XP projeta nestes campos; nenhum papel os grava por evento. */
export interface XpCosts {
  readonly total: FieldId
  readonly spent: FieldId
  // Sem regras, o template só mapeia o extrato (preços ainda não conferidos).
  readonly rules?: readonly XpCost[]
}

export interface CostsDef {
  readonly freebie?: readonly FreebieCost[]
  readonly xp?: XpCosts
}
