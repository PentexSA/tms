import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('chronicles')
    .addColumn('id', 'uuid', col => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('storyteller_id', 'uuid', col => col.notNull().references('users.id'))
    .addColumn('system_id', 'uuid', col => col.notNull().references('game_systems.id'))
    .addColumn('name', 'text', col => col.notNull())
    .addColumn('created_at', 'timestamp', col => col.defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamp', col => col.defaultTo(sql`now()`))
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('chronicles').execute()
}
