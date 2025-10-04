import { config } from 'dotenv'
import { Kysely, PostgresDialect } from 'kysely'
import { Pool } from 'pg'

import type { DB } from './types'

config()

const DATABASE_URL =
  process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/tms'

export const db = new Kysely<DB>({
  dialect: new PostgresDialect({
    pool: new Pool({
      connectionString: DATABASE_URL,
    }),
  }),
})
