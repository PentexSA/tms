import { type Kysely, sql } from 'kysely'

// Exclusão de conta (LGPD art. 18, VI; doc/plano-v0.md, Etapa 22). A linha do
// usuário é apagada de verdade (e-mail, nome e hash da senha somem):
// - o que é só dele vai junto (fichas, por cascata; sessões, vínculos e
//   convites já eram cascata);
// - o que ele fez em fichas de outras pessoas (histórico e rolagens) fica,
//   anônimo: created_by vira null ("Conta excluída");
// - crônica de que ele é narrador continua bloqueando (no action): a API
//   apaga a crônica explicitamente ou recusa, nunca por cascata silenciosa.
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    alter table characters
      drop constraint characters_user_id_fkey,
      add constraint characters_user_id_fkey
        foreign key (user_id) references users (id) on delete cascade
  `.execute(db)
  for (const table of ['character_batches', 'character_rolls'] as const)
    await sql`
      alter table ${sql.table(table)}
        alter column created_by drop not null,
        drop constraint ${sql.raw(`${table}_created_by_fkey`)},
        add constraint ${sql.raw(`${table}_created_by_fkey`)}
          foreign key (created_by) references users (id) on delete set null
    `.execute(db)
}

// Desfazer perde o histórico anônimo: created_by volta a ser obrigatório.
export async function down(db: Kysely<unknown>): Promise<void> {
  for (const table of ['character_rolls', 'character_batches'] as const) {
    await sql`delete from ${sql.table(table)} where created_by is null`.execute(
      db
    )
    await sql`
      alter table ${sql.table(table)}
        drop constraint ${sql.raw(`${table}_created_by_fkey`)},
        add constraint ${sql.raw(`${table}_created_by_fkey`)}
          foreign key (created_by) references users (id) on delete cascade,
        alter column created_by set not null
    `.execute(db)
  }
  await sql`
    alter table characters
      drop constraint characters_user_id_fkey,
      add constraint characters_user_id_fkey
        foreign key (user_id) references users (id)
  `.execute(db)
}
