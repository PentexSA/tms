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

// U-11 (P16-D): a nota revelada ao dono, só em leitura. Os textos dizem o
// estado ao narrador o tempo todo; nunca repetem o conteúdo da nota.
export const revealedNote = (owner: string) => `reveladas: ${owner} lê`
export const revealedNoteA11y = (owner: string) => `Reveladas: ${owner} lê`
export const revealedNoteSheet = (owner: string) =>
  `Reveladas: ${owner} lê o que você salvar aqui.`
export const REVEALED_BY_STORYTELLER = 'reveladas pelo narrador'
export const REVEALED_OFFLINE = 'Conecte-se para ler as notas reveladas.'
export const REVEALED_FAILED = 'Não foi possível carregar as notas reveladas.'
export const REVEAL_OFFLINE =
  'Sem conexão: revelar e esconder precisam de rede.'

/** O campo está numa seção revelada (e o template a deixa revelar). */
export function inRevealed(
  model: SheetModel,
  id: FieldId,
  sections: ReadonlySet<string>
): boolean {
  if (sections.size === 0) return false
  return canRead(model, id, ['owner'], sections)
}
