import { type Kysely, sql } from 'kysely'

// U-11 (P16-D): as seções restritas que o narrador revelou ao dono da ficha,
// e a revisão que descarta pedido velho. Guarda só ids de seção do template,
// nunca texto. Toda ficha começa privada ('{}'); NPC nunca tem seção
// revelada (ele tem a própria visibilidade), e o banco também recusa.
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('characters')
    .addColumn('revealed_sections', sql`text[]`, col =>
      col.notNull().defaultTo(sql`'{}'::text[]`)
    )
    .addColumn('reveal_revision', 'integer', col => col.notNull().defaultTo(0))
    .execute()
  await db.schema
    .alterTable('characters')
    .addCheckConstraint(
      'characters_reveal_pc',
      sql`kind = 'pc' or cardinality(revealed_sections) = 0`
    )
    .execute()
  await db.schema
    .alterTable('characters')
    .addCheckConstraint(
      'characters_reveal_limit',
      sql`cardinality(revealed_sections) <= 8`
    )
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('characters')
    .dropConstraint('characters_reveal_limit')
    .execute()
  await db.schema
    .alterTable('characters')
    .dropConstraint('characters_reveal_pc')
    .execute()
  await db.schema
    .alterTable('characters')
    .dropColumn('reveal_revision')
    .dropColumn('revealed_sections')
    .execute()
}
