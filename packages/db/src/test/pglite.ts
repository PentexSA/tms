import { PGlite } from '@electric-sql/pglite'
import { Kysely, type MigrationProvider, Migrator } from 'kysely'
import { KyselyPGlite } from 'kysely-pglite'
import { migrationProvider } from '../migrations'
import type { DB } from '../types'

/**
 * Cria um Postgres em memória (PGLite) com todas as migrations aplicadas.
 *
 * Usa o mesmo `Migrator` do Kysely que o `migrate.ts` e falha se uma
 * migration falhar: teste com schema incompleto não passa. Com as migrations
 * do pacote, migra uma vez por processo e clona o diretório de dados a cada
 * banco (~4x mais rápido que migrar de novo).
 *
 * @example
 * const { db, destroy } = await createPGliteTestDb()
 * const users = await db.selectFrom('users').selectAll().execute()
 * await destroy()
 */
export async function createPGliteTestDb(
  provider: MigrationProvider = migrationProvider
) {
  const pglite =
    provider === migrationProvider
      ? new PGlite({ loadDataDir: await migratedSnapshot() })
      : await migrated(provider)
  return open(pglite)
}

let snapshot: Promise<Blob> | undefined

function migratedSnapshot(): Promise<Blob> {
  snapshot ??= (async () => {
    const pglite = await migrated(migrationProvider)
    const blob = await pglite.dumpDataDir('none')
    await pglite.close()
    return blob
  })().catch(error => {
    snapshot = undefined
    throw error
  })
  return snapshot
}

async function migrated(provider: MigrationProvider): Promise<PGlite> {
  const pglite = new PGlite()
  const db = new Kysely<DB>({ dialect: new KyselyPGlite(pglite).dialect })
  const { error } = await new Migrator({ db, provider }).migrateToLatest()
  if (error) {
    await pglite.close()
    throw error instanceof Error ? error : new Error(String(error))
  }
  return pglite
}

function open(pglite: PGlite) {
  const db = new Kysely<DB>({ dialect: new KyselyPGlite(pglite).dialect })
  const destroy = async () => {
    try {
      // O driver do kysely-pglite fecha o PGLite junto
      await db.destroy()
    } catch {
      // já destruído
    }
    if (!pglite.closed)
      try {
        await pglite.close()
      } catch {
        // já fechado
      }
  }
  return { db, destroy }
}
