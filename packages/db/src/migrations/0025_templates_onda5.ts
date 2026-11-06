import type { Kysely } from 'kysely'
import { publishProductTemplates } from '../templates'
import type { DB } from '../types'

// As versões dos templates do produto da onda 5 (doc/planos-pacotes/onda-5.md
// §4.5): vtm-v20 1.10.0, mta-m20 1.8.0 e wta-w20 1.8.0, com a História /
// Prelúdio (P15-D, D-16). Só dados, sem mudança de schema e sem tocar em
// ficha: grava os arquivos de hoje, na ordem de PRODUCT_TEMPLATES, como a
// 0023. As fichas guardam a versão em que nasceram e não ganham o campo; nada
// passa das Notas do Narrador para a História. Num banco novo, a 0020 já
// gravou estes arquivos, e esta só confirma.
export async function up(db: Kysely<unknown>): Promise<void> {
  await publishProductTemplates(db as unknown as Kysely<DB>)
}

export async function down(): Promise<void> {
  // Sem volta, como a 0020 e a 0023: fichas guardam a versão do template, e
  // uma versão publicada não some do banco
}
