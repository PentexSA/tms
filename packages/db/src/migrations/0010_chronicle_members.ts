import { Kysely, sql } from 'kysely'

// Quem participa de cada crônica (além do narrador) e os convites. O código
// do convite é mostrado uma vez e guardado só como hash (SHA-256).
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('chronicle_members')
    .addColumn('chronicle_id', 'uuid', col =>
      col.notNull().references('chronicles.id').onDelete('cascade')
    )
    .addColumn('user_id', 'uuid', col =>
      col.notNull().references('users.id').onDelete('cascade')
    )
    .addColumn('joined_at', 'timestamptz', col =>
      col.notNull().defaultTo(sql`now()`)
    )
    .addPrimaryKeyConstraint('chronicle_members_pkey', [
      'chronicle_id',
      'user_id',
    ])
    .execute()
  await db.schema
    .createIndex('chronicle_members_user_idx')
    .on('chronicle_members')
    .column('user_id')
    .execute()

  await db.schema
    .createTable('chronicle_invites')
    .addColumn('id', 'uuid', col =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('chronicle_id', 'uuid', col =>
      col.notNull().references('chronicles.id').onDelete('cascade')
    )
    .addColumn('code_hash', 'text', col => col.notNull().unique())
    .addColumn('created_by', 'uuid', col =>
      col.notNull().references('users.id').onDelete('cascade')
    )
    .addColumn('created_at', 'timestamptz', col =>
      col.notNull().defaultTo(sql`now()`)
    )
    .addColumn('expires_at', 'timestamptz', col => col.notNull())
    .addColumn('max_uses', 'integer', col => col.notNull())
    .addColumn('uses', 'integer', col => col.notNull().defaultTo(0))
    .addColumn('revoked_at', 'timestamptz')
    .addCheckConstraint(
      'chronicle_invites_uses_check',
      sql`uses >= 0 and uses <= max_uses and max_uses > 0`
    )
    .execute()
  await db.schema
    .createIndex('chronicle_invites_chronicle_idx')
    .on('chronicle_invites')
    .column('chronicle_id')
    .execute()
  await db.schema
    .createIndex('chronicles_storyteller_idx')
    .on('chronicles')
    .column('storyteller_id')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('chronicles_storyteller_idx').execute()
  await db.schema.dropTable('chronicle_invites').execute()
  await db.schema.dropTable('chronicle_members').execute()
}
