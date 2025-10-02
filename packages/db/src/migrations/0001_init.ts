import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('todos')
    .addColumn('id', 'serial', col => col.primaryKey())
    .addColumn('title', 'text', col => col.notNull())
    .addColumn('done', 'boolean', col => col.notNull().defaultTo(false))
    .addColumn('created_at', 'timestamptz', col =>
      col.defaultTo(sql`now()`)
    )
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('todos').execute()
}
