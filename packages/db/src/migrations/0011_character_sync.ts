import { Kysely, sql } from 'kysely'

// Ficha versionada e histórico de lotes (doc/arquitetura §8.3). A ficha
// guarda com qual versão do template nasceu; sheet_version sobe a cada lote.
// text e longText entram no histórico sem conteúdo (from/to nulos).
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('characters')
    .addColumn('template_version', 'text', col => col.notNull())
    .addColumn('sheet_version', 'integer', col => col.notNull().defaultTo(0))
    .execute()
  await db.schema
    .alterTable('characters')
    .alterColumn('sheet_data', col => col.setNotNull())
    .execute()
  await sql`create index characters_chronicle_idx on characters (chronicle_id) where deleted_at is null`.execute(
    db
  )
  await db.schema
    .createIndex('characters_user_idx')
    .on('characters')
    .column('user_id')
    .execute()

  await db.schema
    .createTable('character_batches')
    .addColumn('id', 'uuid', col =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('character_id', 'uuid', col =>
      col.notNull().references('characters.id').onDelete('cascade')
    )
    .addColumn('client_batch_id', 'uuid', col => col.notNull())
    .addColumn('created_by', 'uuid', col =>
      col.notNull().references('users.id').onDelete('cascade')
    )
    // Papel de quem escreveu (owner ou storyteller), para o histórico
    .addColumn('by_role', 'text', col => col.notNull())
    .addColumn('sheet_version', 'integer', col => col.notNull())
    .addColumn('created_at', 'timestamptz', col =>
      col.notNull().defaultTo(sql`now()`)
    )
    .addUniqueConstraint('character_batches_client_key', [
      'character_id',
      'client_batch_id',
    ])
    .execute()
  await db.schema
    .createIndex('character_batches_history_idx')
    .on('character_batches')
    .columns(['character_id', 'created_at'])
    .execute()

  await db.schema
    .createTable('character_events')
    .addColumn('id', 'uuid', col =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('batch_id', 'uuid', col =>
      col.notNull().references('character_batches.id').onDelete('cascade')
    )
    .addColumn('seq', 'integer', col => col.notNull())
    .addColumn('path', 'text', col => col.notNull())
    .addColumn('from_value', 'jsonb')
    .addColumn('to_value', 'jsonb')
    .execute()
  await db.schema
    .createIndex('character_events_batch_idx')
    .on('character_events')
    .column('batch_id')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('character_events').execute()
  await db.schema.dropTable('character_batches').execute()
  await db.schema.dropIndex('characters_user_idx').execute()
  await sql`drop index characters_chronicle_idx`.execute(db)
  await db.schema
    .alterTable('characters')
    .alterColumn('sheet_data', col => col.dropNotNull())
    .execute()
  await db.schema
    .alterTable('characters')
    .dropColumn('sheet_version')
    .dropColumn('template_version')
    .execute()
}
