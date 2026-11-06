import type { Kysely } from 'kysely'

// T-53 (P13, onda 5): o histórico grava o "para" efetivo (o padrão que a
// pessoa via quando o lote esvaziou o caminho), para dizer "Sangue 9 → 10" e
// não "9 → —". `to_absent` guarda que o "para" cru era vazio, como o
// `from_absent` da 0015 guarda o "de". Com ele, o desfazer do desfazer só
// aceita o caminho ainda vazio com o mesmo efetivo; todo o resto compara o
// cru, como antes. As linhas antigas ficam `false`: elas gravaram o "para"
// cru, e a comparação delas não muda.
//
// O número é 0024: o P13 entra na onda antes do P15-D e do P16-D, e o
// Migrator roda sem `allowUnorderedMigrations` (um banco com um número
// maior já aplicado recusa os menores que chegam depois).
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('character_events')
    .addColumn('to_absent', 'boolean', col => col.notNull().defaultTo(false))
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('character_events')
    .dropColumn('to_absent')
    .execute()
}
