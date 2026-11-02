import { canRead, type FieldId, type SheetModel } from '@tms/sheet-core'

// R-09 (P09-C): o campo que o narrador lê e o dono não (as Notas do Narrador
// no Vampiro, as do Mestre no D&D) diz que é privado. Vem das permissões do
// template; o servidor já tira o campo de toda resposta ao dono
// (`stripRestricted`). Módulo próprio: a Leitura (TextLayout) e a barra do
// narrador o usam sem depender uma da outra.

export function hiddenFromOwner(model: SheetModel, id: FieldId): boolean {
  return canRead(model, id, ['storyteller']) && !canRead(model, id, ['owner'])
}

// O rótulo diz que o jogador não lê; nunca repete o conteúdo da nota
export const PRIVATE_NOTE = 'privadas: o jogador não vê'
export const PRIVATE_NOTE_A11Y = 'Privadas: o jogador não vê'
export const PRIVATE_NOTE_SHEET = 'Privadas: o jogador não vê estas notas.'
// O canal certo para o recado ao jogador é o "Pedir ajuste" (D-04, P04-D)
export const ADJUST_HINT =
  "Para pedir uma correção ao jogador, use 'Pedir ajuste' em Ações do narrador."
