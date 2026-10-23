import type { DB } from '@tms/db'
import type { Transaction } from 'kysely'

// Registro administrativo da crônica (doc/painel-narrador.md §5.1): as ações
// que não são eventos de campo. Uma linha por ação, na mesma transação dela.
// O `payload` é mínimo (estados, ids), nunca conteúdo de notas. Sem rota de
// leitura na v3 (doc/plano-v3.md §7, decisão 13).

export type AuditAction =
  | 'character.creation.complete'
  | 'character.status'
  | 'character.lock'
  | 'character.unlock'
  | 'character.delete'
  | 'member.remove'
  | 'member.leave'
  // Extrato e pedidos de XP (doc/plano-v4.md, Etapas 6 e 7)
  | 'xp.grant'
  | 'xp.adjust'
  | 'xp.request.create'
  | 'xp.request.approve'
  | 'xp.request.reject'
  | 'xp.request.stale'

export async function audit(
  trx: Transaction<DB>,
  entry: {
    readonly chronicleId: string
    readonly actorId: string
    readonly action: AuditAction
    readonly characterId?: string
    readonly userId?: string
    readonly payload?: Readonly<
      Record<string, string | boolean | null | readonly string[]>
    >
    readonly at: Date
  }
): Promise<void> {
  await trx
    .insertInto('chronicle_audit')
    .values({
      chronicle_id: entry.chronicleId,
      actor_id: entry.actorId,
      action: entry.action,
      target_character_id: entry.characterId ?? null,
      target_user_id: entry.userId ?? null,
      payload: JSON.stringify(entry.payload ?? {}),
      created_at: entry.at,
    })
    .execute()
}
