import { type Kysely, sql } from 'kysely'

// Pedidos de evolução por XP (doc/plano-v4.md, Etapa 7; §3.5). O jogador
// pede um nível por vez; o narrador aprova (o traço sobe e o gasto entra no
// extrato), recusa com motivo, ou o dono cancela. Pedido não reserva XP: o
// saldo é conferido no envio e de novo na aprovação.
// - `target_key`: identidade estável do traço (`xpTargetKey` do core); só
//   um pedido pendente por ficha e chave, garantido pelo índice parcial;
// - `cost` e `context`: o preço apresentado e o que o decide. Se mudarem até
//   a aprovação, o pedido fica `stale`, sem débito;
// - `decision_key`: a chave da decisão. O reenvio da mesma decisão recupera
//   o resultado; outra decisão sobre um pedido decidido é conflito;
// - `reason`: o motivo da recusa, legível pelo dono e pelo narrador.
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('xp_requests')
    .addColumn('id', 'uuid', col =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('character_id', 'uuid', col =>
      col.notNull().references('characters.id').onDelete('cascade')
    )
    .addColumn('client_request_id', 'uuid', col => col.notNull())
    .addColumn('target_field', 'text', col => col.notNull())
    .addColumn('target_item', 'text')
    .addColumn('target_name', 'text', col =>
      col.check(sql`target_name is null or char_length(target_name) <= 80`)
    )
    .addColumn('target_key', 'text', col => col.notNull())
    .addColumn('from_value', 'integer', col => col.notNull())
    .addColumn('to_value', 'integer', col => col.notNull())
    .addColumn('cost', 'integer', col => col.notNull().check(sql`cost > 0`))
    .addColumn('context', 'jsonb', col =>
      col.notNull().defaultTo(sql`'{}'::jsonb`)
    )
    .addColumn('status', 'text', col =>
      col
        .notNull()
        .defaultTo('pending')
        .check(
          sql`status in ('pending', 'approved', 'rejected', 'cancelled', 'stale')`
        )
    )
    .addColumn('reason', 'text', col =>
      col.check(sql`reason is null or char_length(reason) <= 200`)
    )
    // Null: a conta de quem agiu foi excluída (como na 0013)
    .addColumn('requested_by', 'uuid', col =>
      col.references('users.id').onDelete('set null')
    )
    .addColumn('requested_at', 'timestamptz', col =>
      col.notNull().defaultTo(sql`now()`)
    )
    .addColumn('decided_by', 'uuid', col =>
      col.references('users.id').onDelete('set null')
    )
    .addColumn('decided_at', 'timestamptz')
    .addColumn('decision_key', 'uuid')
    .addColumn('batch_id', 'uuid', col =>
      col.references('character_batches.id').onDelete('set null')
    )
    .addCheckConstraint('xp_requests_one_level', sql`to_value = from_value + 1`)
    .addUniqueConstraint('xp_requests_client_key', [
      'character_id',
      'client_request_id',
    ])
    .execute()
  await db.schema
    .createIndex('xp_requests_pending_key')
    .on('xp_requests')
    .columns(['character_id', 'target_key'])
    .unique()
    .where(sql.ref('status'), '=', 'pending')
    .execute()
  await db.schema
    .createIndex('xp_requests_character_idx')
    .on('xp_requests')
    .columns(['character_id', 'requested_at'])
    .execute()

  await db.schema
    .alterTable('xp_entries')
    .addColumn('request_id', 'uuid', col =>
      col.references('xp_requests.id').onDelete('set null')
    )
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('xp_entries').dropColumn('request_id').execute()
  await db.schema.dropTable('xp_requests').execute()
}
