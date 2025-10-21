import { Kysely, sql } from 'kysely'
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
 * These migrations are defined in packages/db/src/migrations/
 */
async function applyMigrations(db: Kysely<Database>) {
  // 0001_init: Create todos table
  await db.schema
    .createTable('todos')
    .addColumn('id', 'serial', col => col.primaryKey())
    .addColumn('title', 'text', col => col.notNull())
    .addColumn('done', 'boolean', col => col.notNull().defaultTo(false))
    .addColumn('created_at', 'timestamptz', col => col.defaultTo(sql`now()`))
    .execute()

  // 0002_users: Create users table
  try {
    await db.schema
      .createTable('users')
      .addColumn('id', 'uuid', col =>
        col.primaryKey().defaultTo(sql`gen_random_uuid()`)
      )
      .addColumn('email', 'text', col => col.notNull().unique())
      .addColumn('username', 'text', col => col.notNull().unique())
      .addColumn('hashed_password', 'text', col => col.notNull())
      .addColumn('created_at', 'timestamp', col => col.defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamp', col => col.defaultTo(sql`now()`))
      .addColumn('deleted_at', 'timestamp')
      .execute()
  } catch {
    // Skip if table already exists or UUID is not supported
  }

  // 0003_game_systems: Create game_systems table
  try {
    await db.schema
      .createTable('game_systems')
      .addColumn('id', 'uuid', col =>
        col.primaryKey().defaultTo(sql`gen_random_uuid()`)
      )
      .addColumn('name', 'text', col => col.notNull())
      .addColumn('description', 'text')
      .addColumn('user_id', 'uuid', col => col.notNull())
      .addColumn('created_at', 'timestamp', col => col.defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamp', col => col.defaultTo(sql`now()`))
      .execute()
  } catch {
    // Skip if table already exists
  }

  // 0004_chronicles: Create chronicles table
  try {
    await db.schema
      .createTable('chronicles')
      .addColumn('id', 'uuid', col =>
        col.primaryKey().defaultTo(sql`gen_random_uuid()`)
      )
      .addColumn('name', 'text', col => col.notNull())
      .addColumn('system_id', 'uuid', col => col.notNull())
      .addColumn('description', 'text')
      .addColumn('created_at', 'timestamp', col => col.defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamp', col => col.defaultTo(sql`now()`))
      .execute()
  } catch {
    // Skip if table already exists
  }

  // 0005_characters: Create characters table
  try {
    await db.schema
      .createTable('characters')
      .addColumn('id', 'uuid', col =>
        col.primaryKey().defaultTo(sql`gen_random_uuid()`)
      )
      .addColumn('name', 'text', col => col.notNull())
      .addColumn('chronicle_id', 'uuid', col => col.notNull())
      .addColumn('user_id', 'uuid', col => col.notNull())
      .addColumn('created_at', 'timestamp', col => col.defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamp', col => col.defaultTo(sql`now()`))
      .execute()
  } catch {
    // Skip if table already exists
  }

  // 0006_trait_templates: Create trait_templates table
  try {
    await db.schema
      .createTable('trait_templates')
      .addColumn('id', 'uuid', col =>
        col.primaryKey().defaultTo(sql`gen_random_uuid()`)
      )
      .addColumn('system_id', 'uuid', col => col.notNull())
      .addColumn('name', 'text', col => col.notNull())
      .addColumn('description', 'text')
      .addColumn('created_at', 'timestamp', col => col.defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamp', col => col.defaultTo(sql`now()`))
      .execute()
  } catch {
    // Skip if table already exists
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

  // Apply all migrations
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
