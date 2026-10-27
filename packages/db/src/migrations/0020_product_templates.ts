import type { Kysely } from 'kysely'
import { PRODUCT_TEMPLATES, productTemplate, storeTemplate } from '../templates'
import type { DB } from '../types'

// Os templates do produto com as regras de criação e XP de V20, M20 e W20
// (doc/regras-wod.md): todo banco migrado já tem os sistemas e a versão atual,
// sem depender do `pnpm templates:publish`. Uma versão nova de template ganha
// a sua migration, igual a esta; num banco novo, ela só confirma o que esta
// gravou. Os testes da API validam os mesmos arquivos pela publicação.
export async function up(db: Kysely<unknown>): Promise<void> {
  for (const system of PRODUCT_TEMPLATES) {
    const r = await storeTemplate(
      db as unknown as Kysely<DB>,
      productTemplate(system)
    )
    if (r.status === 'conflict')
      throw new Error(
        `${r.system}@${r.version} já está no banco com outro conteúdo: suba o templateVersion`
      )
  }
}

export async function down(): Promise<void> {
  // Sem volta: fichas guardam a versão do template, e uma versão publicada
  // não some do banco
}
