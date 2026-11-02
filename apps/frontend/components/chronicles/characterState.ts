import type { StateBadgeTone } from '@tms/ui'
import { shortDate } from '../../lib/format'

// O estado da ficha (D-02, P04-D §3.4): uma regra pura, a fonte única da
// lista da crônica, da Mesa, do menu do narrador e do selo sob o nome. Ela só
// mostra o que o servidor mandou: o motivo da devolução e do ajuste fica na
// ficha, e a lista e a Mesa recebem só os booleanos. O NPC não tem estado de
// criação: o selo dele é o de visibilidade (P11).

export type CharacterStateId =
  | 'creating'
  | 'returned'
  | 'adjust'
  | 'ready'
  | 'pending'
  | 'completed'
  | 'locked'
  | 'archived'
  | 'dead'

export interface CharacterState {
  readonly id: CharacterStateId
  readonly label: string
  readonly tone: StateBadgeTone
}

export interface CharacterStateRow {
  // creating, pending (aguarda o narrador), active...
  readonly status?: string
  readonly kind?: 'pc' | 'npc'
  // O modo da criação, que a API manda em creating e pending
  readonly creationMode?: 'free' | 'points' | null
  // Os marcadores do ciclo (T-06, D-04, D-03), sem o motivo
  readonly returned?: boolean
  readonly adjust?: boolean
  readonly ready?: boolean
  // A data em que a ficha entrou em jogo (concluir ou aprovar)
  readonly activatedAt?: string | Date | null
  readonly locked?: boolean
}

export interface CharacterStateOptions {
  // Quem vê é o narrador da crônica
  readonly narrating: boolean
  // O rótulo de `dead` do template ("Morto", "Fora de jogo"...)
  readonly deadLabel?: string
  // false no gatilho do narrador e no "Mais opções": sem "Concluída em"
  readonly completed?: boolean
}

const MODE: Readonly<Record<'free' | 'points', string>> = {
  free: 'Em criação · livre',
  points: 'Em criação · por pontos',
}

/** O estado da ficha, na primeira regra que vale; null quando não importa. */
export function characterState(
  row: CharacterStateRow,
  options: CharacterStateOptions
): CharacterState | null {
  const { narrating } = options
  if (row.kind === 'npc') return null
  switch (row.status) {
    case 'creating':
      if (row.adjust === true)
        return { id: 'adjust', label: 'Aguardando ajuste', tone: 'attention' }
      if (row.returned === true)
        return { id: 'returned', label: 'Devolvida', tone: 'attention' }
      if (row.ready === true)
        return narrating
          ? { id: 'ready', label: 'Avisou que terminou', tone: 'attention' }
          : { id: 'ready', label: 'Você avisou que terminou', tone: 'neutral' }
      return {
        id: 'creating',
        label: row.creationMode ? MODE[row.creationMode] : 'Em criação',
        tone: 'neutral',
      }
    case 'pending':
      return {
        id: 'pending',
        label: 'Aguardando aprovação',
        tone: narrating ? 'attention' : 'neutral',
      }
    case 'active':
      if (row.locked === true)
        return { id: 'locked', label: 'Travada', tone: 'neutral' }
      if (row.activatedAt && options.completed !== false)
        return {
          id: 'completed',
          // O instante, no fuso de quem lê (T-47)
          label: `Concluída em ${shortDate(row.activatedAt)}`,
          tone: 'done',
        }
      return null
    case 'archived':
      return { id: 'archived', label: 'Arquivada', tone: 'neutral' }
    case 'dead':
      return {
        id: 'dead',
        label: options.deadLabel ?? 'Fora de jogo',
        tone: 'neutral',
      }
    default:
      return null
  }
}
