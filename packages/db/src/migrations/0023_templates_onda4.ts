import type { Kysely } from 'kysely'
import { publishProductTemplates } from '../templates'
import type { DB } from '../types'

// As versões dos templates do produto da onda 4 (doc/planos-pacotes/onda-4.md
// §4.7): vtm-v20 1.9.0, mta-m20 1.7.0 e wta-w20 1.7.0. Só dados, sem mudança
// de schema: grava os arquivos de hoje, na ordem de PRODUCT_TEMPLATES, como a
// 0020. Num banco que já tem a versão anterior, ela convive (as fichas guardam
// a versão em que nasceram); num banco novo, a 0020 já gravou estes arquivos,
// e esta só confirma.
export async function up(db: Kysely<unknown>): Promise<void> {
  await publishProductTemplates(db as unknown as Kysely<DB>)
}

export async function down(): Promise<void> {
  // Sem volta, como a 0020: fichas guardam a versão do template, e uma versão
  // publicada não some do banco
}
