import { Kysely, sql } from 'kysely'

// Versão publicada do template (templateVersion), imutável: o app guarda o
// template em cache por system@version para sempre. Uma tabela com linhas sem
// versão faz esta migration falhar de propósito: republique pelo script.
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('trait_templates')
    .addColumn('version', 'text', col => col.notNull())
    .addColumn('published_at', 'timestamptz', col =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute()
  await db.schema
    .alterTable('trait_templates')
    .alterColumn('template_data', col => col.setNotNull())
    .execute()
  await db.schema
    .createIndex('trait_templates_system_version_key')
    .unique()
    .on('trait_templates')
    .columns(['system_id', 'version'])
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('trait_templates_system_version_key').execute()
  await db.schema
    .alterTable('trait_templates')
    .alterColumn('template_data', col => col.dropNotNull())
    .execute()
  await db.schema
    .alterTable('trait_templates')
    .dropColumn('published_at')
    .dropColumn('version')
    .execute()
}
