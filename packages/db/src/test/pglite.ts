import { Kysely, type MigrationProvider, Migrator } from 'kysely'
import { KyselyPGlite } from 'kysely-pglite'
import { migrationProvider } from '../migrations'
import type { DB } from '../types'

/**
 * Cria um Postgres em memória (PGLite) com todas as migrations aplicadas.
 *
 * Usa o mesmo `Migrator` do Kysely que o `migrate.ts` e falha se uma
 * migration falhar: teste com schema incompleto não passa.
 *
 * @example
 * const { db, destroy } = await createPGliteTestDb()
 * const users = await db.selectFrom('users').selectAll().execute()
 * await destroy()
 */
export async function createPGliteTestDb(
  provider: MigrationProvider = migrationProvider
) {
  const pglite = new KyselyPGlite() // sem dataDir: em memória
  const db = new Kysely<DB>({ dialect: pglite.dialect })

  const destroy = async () => {
    try {
      await db.destroy()
    } catch {
      // já destruído
    }
    try {
      await pglite.client.close()
    } catch {
      // já fechado
    }
  }

  const { error } = await new Migrator({ db, provider }).migrateToLatest()
  if (error) {
    await destroy()
    throw error instanceof Error ? error : new Error(String(error))
  }

  return { db, destroy }
}
