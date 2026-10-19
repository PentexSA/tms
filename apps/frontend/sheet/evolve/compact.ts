import { createContext, useContext } from 'react'

// Editor em célula estreita (as colunas do cabeçalho no Editar): sem o respiro
// lateral da linha e sem a palavra da ação; o leitor de tela segue ouvindo a
// dica ("Abre o editor de texto").
const Compact = createContext(false)

export const CompactEditors = Compact.Provider
export const useCompact = () => useContext(Compact)
