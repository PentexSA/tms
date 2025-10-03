import { config } from 'dotenv'
import { promises as fs } from 'fs'
import {
  FileMigrationProvider,
  Kysely,
  Migrator,
  PostgresDialect,
} from 'kysely'
import * as path from 'path'
import { Pool } from 'pg'

config()

const DATABASE_URL =
  process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/tms'

async function migrateToLatest() {
  const db = new Kysely({
    dialect: new PostgresDialect({
      pool: new Pool({
        connectionString: DATABASE_URL,
      }),
    }),
  })

  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder: path.join(__dirname, 'migrations'),
    }),
  })

  const { error, results } = await migrator.migrateToLatest()

  results?.forEach(it => {
    if (it.status === 'Success') {
      console.log(`migration "${it.migrationName}" was executed successfully`)
    } else if (it.status === 'Error') {
      console.error(`failed to execute migration "${it.migrationName}"`)
    }
  })

  if (error) {
    console.error('failed to migrate')
    console.error(error)
    process.exit(1)
  }

  await db.destroy()
}

async function migrateDown() {
  const db = new Kysely({
    dialect: new PostgresDialect({
      pool: new Pool({
        connectionString: DATABASE_URL,
      }),
    }),
  })

  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder: path.join(__dirname, 'migrations'),
    }),
  })

  const { error, results } = await migrator.migrateDown()

  results?.forEach(it => {
    if (it.status === 'Success') {
      console.log(
        `migration "${it.migrationName}" was rolled back successfully`
      )
    } else if (it.status === 'Error') {
      console.error(`failed to roll back migration "${it.migrationName}"`)
    }
  })

  if (error) {
    console.error('failed to migrate down')
    console.error(error)
    process.exit(1)
  }

  await db.destroy()
}

const command = process.argv[2]

if (command === 'up') {
  migrateToLatest()
} else if (command === 'down') {
  migrateDown()
} else {
  console.log('Usage: tsx src/migrate.ts [up|down]')
  process.exit(1)
}
