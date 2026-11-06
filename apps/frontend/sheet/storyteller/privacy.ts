import {
  canRead,
  canWrite,
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
