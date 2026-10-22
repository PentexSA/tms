import { type Kysely, sql } from 'kysely'

// Operações em grupo do narrador e reversão (doc/painel-narrador.md §5.4;
// doc/plano-v3.md, Etapa 11):
// - `chronicle_operations`: uma linha por operação (dano, cura, recuperação ou
//   reversão), idempotente por `client_operation_id` na crônica. Uma reversão
//   aponta para a operação ou para o lote que desfaz, nunca para os dois, e
//   cada um é revertido no máximo uma vez (§7, decisão 11);
// - `character_batches.operation_id`: os lotes de cada ficha da operação;
// - `character_events.from_absent`: o caminho não tinha valor guardado antes
//   do lote. Reverter o devolve vazio, e um padrão derivado volta a
//   acompanhar a fonte (§7, decisão 3).
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('chronicle_operations')
    .addColumn('id', 'uuid', col =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('chronicle_id', 'uuid', col =>
      col.notNull().references('chronicles.id').onDelete('cascade')
    )
    .addColumn('client_operation_id', 'uuid', col => col.notNull())
    .addColumn('kind', 'text', col =>
      col.notNull().check(sql`kind in ('damage', 'heal', 'recovery', 'revert')`)
    )
    // Null: a conta de quem agiu foi excluída (como na 0013)
    .addColumn('created_by', 'uuid', col =>
      col.references('users.id').onDelete('set null')
    )
    .addColumn('created_at', 'timestamptz', col =>
      col.notNull().defaultTo(sql`now()`)
    )
    .addColumn('reverts_operation_id', 'uuid', col =>
      col.references('chronicle_operations.id').onDelete('set null')
    )
    .addColumn('reverts_batch_id', 'uuid', col =>
      col.references('character_batches.id').onDelete('set null')
    )
    .addUniqueConstraint('chronicle_operations_client_key', [
      'chronicle_id',
      'client_operation_id',
    ])
    .addCheckConstraint(
      'chronicle_operations_one_target',
      sql`reverts_operation_id is null or reverts_batch_id is null`
    )
    .execute()
  // Cada operação e cada lote são revertidos no máximo uma vez
  await db.schema
    .createIndex('chronicle_operations_reverts_operation_key')
    .on('chronicle_operations')
    .column('reverts_operation_id')
    .unique()
    .where(sql.ref('reverts_operation_id'), 'is not', null)
    .execute()
  await db.schema
    .createIndex('chronicle_operations_reverts_batch_key')
    .on('chronicle_operations')
    .column('reverts_batch_id')
    .unique()
    .where(sql.ref('reverts_batch_id'), 'is not', null)
    .execute()

  await db.schema
    .alterTable('character_batches')
    .addColumn('operation_id', 'uuid', col =>
      col.references('chronicle_operations.id').onDelete('set null')
    )
    .execute()
  await db.schema
    .createIndex('character_batches_operation_idx')
    .on('character_batches')
    .column('operation_id')
    .execute()

  await db.schema
    .alterTable('character_events')
    .addColumn('from_absent', 'boolean', col => col.notNull().defaultTo(false))
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('character_events')
    .dropColumn('from_absent')
    .execute()
  await db.schema
    .alterTable('character_batches')
    .dropColumn('operation_id')
    .execute()
  await db.schema.dropTable('chronicle_operations').execute()
}
