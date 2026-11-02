import type { api } from '../../lib/api'
import { npcVisibilityText } from './characterState'

// A auditoria em frases (T-63). A API manda o código tipado, a ficha alvo, o
// usuário alvo e o detalhe em lista branca; o texto em pt-BR mora no app,
// como o resto da interface. O mapa é exaustivo pelo tipo que o Eden infere:
// uma ação nova na API sem frase quebra o typecheck. Em tempo de execução,
// um código desconhecido (registro antigo de ação que saiu) vira "Ação
// registrada", nunca o código.

type HistoryPage = NonNullable<
  Awaited<
    ReturnType<ReturnType<typeof api.chronicles>['history']['get']>
  >['data']
>
export type HistoryItem = HistoryPage['items'][number]
export type HistoryAction = HistoryItem['action']

/** Só o que as frases leem de um item (os testes montam este formato). */
export type PhraseItem = Pick<
  HistoryItem,
  'action' | 'byRole' | 'character' | 'user' | 'detail'
>

const STATUS: Record<string, string> = {
  creating: 'Em criação',
  pending: 'Aguardando aprovação',
  active: 'Em jogo',
  archived: 'Arquivada',
  dead: 'Fora de jogo',
}

const n = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`

// O nome atual da ficha; a excluída leva a marca
const sheet = (item: PhraseItem, mark = true) =>
  item.character
    ? item.character.deleted && mark
      ? `${item.character.name} (excluída)`
      : item.character.name
    : 'uma ficha'

const who = (item: PhraseItem) => item.user?.username ?? 'Conta excluída'

const fromTo = (
  from: string | null | undefined,
  to: string | null | undefined
) => (from && to ? `${from} → ${to}` : null)

const onOff = (value: unknown) =>
  value === true ? 'Ligada' : value === false ? 'Desligada' : null

function creationSettings(item: PhraseItem) {
  const d = item.detail
  const approval =
    d.approval === undefined
      ? null
      : `aprovação ${
          fromTo(onOff(d.approvalFrom), onOff(d.approval)) ?? onOff(d.approval)
        }`
  const parts = [
    approval,
    d.defaults === true ? 'orçamento padrão alterado' : null,
  ]
    .filter(Boolean)
    .join('; ')
  return parts ? `Regras da criação: ${parts}` : 'Regras da criação alteradas'
}

export const PHRASES: Record<HistoryAction, (item: PhraseItem) => string> = {
  // Registros da crônica
  'chronicle.create': () => 'Crônica criada',
  'invite.create': item => {
    const uses = n(item.detail.maxUses)
    const days = n(item.detail.expiresInDays)
    return uses !== null && days !== null
      ? `Convite gerado: até ${plural(uses, 'uso', 'usos')}, vale ${plural(days, 'dia', 'dias')}`
      : 'Convite gerado'
  },
  'chronicle.creation.settings': creationSettings,
  'chronicle.settings': () => 'Apresentação da crônica alterada',
  'chronicle.session.create': () => 'Sessão registrada',
  'chronicle.session.update': () => 'Sessão editada',
  'chronicle.transfer.request': item => `Narração proposta a ${who(item)}`,
  'chronicle.transfer.accept': () => 'Narração transferida',
  'chronicle.transfer.reject': () => 'Proposta de narração recusada',
  'chronicle.transfer.cancel': () => 'Proposta de narração cancelada',
  // Fichas
  'character.create-npc': item => `NPC ${sheet(item)} criado, oculto`,
  'character.visibility': item => {
    const change = fromTo(
      npcVisibilityText(item.detail.from as string | undefined),
      npcVisibilityText(item.detail.to as string | undefined)
    )
    return change
      ? `${sheet(item)}: ${change}`
      : `Visibilidade de ${sheet(item)} alterada`
  },
  'character.status': item => {
    const change = fromTo(
      STATUS[String(item.detail.from)],
      STATUS[String(item.detail.to)]
    )
    return change
      ? `${sheet(item)}: ${change}`
      : `Estado de ${sheet(item)} alterado`
  },
  'character.lock': item => `${sheet(item)} travada`,
  'character.unlock': item => `${sheet(item)} destravada`,
  'character.delete': item => `${sheet(item, false)} excluída`,
  'character.creation.submit': item => `${sheet(item)} enviada para aprovação`,
  'character.creation.approve': item => `${sheet(item)} aprovada`,
  // Sem o motivo; "ajuste" é o pedido novo do P04-D (onda-3.md §4.4)
  'character.creation.return': item => `${sheet(item)} devolvida para correção`,
  'character.creation.complete': item => `Criação de ${sheet(item)} concluída`,
  'character.creation.update': item =>
    `Escolhas da criação de ${sheet(item)} alteradas`,
  // D-04 e D-03 (P04-D): como no Histórico da ficha ("Ajuste pedido",
  // "Avisou que terminou"). Nunca o motivo do ajuste: ele fica na ficha
  'character.creation.adjust': item => `Ajuste pedido em ${sheet(item)}`,
  'character.creation.ready': item =>
    `O dono de ${sheet(item)} avisou que terminou`,
  // Membros
  'member.remove': item => {
    const count = n(item.detail.characters)
    return count
      ? `${who(item)} removido da crônica (${plural(count, 'ficha arquivada', 'fichas arquivadas')})`
      : `${who(item)} removido da crônica`
  },
  'member.leave': item => `${who(item)} saiu da crônica`,
  // XP
  'xp.grant': item => {
    const amount = n(item.detail.amount)
    const count = n(item.detail.characters)
    return amount !== null && count !== null
      ? `${amount} XP concedidos a ${plural(count, 'ficha', 'fichas')}`
      : 'XP concedido'
  },
  'xp.adjust': item => {
    const delta = n(item.detail.delta)
    return delta !== null
      ? `Ajuste de XP em ${sheet(item)}: ${delta > 0 ? `+${delta}` : delta}`
      : `Ajuste de XP em ${sheet(item)}`
  },
  'xp.request.create': item => `Pedido de XP de ${sheet(item)}`,
  'xp.request.approve': item => {
    const cost = n(item.detail.cost)
    return cost !== null
      ? `Pedido de XP de ${sheet(item)} aprovado (custo ${cost})`
      : `Pedido de XP de ${sheet(item)} aprovado`
  },
  'xp.request.reject': item => `Pedido de XP de ${sheet(item)} recusado`,
  'xp.request.stale': item => `Pedido de XP de ${sheet(item)} venceu`,
  // Lotes da ficha (o par "xp-grant"/"xp.grant" é o lote de cada ficha e o
  // registro da operação, não duplicata)
  'sheet.change': item =>
    item.byRole === 'owner'
      ? `${sheet(item)} alterada pelo dono`
      : item.byRole === 'storyteller'
        ? `${sheet(item)} alterada pelo narrador`
        : `${sheet(item)} alterada`,
  damage: item => `Dano em grupo: ${sheet(item)}`,
  heal: item => `Cura em grupo: ${sheet(item)}`,
  recovery: item => `Recuperação: ${sheet(item)}`,
  revert: item => `Operação desfeita: ${sheet(item)}`,
  'xp-grant': item => `XP lançado na ficha de ${sheet(item)}`,
  'xp-adjust': item => `Ajuste de XP na ficha de ${sheet(item)}`,
  'xp-spend': item => `XP gasto: ${sheet(item)}`,
}

/** A frase do item; código desconhecido vira "Ação registrada". */
export function auditPhrase(item: PhraseItem): string {
  const phrase = Object.hasOwn(PHRASES, item.action)
    ? PHRASES[item.action]
    : undefined
  return phrase ? phrase(item) : 'Ação registrada'
}
