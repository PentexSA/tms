import { type Kysely, sql } from 'kysely'

// Criação por pontos e aprovação de ficha (doc/plano-v4.md, Etapa 3):
// - `characters.creation`: as escolhas do jogador (prioridades), a camada de
//   configuração da ficha (o padrão da crônica de quando ela nasceu mais o
//   ajuste do narrador) e o motivo da última devolução. Pontos não têm origem
//   gravada: a conta é calculada pelo core (checkCreation);
// - `creation_revision`: sobe a cada mudança desses metadados; salvar e
//   concluir com uma revisão velha dá conflito;
// - `pending`: o dono concluiu com a aprovação ligada. `creation_completed_*`
//   passa a ser a conclusão da conta (a submissão, no caso do dono);
//   `approved_*` é a decisão do narrador que ativou a ficha (aprovar, ou
//   concluir como narrador); `activated_at` é a primeira ativação pela
//   criação, a única porta para `active` pela rota de estado;
// - `chronicles.character_approval` (desligada por padrão) e
//   `creation_defaults`, com a revisão das duas;
// - `character_commands`: idempotência dos comandos da criação por chave do
//   cliente; a mesma chave com outro pedido é conflito.
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`alter table characters drop constraint characters_status_check`.execute(
    db
  )
  await db.schema
    .alterTable('characters')
    .addCheckConstraint(
      'characters_status_check',
      sql`status in ('creating', 'pending', 'active', 'archived', 'dead')`
    )
    .execute()
  await db.schema
    .alterTable('characters')
    .addColumn('creation', 'jsonb', col =>
      col.notNull().defaultTo(sql`'{}'::jsonb`)
    )
    .addColumn('creation_revision', 'integer', col =>
      col.notNull().defaultTo(0)
    )
    .addColumn('approved_at', 'timestamptz')
    // Null: a conta de quem aprovou foi excluída (como na 0013)
    .addColumn('approved_by', 'uuid', col =>
      col.references('users.id').onDelete('set null')
    )
    .addColumn('activated_at', 'timestamptz')
    .execute()
  // Quem já está ativo (ou saiu de ativo) passou pela conclusão da v3
  await sql`
    update characters set activated_at = coalesce(creation_completed_at, updated_at)
    where status = 'active'
       or (status in ('archived', 'dead') and creation_completed_at is not null)
  `.execute(db)

  await db.schema
    .alterTable('chronicles')
    .addColumn('character_approval', 'boolean', col =>
      col.notNull().defaultTo(false)
    )
    .addColumn('creation_defaults', 'jsonb', col =>
      col.notNull().defaultTo(sql`'{}'::jsonb`)
    )
    .addColumn('creation_settings_revision', 'integer', col =>
      col.notNull().defaultTo(0)
    )
    .execute()

  await db.schema
    .createTable('character_commands')
    .addColumn('character_id', 'uuid', col =>
      col.notNull().references('characters.id').onDelete('cascade')
    )
    .addColumn('client_command_id', 'uuid', col => col.notNull())
    .addColumn('kind', 'text', col => col.notNull())
    // sha256 do pedido: a mesma chave com outro pedido é recusada
    .addColumn('request_hash', 'text', col => col.notNull())
    .addColumn('result', 'jsonb', col => col.notNull())
    // Null: a conta de quem pediu foi excluída (como na 0013)
    .addColumn('created_by', 'uuid', col =>
      col.references('users.id').onDelete('set null')
    )
    .addColumn('created_at', 'timestamptz', col =>
      col.notNull().defaultTo(sql`now()`)
    )
    .addPrimaryKeyConstraint('character_commands_pkey', [
      'character_id',
      'client_command_id',
    ])
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('character_commands').execute()
  await db.schema
    .alterTable('chronicles')
    .dropColumn('creation_settings_revision')
    .dropColumn('creation_defaults')
    .dropColumn('character_approval')
    .execute()
  // Pendente volta a ser criação, o estado mais perto que a v3 conhece
  await sql`update characters set status = 'creating' where status = 'pending'`.execute(
    db
  )
  await db.schema
    .alterTable('characters')
    .dropColumn('activated_at')
    .dropColumn('approved_by')
    .dropColumn('approved_at')
    .dropColumn('creation_revision')
    .dropColumn('creation')
    .execute()
  await sql`alter table characters drop constraint characters_status_check`.execute(
    db
  )
  await db.schema
    .alterTable('characters')
    .addCheckConstraint(
      'characters_status_check',
      sql`status in ('creating', 'active', 'archived', 'dead')`
    )
    .execute()
}
