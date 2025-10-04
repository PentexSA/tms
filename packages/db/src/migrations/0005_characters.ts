import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('characters')
    .addColumn('id', 'uuid', col => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('user_id', 'uuid', col => col.notNull().references('users.id'))
    .addColumn('chronicle_id', 'uuid', col => col.notNull().references('chronicles.id'))
    .addColumn('system_id', 'uuid', col => col.notNull().references('game_systems.id'))
    .addColumn('name', 'text', col => col.notNull())
    .addColumn('sheet_data', 'jsonb')
    .addColumn('created_at', 'timestamp', col => col.defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamp', col => col.defaultTo(sql`now()`))
    .addColumn('deleted_at', 'timestamp')
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('characters').execute()
}
