import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { DB } from '@tms/db'
import type { Kysely } from 'kysely'
import { PublishError, publishTemplate } from '../templates/publish'
import { publishedFiles } from '../templates/published'

// pnpm templates:publish design/templates/vtm-v20.json [outros.json]
// pnpm templates:publish --published   (os templates do produto)
//
// Grava o template no banco de DATABASE_URL. Sai com código 1 se algum for
// recusado. O log diz sistema, versão e hash, nunca o conteúdo.

export interface PublishCliDeps {
  readonly db: Kysely<DB>
  readonly cwd: string
  readonly out: (line: string) => void
  readonly err: (line: string) => void
}

export async function main(
  args: readonly string[],
  deps: PublishCliDeps
): Promise<number> {
  const files = args.flatMap(a =>
    a === '--published' ? publishedFiles() : [a]
  )
  if (!files.length) {
    deps.err('Uso: pnpm templates:publish <template.json> [...] | --published')
    return 1
  }
  let failed = false
  for (const file of files) {
    try {
      const json: unknown = JSON.parse(
        readFileSync(resolve(deps.cwd, file), 'utf8')
      )
      const r = await publishTemplate(deps.db, json)
      deps.out(
        `${r.status === 'published' ? 'publicado' : 'sem mudança'}: ${r.system}@${r.version} (sha256 ${r.hash.slice(0, 12)})`
      )
    } catch (e) {
      failed = true
      if (e instanceof PublishError) {
        deps.err(`recusado: ${file}`)
        for (const i of e.issues)
          deps.err(`  - [${i.stage}] ${i.path || '/'}: ${i.message}`)
      } else {
        deps.err(
          `falhou: ${file}: ${e instanceof Error ? e.message : String(e)}`
        )
      }
    }
  }
  return failed ? 1 : 0
}
