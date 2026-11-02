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
