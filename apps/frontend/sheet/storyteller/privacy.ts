import {
  canRead,
  type FieldId,
  type RoleName,
  type SheetModel,
} from '@tms/sheet-core'

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

// U-10 (P15-D): o campo que o dono lê (a História / Prelúdio, a Citação, as
// Notas do jogador). Também pelas permissões: nada aqui conhece campo.
export function readByOwner(model: SheetModel, id: FieldId): boolean {
  return canRead(model, id, ['owner'])
}

// O editor do texto público diz o contrário do das Notas do Narrador
export const SHARED_NOTE_SHEET = 'O jogador lê este texto.'

/**
 * O aviso do editor de texto: só quando quem edita é o narrador de uma ficha
 * que não é dele. Texto que o dono não lê é privado; numa ficha de jogador,
 * texto que o dono lê diz que o jogador lê. O dono não recebe aviso (o
 * narrador lê toda a ficha), e o NPC não tem jogador dono.
 */
export function editorNotice(
  model: SheetModel,
  id: FieldId,
  roles: ReadonlySet<RoleName> | readonly RoleName[],
  npc: boolean
): string | null {
  const mine = new Set(roles)
  if (!mine.has('storyteller') || mine.has('owner')) return null
  if (hiddenFromOwner(model, id)) return PRIVATE_NOTE_SHEET
  if (npc) return null
  return readByOwner(model, id) ? SHARED_NOTE_SHEET : null
}

// O canal certo para o recado ao jogador é o "Pedir ajuste" (D-04, P04-D)
export const ADJUST_HINT =
  "Para pedir uma correção ao jogador, use 'Pedir ajuste' em Ações do narrador."
