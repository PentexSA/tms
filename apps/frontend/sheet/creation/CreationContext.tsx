import { createContext, useContext } from 'react'
import type { CreationInfo } from './creation'

// O que a tela da ficha sabe da criação: os metadados que a API mandou, o
// estado da ficha e se a conta vale agora. Sem provedor (prévias, Mesa,
// testes antigos), não há criação por pontos.

export interface CreationContextValue {
  readonly characterId: string
  readonly chronicleId: string
  readonly status: string
  readonly info: CreationInfo | null
  // A conta vale: criação por pontos em creating ou pending
  readonly active: boolean
}

export const CreationContext = createContext<CreationContextValue | null>(null)

export const useCreation = (): CreationContextValue | null =>
  useContext(CreationContext)
