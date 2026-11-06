import {
  canRead,
  canWrite,
  type FieldId,
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

/**
 * T-84: o texto que só o narrador escreve (as Notas do Narrador) é editado
 * pela barra do narrador, que grava direto, fora do rascunho. O layout de
 * texto não desenha um segundo editor para ele: só leitura, com a legenda de
 * privado. Os outros textos do Sobre (Citação, Notas, e os de outros
 * sistemas) ganham o editor no Editar e na Criação para quem os escreve.
 * Vem só das permissões do template, nada aqui cita sistema. Um campo novo
 * de texto (a "História" do P15-D) segue a mesma regra: se o dono o
 * escreve, editor no Editar; se só o narrador, a barra.
 */
export function barEdits(model: SheetModel, id: FieldId): boolean {
  const type = model.fields.get(id)?.type
  return (
    (type === 'text' || type === 'longText') &&
    canWrite(model, id, ['storyteller']) &&
    !canWrite(model, id, ['owner'])
  )
}

// O rótulo diz que o jogador não lê; nunca repete o conteúdo da nota
export const PRIVATE_NOTE = 'privadas: o jogador não vê'
export const PRIVATE_NOTE_A11Y = 'Privadas: o jogador não vê'
export const PRIVATE_NOTE_SHEET = 'Privadas: o jogador não vê estas notas.'
// O canal certo para o recado ao jogador é o "Pedir ajuste" (D-04, P04-D)
export const ADJUST_HINT =
  "Para pedir uma correção ao jogador, use 'Pedir ajuste' em Ações do narrador."
