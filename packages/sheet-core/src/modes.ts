import type { CompiledField } from './compile'

// Modos da ficha no app (design system §8.1). É UX, NÃO é controle de acesso:
// o servidor valida cada escrita pelas permissões (permissions.ts).
// `create` (v4) é o Evoluir da criação por pontos: o mesmo rascunho, com os
// contadores da conta e a conclusão (doc/plano-v4.md, Etapa 5). Não confundir
// com `editableIn` (`play`/`edit`), que diz em que modo cada campo muda.
export type SheetMode = 'read' | 'play' | 'evolve' | 'create'

/** Os modos em que as alterações vão para um rascunho salvo num lote só. */
export const isDraftMode = (mode: SheetMode): boolean =>
  mode === 'evolve' || mode === 'create'

export function isEditableIn(field: CompiledField, mode: SheetMode): boolean {
  if (field.readOnly || mode === 'read') return false
  // Em Evoluir e na criação, tudo o que o papel pode escrever muda (num
  // rascunho).
  if (isDraftMode(mode)) return true
  return field.editableIn.includes('play')
}
