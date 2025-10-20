import { config } from '@tms/config/env'
import { promises as fs } from 'fs'
import {
  FileMigrationProvider,
  Kysely,
  Migrator,
  PostgresDialect,
} from 'kysely'
import * as path from 'path'
import { Pool } from 'pg'
import { kyselyLogger, logger } from './logger'

async function migrateToLatest() {
  const db = new Kysely({
    dialect: new PostgresDialect({
      pool: new Pool({
        connectionString: config.DATABASE_URL,
      }),
    }),
    log: kyselyLogger,
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
      logger.info(`migration "${it.migrationName}" was executed successfully`)
    } else if (it.status === 'Error') {
      logger.error(`failed to execute migration "${it.migrationName}"`)
    }
  })

  if (error) {
    logger.error(error, 'failed to migrate')
    process.exit(1)
  }

  await db.destroy()
}

async function migrateDown() {
  const db = new Kysely({
    dialect: new PostgresDialect({
      pool: new Pool({
        connectionString: config.DATABASE_URL,
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
      logger.info(
        `migration "${it.migrationName}" was rolled back successfully`
      )
    } else if (it.status === 'Error') {
      logger.error(`failed to roll back migration "${it.migrationName}"`)
    }
  })

  if (error) {
    logger.error(error, 'failed to migrate down')
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
  logger.info('Usage: tsx src/migrate.ts [up|down]')
  process.exit(1)
}
