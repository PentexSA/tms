import { type Kysely, sql } from 'kysely'

// Estados da ficha e registro administrativo (doc/painel-narrador.md §5.1;
// doc/plano-v3.md, Etapa 5). A política de escrita (`writePolicy`, do core)
// lê `status` e `locked_at` dentro da transação do lote:
// - `status`: creating, active, archived ou dead (`pending` chega na v4). As
//   fichas que já existem ficam em `creating`, que é o comportamento de hoje;
// - `locked_at`: a trava do narrador, que só vale em `active`;
// - `creation_completed_*`: quem concluiu a criação, e quando.
// `chronicle_audit` guarda as ações que não são eventos de campo (concluir,
// mudar estado, travar, excluir): quem, quando, o quê, o alvo e um `payload`
// mínimo, nunca conteúdo de notas.
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('characters')
    // O check de coluna se chama characters_status_check
    .addColumn('status', 'text', col =>
      col
        .notNull()
        .defaultTo('creating')
        .check(sql`status in ('creating', 'active', 'archived', 'dead')`)
    )
    .addColumn('locked_at', 'timestamptz')
    .addColumn('creation_completed_at', 'timestamptz')
    .addColumn('creation_completed_by', 'uuid', col =>
      col.references('users.id').onDelete('set null')
    )
    .execute()

  await db.schema
    .createTable('chronicle_audit')
    .addColumn('id', 'uuid', col =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('chronicle_id', 'uuid', col =>
      col.notNull().references('chronicles.id').onDelete('cascade')
    )
    // Null: a conta de quem agiu foi excluída (como na 0013)
    .addColumn('actor_id', 'uuid', col =>
      col.references('users.id').onDelete('set null')
    )
    .addColumn('action', 'text', col => col.notNull())
    .addColumn('target_character_id', 'uuid', col =>
      col.references('characters.id').onDelete('set null')
    )
    .addColumn('target_user_id', 'uuid', col =>
      col.references('users.id').onDelete('set null')
    )
    .addColumn('payload', 'jsonb', col =>
      col.notNull().defaultTo(sql`'{}'::jsonb`)
    )
    .addColumn('created_at', 'timestamptz', col =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute()
  await db.schema
    .createIndex('chronicle_audit_recent_idx')
    .on('chronicle_audit')
    .columns(['chronicle_id', 'created_at'])
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('chronicle_audit').execute()
  await db.schema
    .alterTable('characters')
    .dropColumn('creation_completed_by')
    .dropColumn('creation_completed_at')
    .dropColumn('locked_at')
    .dropColumn('status')
    .execute()
}
