import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('users')
    .addColumn('id', 'uuid', col => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('email', 'text', col => col.notNull().unique())
    .addColumn('username', 'text', col => col.notNull().unique())
    .addColumn('hashed_password', 'text', col => col.notNull())
    .addColumn('created_at', 'timestamp', col => col.defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamp', col => col.defaultTo(sql`now()`))
    .addColumn('deleted_at', 'timestamp')
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('users').execute()
}
