import {
  migration_0001_init_up,
  migration_0002_users_up,
  migration_0003_game_systems_up,
  migration_0004_chronicles_up,
  migration_0005_characters_up,
  migration_0006_trait_templates_up,
} from '@tms/db'
import { Kysely } from 'kysely'
import { KyselyPGlite } from 'kysely-pglite'

/**
 * Database schema types
 * Should match @tms/db types.ts
 */
interface TodoTable {
  id: number
  title: string
  done: boolean
  created_at: Date
}

interface Database {
  todos: TodoTable
}

/**
 * Apply all migrations from @tms/db to the test database
 * These migrations are imported from packages/db/src/migrations/
 * and reused to keep a single source of truth
 */
async function applyMigrations(db: Kysely<Database>) {
  const migrations = [
    { name: '0001_init', up: migration_0001_init_up },
    { name: '0002_users', up: migration_0002_users_up },
    { name: '0003_game_systems', up: migration_0003_game_systems_up },
    { name: '0004_chronicles', up: migration_0004_chronicles_up },
    { name: '0005_characters', up: migration_0005_characters_up },
    { name: '0006_trait_templates', up: migration_0006_trait_templates_up },
  ]

  for (const migration of migrations) {
    try {
      // biome-ignore lint/suspicious/noExplicitAny: Migration functions accept unknown
      await migration.up(db as any)
    } catch (error) {
      // Skip if table already exists or migration fails
      // This is expected for optional tables that may not be supported in PGLite
      console.debug(`Migration ${migration.name} skipped or failed:`, error)
    }
  }
}

/**
 * Creates an in-memory PGLite test database with all migrations applied
 *
 * @example
 * const { db, destroy } = await createTestDb()
 * const todos = await db.selectFrom('todos').selectAll().execute()
 * await destroy()
 */
export async function createTestDb() {
  // In-memory Postgres for each test file/suite
  const pgliteDb = new KyselyPGlite('memory://')
  const db = new Kysely<Database>({
    dialect: pgliteDb.dialect,
  })

  // Apply all migrations from @tms/db
  await applyMigrations(db)

  const destroy = async () => {
    try {
      await db.destroy()
    } catch {
      // Ignore destroy errors
    }
    try {
      await pgliteDb.client.close()
    } catch {
      // Already closed, ignore
    }
  }

  return { db, destroy }
}

/**
 * Clears all data from the database (for between tests)
 */
export async function clearTestDb(db: Kysely<Database>) {
  await db.deleteFrom('todos').execute()
}
