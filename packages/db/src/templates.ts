import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Kysely } from 'kysely'
import type { DB } from './types'

// A gravação de um template no banco, a mesma para o `pnpm templates:publish`
// (que valida antes) e para as migrations que publicam os templates do produto.

/** Os templates do produto, na ordem de publicação (doc/arquitetura §5.3). */
export const PRODUCT_TEMPLATES = ['vtm-v20', 'mta-m20', 'wta-w20'] as const

/** O template do produto como está no repositório (design/templates). */
export function productTemplate(system: string): unknown {
  const path = join(
    import.meta.dirname,
    '../../../design/templates',
    `${system}.json`
  )
  return JSON.parse(readFileSync(path, 'utf8'))
}

/** JSON com as chaves em ordem: o mesmo conteúdo dá o mesmo hash. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map(k => [k, (v as Record<string, unknown>)[k]])
        )
      : v
  )
}

export const templateHash = (json: unknown) =>
  createHash('sha256').update(canonicalJson(json)).digest('hex')

export interface StoredTemplate {
  /** `conflict`: a versão já existe com outro conteúdo (é imutável). */
  readonly status: 'published' | 'unchanged' | 'conflict'
  readonly system: string
  readonly version: string
  readonly hash: string
}

/**
 * Grava a versão do template e cria ou atualiza o sistema. Não valida o
 * template nem abre transação: quem chama faz as duas coisas.
 */
export async function storeTemplate(
  db: Kysely<DB>,
  json: unknown
): Promise<StoredTemplate> {
  const t = json as {
    system: string
    templateVersion: string
    name: string
    family: string
  }
  const hash = templateHash(json)
  const result = (status: StoredTemplate['status']) => ({
    status,
    system: t.system,
    version: t.templateVersion,
    hash,
  })
  const system = await db
    .insertInto('game_systems')
    .values({ code: t.system, name: t.name, family: t.family })
    .onConflict(oc =>
      oc.column('code').doUpdateSet(eb => ({
        name: eb.ref('excluded.name'),
        family: eb.ref('excluded.family'),
      }))
    )
    .returning('id')
    .executeTakeFirstOrThrow()

  const existing = await db
    .selectFrom('trait_templates')
    .select('template_data')
    .where('system_id', '=', system.id)
    .where('version', '=', t.templateVersion)
    .executeTakeFirst()
  if (existing)
    // Versão publicada é imutável: o app guarda o template por versão
    return result(
      templateHash(existing.template_data) === hash ? 'unchanged' : 'conflict'
    )

  await db
    .insertInto('trait_templates')
    .values({
      system_id: system.id,
      version: t.templateVersion,
      template_data: JSON.stringify(json),
    })
    .execute()
  return result('published')
}
