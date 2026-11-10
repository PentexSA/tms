import type { Kysely } from 'kysely'
import { publishProductTemplates } from '../templates'
import type { DB } from '../types'

// As versões dos templates do produto do P17 (ajustes da criação de ficha,
// doc/planos-pacotes/P17-ajustes-criacao-ficha.md §3): vtm-v20 1.11.0,
// wta-w20 1.9.0 e mta-m20 1.9.0, com o catálogo de Qualidades e Defeitos e,
// no Lobisomem, a ajuda de Nome de feito, Seita e Campo. Só dados, sem
// mudança de schema e sem tocar em ficha: grava os arquivos de hoje, como a
// 0025. As fichas guardam a versão em que nasceram e não ganham o catálogo.
export async function up(db: Kysely<unknown>): Promise<void> {
  await publishProductTemplates(db as unknown as Kysely<DB>)
}

export async function down(): Promise<void> {
  // Sem volta, como a 0025: fichas guardam a versão do template, e uma
  // versão publicada não some do banco
}
