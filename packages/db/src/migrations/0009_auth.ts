import { Kysely, sql } from 'kysely'

// Sessões: refresh tokens opacos, guardados só como hash (SHA-256), com
// rotação a cada uso. Todos os tokens de um login formam uma família; reusar
// um token já trocado revoga a família inteira (sinal de roubo).
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('refresh_tokens')
    .addColumn('id', 'uuid', col =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('user_id', 'uuid', col =>
      col.notNull().references('users.id').onDelete('cascade')
    )
    .addColumn('family_id', 'uuid', col => col.notNull())
    .addColumn('token_hash', 'text', col => col.notNull().unique())
    .addColumn('created_at', 'timestamptz', col =>
      col.notNull().defaultTo(sql`now()`)
    )
    .addColumn('expires_at', 'timestamptz', col => col.notNull())
    // Limite absoluto da sessão, igual em toda a família.
    .addColumn('family_expires_at', 'timestamptz', col => col.notNull())
    .addColumn('revoked_at', 'timestamptz')
    .addColumn('replaced_by', 'uuid', col =>
      col.references('refresh_tokens.id').onDelete('set null')
    )
    .execute()
  await db.schema
    .createIndex('refresh_tokens_family_idx')
    .on('refresh_tokens')
    .column('family_id')
    .execute()
  await db.schema
    .createIndex('refresh_tokens_user_idx')
    .on('refresh_tokens')
    .column('user_id')
    .execute()
  // E-mail único sem diferenciar maiúsculas (o app também normaliza).
  await sql`create unique index users_email_lower_key on users (lower(email))`.execute(
    db
  )
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`drop index users_email_lower_key`.execute(db)
  await db.schema.dropTable('refresh_tokens').execute()
}
