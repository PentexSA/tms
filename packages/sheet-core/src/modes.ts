import type { CompiledField } from './compile'

// Modos da ficha no app (design system §8.1). É UX, NÃO é controle de acesso:
// o servidor valida cada escrita pelas permissões (permissions.ts).
export type SheetMode = 'read' | 'play' | 'evolve'

export function isEditableIn(field: CompiledField, mode: SheetMode): boolean {
  if (field.readOnly || mode === 'read') return false
  // Em Evoluir, tudo o que o papel pode escrever muda (num rascunho).
  if (mode === 'evolve') return true
  return field.editableIn.includes('play')
}
