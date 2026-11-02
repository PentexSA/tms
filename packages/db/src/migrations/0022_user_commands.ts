import { type Kysely, sql } from 'kysely'

// Comandos idempotentes por usuário (T-02): a Nova crônica ainda não tem
// linha-pai para travar, então a chave do comando fica na conta de quem cria.
// Guarda só ids, o hash do pedido e o resultado `{ id }`, nunca o nome da
// crônica; cai em cascata com a conta.
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('user_commands')
    .addColumn('user_id', 'uuid', col =>
      col.notNull().references('users.id').onDelete('cascade')
    )
    .addColumn('client_command_id', 'uuid', col => col.notNull())
    .addColumn('kind', 'text', col => col.notNull())
    .addColumn('request_hash', 'text', col => col.notNull())
    .addColumn('result', 'jsonb', col => col.notNull())
    .addColumn('created_at', 'timestamptz', col =>
      col.notNull().defaultTo(sql`now()`)
    )
    .addPrimaryKeyConstraint('user_commands_pkey', [
      'user_id',
      'client_command_id',
    ])
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('user_commands').execute()
}
