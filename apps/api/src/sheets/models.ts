import type { DB } from '@tms/db'
import { compileTemplate, type SheetModel } from '@tms/sheet-core'
import type { Kysely } from 'kysely'

// Templates publicados são imutáveis por versão: o modelo compilado fica em
// cache para sempre (o compileTemplate também memoiza pelo conteúdo).

const cache = new Map<string, SheetModel>()

export interface PublishedTemplate {
  readonly version: string
  readonly json: unknown
}

export async function latestTemplate(
  db: Kysely<DB>,
  systemId: string
): Promise<PublishedTemplate | undefined> {
  const row = await db
    .selectFrom('trait_templates')
    .select(['version', 'template_data'])
    .where('system_id', '=', systemId)
    .orderBy('published_at', 'desc')
    .limit(1)
    .executeTakeFirst()
  return row ? { version: row.version, json: row.template_data } : undefined
}

export async function modelFor(
  db: Kysely<DB>,
  systemId: string,
  version: string
): Promise<SheetModel> {
  const key = `${systemId}@${version}`
  const hit = cache.get(key)
  if (hit) return hit
  const row = await db
    .selectFrom('trait_templates')
    .select('template_data')
    .where('system_id', '=', systemId)
    .where('version', '=', version)
    .executeTakeFirstOrThrow()
  const model = compileTemplate(row.template_data)
  cache.set(key, model)
  return model
}
