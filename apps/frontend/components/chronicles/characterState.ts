// O estado da ficha na linha da lista da crônica (T-06). A regra fica numa
// função pura para o P04-D (D-02) estender com os outros estados ("Em criação
// · livre/por pontos", "Aguardando ajuste", "Concluída em dd/mm") e decidir o
// selo. A lista só sabe que a ficha foi devolvida: o motivo fica na ficha.

export interface CharacterStateRow {
  // creating, pending (aguarda o narrador), active...
  readonly status?: string
  // A API marca a ficha em criação devolvida pelo narrador
  readonly returned?: boolean
}

/** "Aguarda aprovação", "Aguarda sua revisão", "Devolvida" ou null. */
export function characterStateText(
  row: CharacterStateRow,
  narrating: boolean
): string | null {
  if (row.status === 'pending')
    return narrating ? 'Aguarda sua revisão' : 'Aguarda aprovação'
  if (row.status === 'creating' && row.returned === true) return 'Devolvida'
  return null
}

/**
 * A visibilidade do NPC para o narrador (T-52): a forma longa, porque
 * "Identidade" sozinha numa linha seria ambígua. O jogador nunca vê este
 * texto: a regra só é chamada com `narrating`, e a lista dele só recebe a
 * projeção de identidade. Sem valor conhecido, null.
 */
export function npcVisibilityText(
  visibility: string | null | undefined
): string | null {
  switch (visibility) {
    case 'hidden':
      return 'Oculto'
    case 'identity':
      return 'Identidade revelada'
    case 'full':
      return 'Ficha revelada'
    default:
      return null
  }
}
