import { createContext, useContext } from 'react'
import type { CreationInfo } from './creation'
import type { GuideTarget } from './guide'

// O que a tela da ficha sabe da criação: os metadados que a API mandou, o
// estado da ficha e se a conta vale agora. Sem provedor (prévias, Mesa,
// testes antigos), não há criação por pontos.

export interface CreationContextValue {
  readonly characterId: string
  readonly chronicleId: string
  readonly status: string
  // PC ou NPC: o NPC não tem selo de estado da criação (o dele é o do P11)
  readonly kind?: 'pc' | 'npc'
  readonly info: CreationInfo | null
  // A conta vale: criação por pontos em creating ou pending
  readonly active: boolean
  // O narrador concluiu a criação com a dona no Editar e alterações não
  // salvas (nota do P04-C, no P04-D): elas agora são evolução
  readonly completedWhileEditing?: boolean
}

export const CreationContext = createContext<CreationContextValue | null>(null)

export const useCreation = (): CreationContextValue | null =>
  useContext(CreationContext)

/**
 * "Ver Pontos" (T-07): leva à aba Pontos, onde a fase é escolhida. A
 * tela da ficha o passa ao SheetProvider só quando a aba existe (Criação por
 * pontos em `creating`); sem ele, o aviso não oferece o atalho.
 */
export const OpenBudgetContext = createContext<(() => void) | null>(null)

export const useOpenBudget = (): (() => void) | null =>
  useContext(OpenBudgetContext)

/**
 * O "ir ao grupo" (P05-D, R-18): leva à aba, à sub-aba e ao começo da seção
 * ou do grupo, com o foco no título. Null (sem alvo) leva à lista inteira,
 * na aba Pontos. Sem provedor (prévias, Mesa), não há para onde ir.
 */
export const GuideNavContext = createContext<
  ((target: GuideTarget | null) => void) | null
>(null)

export const useGuideNav = (): ((target: GuideTarget | null) => void) | null =>
  useContext(GuideNavContext)
