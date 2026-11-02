import {
  type CreationConfig,
  type CreationConfigLayer,
  effectiveCreationConfig,
  type SheetModel,
} from '@tms/sheet-core'

// O modo e o orçamento da criação em uma linha (T-29): a Nova ficha e a
// crônica dizem em que modo a ficha vai abrir e quanto o orçamento dá. Tudo
// vem do template (rótulos e orçamentos) e da camada da crônica; nenhum nome
// de sistema aqui. O painel do narrador (D-10, P09-D) reaproveita a linha.

export interface CreationSummary {
  // Por pontos (a ficha abre em Criação) ou livre (em Editar)
  readonly mode: 'points' | 'free'
  // "Atributos 7/5/3", "Disciplinas 3", "15 de bônus": só na criação por pontos
  readonly parts: readonly string[]
  // A crônica pede aprovação de ficha nova (só vale na criação por pontos)
  readonly approval: boolean
}

/** O resumo de uma configuração efetiva. */
export function creationSummary(
  model: SheetModel,
  config: CreationConfig,
  approval: boolean
): CreationSummary {
  const def = model.template.creation
  if (!def || config.mode !== 'points')
    return { mode: 'free', parts: [], approval: false }
  const parts = def.budgets.map(budget => {
    const override = config.budgets?.[budget.id]
    if (budget.rule === 'priority-budget') {
      const list = Array.isArray(override) ? override : budget.budgets
      return `${budget.label} ${list.join('/')}`
    }
    return `${budget.label} ${typeof override === 'number' ? override : budget.budget}`
  })
  if (config.freebies !== undefined) parts.push(`${config.freebies} de bônus`)
  return { mode: 'points', parts, approval }
}

/** O padrão da crônica como camada (forma errada vale como camada vazia). */
export const layerOf = (value: unknown): CreationConfigLayer =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as CreationConfigLayer)
    : {}

/**
 * O resumo da crônica: o template e, por cima, o padrão da crônica, que é a
 * camada com que a ficha nova nasce.
 */
export const chronicleCreationSummary = (
  model: SheetModel,
  creation: { readonly approval: boolean; readonly defaults: unknown }
): CreationSummary =>
  creationSummary(
    model,
    effectiveCreationConfig(model, layerOf(creation.defaults)),
    creation.approval
  )

/**
 * "Criação por pontos · Atributos 7/5/3 · … · 15 de bônus · aprovação
 * ligada" ou "Criação livre · o narrador conclui".
 */
export const summaryLine = (summary: CreationSummary): string =>
  summary.mode === 'points'
    ? [
        'Criação por pontos',
        ...summary.parts,
        summary.approval ? 'aprovação ligada' : 'aprovação desligada',
      ].join(' · ')
    : 'Criação livre · o narrador conclui'

/** O texto de topo da Nova ficha: o modo em que a ficha vai abrir. */
export function newCharacterIntro(summary: CreationSummary): string {
  if (summary.mode === 'free')
    return 'Esta crônica usa criação livre, sem conta de pontos. Comece pela identidade; o resto você monta depois, na ficha, no modo Editar. O narrador conclui a criação.'
  const approval = summary.approval
    ? ' O narrador aprova a ficha antes de ela entrar em jogo.'
    : ''
  return `Esta crônica usa criação por pontos: ${summary.parts.join(' · ')}. Comece pela identidade; os pontos você distribui depois, na ficha, no modo Criação.${approval}`
}
