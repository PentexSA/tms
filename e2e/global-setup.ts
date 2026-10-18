import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import pg from 'pg'
import { DATABASE_URL } from './env'

// Banco limpo a cada rodada: apaga o schema, roda as migrations e publica o
// template da v0 pelo mesmo script do dono.
const ROOT = join(__dirname, '..')

export default async function globalSetup() {
  const url = new URL(DATABASE_URL)
  const database = url.pathname.slice(1)
  const admin = new pg.Client({
    connectionString: new URL('/postgres', url).toString(),
  })
  await admin.connect()
  const exists = await admin.query(
    'select 1 from pg_database where datname = $1',
    [database]
  )
  if (!exists.rowCount)
    await admin.query(`create database "${database.replace(/"/g, '')}"`)
  await admin.end()

  const db = new pg.Client({ connectionString: DATABASE_URL })
  await db.connect()
  await db.query('drop schema if exists public cascade; create schema public;')
  await db.end()

  // NODE_ENV=test: logs em silêncio (sem as queries das migrations)
  const env = { ...process.env, DATABASE_URL, NODE_ENV: 'test' }
  execFileSync('npx', ['tsx', 'packages/db/src/migrate.ts', 'up'], {
    cwd: ROOT,
    env,
    stdio: 'inherit',
  })
  execFileSync(
    'bun',
    [
      'apps/api/src/scripts/publish-template.cli.ts',
      join(ROOT, 'design/templates/vtm-v20.json'),
    ],
    { cwd: ROOT, env, stdio: 'inherit' }
  )
}
