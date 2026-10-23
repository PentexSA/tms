import { type Kysely, sql } from 'kysely'

// Bastidores da crônica (v5): NPCs e suas projeções, rolagens por crônica,
// comandos idempotentes, sessões, configurações e transferência de narração.
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('characters')
    .addColumn('kind', 'text', col =>
      col.notNull().defaultTo('pc').check(sql`kind in ('pc', 'npc')`)
    )
    .addColumn('visibility', 'text', col =>
      col
        .notNull()
        .defaultTo('hidden')
        .check(sql`visibility in ('hidden', 'identity', 'full')`)
    )
    .addColumn('visibility_revision', 'integer', col =>
      col.notNull().defaultTo(0)
    )
    .addColumn('presentation_revision', 'integer', col =>
      col.notNull().defaultTo(0)
    )
    .addColumn('portrait_url', 'text')
    .execute()
  await db.schema
    .alterTable('characters')
    .addCheckConstraint(
      'characters_pc_visibility',
      sql`kind = 'npc' or visibility = 'hidden'`
    )
    .execute()

  await db.schema
    .createIndex('characters_chronicle_kind_visibility_idx')
    .on('characters')
    .columns(['chronicle_id', 'kind', 'visibility'])
    .execute()

  await db.schema
    .createTable('chronicle_commands')
    .addColumn('chronicle_id', 'uuid', col =>
      col.notNull().references('chronicles.id').onDelete('cascade')
    )
    .addColumn('client_command_id', 'uuid', col => col.notNull())
    .addColumn('kind', 'text', col => col.notNull())
    .addColumn('request_hash', 'text', col => col.notNull())
    .addColumn('result', 'jsonb', col => col.notNull())
    .addColumn('created_by', 'uuid', col =>
      col.references('users.id').onDelete('set null')
    )
    .addColumn('created_at', 'timestamptz', col =>
      col.notNull().defaultTo(sql`now()`)
    )
    .addPrimaryKeyConstraint('chronicle_commands_pkey', [
      'chronicle_id',
      'client_command_id',
    ])
    .execute()

  // A nova chave é por crônica. Falhar antes de trocar a constraint evita
  // escolher silenciosamente um dos resultados históricos em colisão.
  const collision = await sql<{ chronicle_id: string; client_roll_id: string }>`
    select ch.chronicle_id, r.client_roll_id
      from character_rolls r
      join characters ch on ch.id = r.character_id
     group by ch.chronicle_id, r.client_roll_id
    having count(*) > 1
     limit 1
  `.execute(db)
  if (collision.rows.length)
    throw new Error(
      '0019_backstage: client_roll_id histórico colide dentro da mesma crônica'
    )

  await db.schema
    .alterTable('character_rolls')
    .addColumn('chronicle_id', 'uuid', col =>
      col.references('chronicles.id').onDelete('cascade')
    )
    .addColumn('hidden', 'boolean', col => col.notNull().defaultTo(false))
    .addColumn('request_hash', 'text')
    .execute()
  await sql`
    update character_rolls r
       set chronicle_id = ch.chronicle_id
      from characters ch
     where ch.id = r.character_id
  `.execute(db)
  await sql`alter table character_rolls alter column chronicle_id set not null`.execute(
    db
  )
  await sql`alter table character_rolls alter column character_id drop not null`.execute(
    db
  )
  await db.schema
    .alterTable('character_rolls')
    .dropConstraint('character_rolls_client_key')
    .execute()
  await db.schema
    .alterTable('character_rolls')
    .addUniqueConstraint('character_rolls_chronicle_client_key', [
      'chronicle_id',
      'client_roll_id',
    ])
    .execute()
  await db.schema
    .alterTable('character_rolls')
    .addCheckConstraint(
      'character_rolls_free_storyteller',
      sql`character_id is not null or (by_role = 'storyteller' and batch_id is null)`
    )
    .execute()
  await db.schema
    .createIndex('character_rolls_feed_idx')
    .on('character_rolls')
    .columns(['chronicle_id', 'created_at', 'id'])
    .execute()

  await db.schema
    .createTable('chronicle_sessions')
    .addColumn('id', 'uuid', col =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('chronicle_id', 'uuid', col =>
      col.notNull().references('chronicles.id').onDelete('cascade')
    )
    .addColumn('session_date', 'date', col => col.notNull())
    .addColumn('title', 'text', col => col.notNull())
    .addColumn('public_summary', 'text', col => col.notNull().defaultTo(''))
    .addColumn('private_notes', 'text', col => col.notNull().defaultTo(''))
    .addColumn('revision', 'integer', col => col.notNull().defaultTo(0))
    .addColumn('created_by', 'uuid', col =>
      col.references('users.id').onDelete('set null')
    )
    .addColumn('created_at', 'timestamptz', col =>
      col.notNull().defaultTo(sql`now()`)
    )
    .addColumn('updated_at', 'timestamptz', col =>
      col.notNull().defaultTo(sql`now()`)
    )
    .addCheckConstraint(
      'chronicle_sessions_text_limits',
      sql`char_length(title) between 1 and 120 and char_length(public_summary) <= 8000 and char_length(private_notes) <= 16000`
    )
    .execute()
  await db.schema
    .createIndex('chronicle_sessions_recent_idx')
    .on('chronicle_sessions')
    .columns(['chronicle_id', 'session_date', 'id'])
    .execute()

  await db.schema
    .alterTable('chronicle_operations')
    .addColumn('session_id', 'uuid', col =>
      col.references('chronicle_sessions.id').onDelete('set null')
    )
    .execute()
  await db.schema
    .alterTable('character_batches')
    .addColumn('session_id', 'uuid', col =>
      col.references('chronicle_sessions.id').onDelete('set null')
    )
    .execute()

  await db.schema
    .alterTable('chronicles')
    .addColumn('description', 'text', col => col.notNull().defaultTo(''))
    .addColumn('image_url', 'text')
    .addColumn('options', 'jsonb', col =>
      col.notNull().defaultTo(sql`'{}'::jsonb`)
    )
    .addColumn('settings_revision', 'integer', col =>
      col.notNull().defaultTo(0)
    )
    .execute()

  await db.schema
    .createTable('chronicle_transfers')
    .addColumn('id', 'uuid', col =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('chronicle_id', 'uuid', col =>
      col.notNull().references('chronicles.id').onDelete('cascade')
    )
    .addColumn('requested_by', 'uuid', col =>
      col.references('users.id').onDelete('set null')
    )
    .addColumn('recipient_id', 'uuid', col =>
      col.notNull().references('users.id').onDelete('cascade')
    )
    .addColumn('status', 'text', col =>
      col
        .notNull()
        .defaultTo('pending')
        .check(
          sql`status in ('pending', 'accepted', 'rejected', 'cancelled', 'expired')`
        )
    )
    .addColumn('client_command_id', 'uuid', col => col.notNull())
    .addColumn('request_hash', 'text', col => col.notNull())
    .addColumn('decision_key', 'uuid')
    .addColumn('requested_at', 'timestamptz', col =>
      col.notNull().defaultTo(sql`now()`)
    )
    .addColumn('expires_at', 'timestamptz', col => col.notNull())
    .addColumn('decided_at', 'timestamptz')
    .execute()
  await db.schema
    .createIndex('chronicle_transfers_pending_key')
    .on('chronicle_transfers')
    .column('chronicle_id')
    .unique()
    .where(sql.ref('status'), '=', 'pending')
    .execute()
  await db.schema
    .createIndex('chronicle_transfers_command_key')
    .on('chronicle_transfers')
    .columns(['chronicle_id', 'client_command_id'])
    .unique()
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  const free = await sql<{ count: string }>`
    select count(*)::text as count from character_rolls where character_id is null
  `.execute(db)
  if (Number(free.rows[0]?.count ?? 0) > 0)
    throw new Error(
      '0019_backstage: rollback recusado enquanto existirem rolagens livres'
    )

  await db.schema.dropTable('chronicle_transfers').execute()
  await db.schema
    .alterTable('chronicles')
    .dropColumn('settings_revision')
    .dropColumn('options')
    .dropColumn('image_url')
    .dropColumn('description')
    .execute()
  await db.schema
    .alterTable('character_batches')
    .dropColumn('session_id')
    .execute()
  await db.schema
    .alterTable('chronicle_operations')
    .dropColumn('session_id')
    .execute()
  await db.schema.dropTable('chronicle_sessions').execute()

  await db.schema.dropIndex('character_rolls_feed_idx').execute()
  await db.schema
    .alterTable('character_rolls')
    .dropConstraint('character_rolls_free_storyteller')
    .execute()
  await db.schema
    .alterTable('character_rolls')
    .dropConstraint('character_rolls_chronicle_client_key')
    .execute()
  await db.schema
    .alterTable('character_rolls')
    .addUniqueConstraint('character_rolls_client_key', [
      'character_id',
      'client_roll_id',
    ])
    .execute()
  await sql`alter table character_rolls alter column character_id set not null`.execute(
    db
  )
  await db.schema
    .alterTable('character_rolls')
    .dropColumn('request_hash')
    .dropColumn('hidden')
    .dropColumn('chronicle_id')
    .execute()

  await db.schema.dropTable('chronicle_commands').execute()
  await db.schema
    .dropIndex('characters_chronicle_kind_visibility_idx')
    .execute()
  await db.schema
    .alterTable('characters')
    .dropConstraint('characters_pc_visibility')
    .execute()
  await db.schema
    .alterTable('characters')
    .dropColumn('portrait_url')
    .dropColumn('presentation_revision')
    .dropColumn('visibility_revision')
    .dropColumn('visibility')
    .dropColumn('kind')
    .execute()
}
