import { Kysely, sql } from 'kysely'

// Rolagens de dados (doc/plano-v0.md, Etapa 21). O servidor monta a parada
// da ficha gravada e rola; o resultado nunca vem do cliente. "Rolei na mão"
// fica marcado como manual. O custo (FdV) é um lote do histórico, ligado
// aqui por batch_id. O mesmo client_roll_id não rola duas vezes.
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('character_rolls')
    .addColumn('id', 'uuid', col =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('character_id', 'uuid', col =>
      col.notNull().references('characters.id').onDelete('cascade')
    )
    .addColumn('client_roll_id', 'uuid', col => col.notNull())
    .addColumn('created_by', 'uuid', col =>
      col.notNull().references('users.id').onDelete('cascade')
    )
    // Papel de quem rolou (owner ou storyteller)
    .addColumn('by_role', 'text', col => col.notNull())
    .addColumn('manual', 'boolean', col => col.notNull().defaultTo(false))
    // "Destreza + Esportes"
    .addColumn('label', 'text', col => col.notNull())
    // O pedido (slots, dificuldade, especialização, boosts) e o resultado
    .addColumn('request', 'jsonb', col => col.notNull())
    .addColumn('result', 'jsonb', col => col.notNull())
    .addColumn('batch_id', 'uuid', col =>
      col.references('character_batches.id').onDelete('set null')
    )
    .addColumn('created_at', 'timestamptz', col =>
      col.notNull().defaultTo(sql`now()`)
    )
    .addUniqueConstraint('character_rolls_client_key', [
      'character_id',
      'client_roll_id',
    ])
    .execute()
  await db.schema
    .createIndex('character_rolls_recent_idx')
    .on('character_rolls')
    .columns(['character_id', 'created_at'])
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('character_rolls').execute()
}
