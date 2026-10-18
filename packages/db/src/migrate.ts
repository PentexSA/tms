import { config } from '@tms/config/env'
import { Kysely, Migrator, NO_MIGRATIONS, PostgresDialect } from 'kysely'
import { Pool } from 'pg'
import { kyselyLogger, logger } from './logger'
import { migrationProvider } from './migrations'

type Step = (migrator: Migrator) => ReturnType<Migrator['migrateToLatest']>

const STEPS: Record<string, Step[]> = {
  up: [m => m.migrateToLatest()],
  down: [m => m.migrateDown()],
  // CI: prova que todo `down` desfaz o `up` correspondente num Postgres real
  check: [
    m => m.migrateToLatest(),
    m => m.migrateTo(NO_MIGRATIONS),
    m => m.migrateToLatest(),
  ],
}

async function run(steps: Step[]) {
  const db = new Kysely({
    dialect: new PostgresDialect({
      pool: new Pool({ connectionString: config.DATABASE_URL }),
    }),
    log: kyselyLogger,
  })
  const migrator = new Migrator({ db, provider: migrationProvider })

  try {
    for (const step of steps) {
      const { error, results } = await step(migrator)
      for (const it of results ?? []) {
        if (it.status === 'Success')
          logger.info(`migration "${it.migrationName}" ${it.direction}: ok`)
        else if (it.status === 'Error')
          logger.error(
            `migration "${it.migrationName}" ${it.direction}: falhou`
          )
      }
      if (error) {
        logger.error(error, 'falha nas migrations')
        process.exitCode = 1
        return
      }
    }
  } finally {
    await db.destroy()
  }
}

const steps = STEPS[process.argv[2] ?? '']
if (steps) {
  run(steps)
} else {
  logger.info('Uso: tsx src/migrate.ts [up|down|check]')
  process.exitCode = 1
}
