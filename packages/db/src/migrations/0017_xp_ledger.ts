import { type Kysely, sql } from 'kysely'

// Extrato de experiência (doc/plano-v4.md, Etapa 6; doc/painel-narrador.md
// §5.6). `xp_entries` é a fonte única do saldo: `xpTotal` e `xpSpent` da
// ficha são projeções da soma, gravadas na mesma transação, e nenhum papel
// as grava por /events.
// - `grant`: concessão do narrador (`total_delta` > 0);
// - `adjust`: ajuste ou estorno (`total_delta` ≠ 0); o estorno aponta a
//   concessão em `reverses_entry_id`. O registro original nunca muda;
// - `spend`: gasto aprovado de um pedido (`spent_delta` > 0), na Etapa 7.
// As três viram operações da crônica (`xp-grant`, `xp-adjust`, `xp-spend`),
// com o lote da projeção: a reversão genérica as recusa pelo tipo.
// `request_hash` guarda a intenção de cada operação: a mesma chave com outra
// intenção é conflito, nunca o resultado de outra coisa.
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    alter table chronicle_operations
      drop constraint chronicle_operations_kind_check,
      add constraint chronicle_operations_kind_check check (kind in (
        'damage', 'heal', 'recovery', 'revert',
        'xp-grant', 'xp-adjust', 'xp-spend'
      ))
  `.execute(db)
  await db.schema
    .alterTable('chronicle_operations')
    .addColumn('request_hash', 'text')
    .execute()

  await db.schema
    .createTable('xp_entries')
    .addColumn('id', 'uuid', col =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('character_id', 'uuid', col =>
      col.notNull().references('characters.id').onDelete('cascade')
    )
    .addColumn('kind', 'text', col =>
      col.notNull().check(sql`kind in ('grant', 'adjust', 'spend')`)
    )
    .addColumn('total_delta', 'integer', col => col.notNull().defaultTo(0))
    .addColumn('spent_delta', 'integer', col => col.notNull().defaultTo(0))
    // Motivo limitado (concessão e ajuste); o gasto aponta o pedido
    .addColumn('reason', 'text', col =>
      col.check(sql`reason is null or char_length(reason) <= 200`)
    )
    .addColumn('reverses_entry_id', 'uuid', col =>
      col.references('xp_entries.id')
    )
    .addColumn('operation_id', 'uuid', col =>
      col.references('chronicle_operations.id').onDelete('set null')
    )
    .addColumn('batch_id', 'uuid', col =>
      col.references('character_batches.id').onDelete('set null')
    )
    // Null: a conta de quem agiu foi excluída (como na 0013)
    .addColumn('created_by', 'uuid', col =>
      col.references('users.id').onDelete('set null')
    )
    .addColumn('created_at', 'timestamptz', col =>
      col.notNull().defaultTo(sql`now()`)
    )
    .addCheckConstraint(
      'xp_entries_delta_by_kind',
      sql`(kind = 'grant' and total_delta > 0 and spent_delta = 0)
        or (kind = 'adjust' and total_delta <> 0 and spent_delta = 0)
        or (kind = 'spend' and total_delta = 0 and spent_delta > 0)`
    )
    .addCheckConstraint(
      'xp_entries_reverses_adjust',
      sql`reverses_entry_id is null or (kind = 'adjust' and total_delta < 0)`
    )
    .execute()
  await db.schema
    .createIndex('xp_entries_character_idx')
    .on('xp_entries')
    .columns(['character_id', 'created_at', 'id'])
    .execute()
  await db.schema
    .createIndex('xp_entries_reverses_idx')
    .on('xp_entries')
    .column('reverses_entry_id')
    .where(sql.ref('reverses_entry_id'), 'is not', null)
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('xp_entries').execute()
  await db.schema
    .alterTable('chronicle_operations')
    .dropColumn('request_hash')
    .execute()
  // Operações de XP somem com o extrato; os lotes ficam, sem operação
  await sql`delete from chronicle_operations where kind like 'xp-%'`.execute(db)
  await sql`
    alter table chronicle_operations
      drop constraint chronicle_operations_kind_check,
      add constraint chronicle_operations_kind_check
        check (kind in ('damage', 'heal', 'recovery', 'revert'))
  `.execute(db)
}
