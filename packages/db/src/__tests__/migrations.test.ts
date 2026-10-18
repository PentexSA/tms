/// <reference types="bun-types" />
import { describe, expect, it } from 'bun:test'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { Migrator, NO_MIGRATIONS, sql } from 'kysely'
import { migrationProvider, migrations } from '../migrations'
import { createPGliteTestDb } from '../test/pglite'

const files = readdirSync(join(import.meta.dir, '../migrations'))
  .filter(f => f.endsWith('.ts'))
  .map(f => f.replace(/\.ts$/, ''))
  .sort()

describe('migrations', () => {
  it('a lista registra todo arquivo de migrations/, em ordem', () => {
    expect(Object.keys(migrations)).toEqual(files)
  })

  it('o PGLite tem as tabelas do schema', async () => {
    const { db, destroy } = await createPGliteTestDb()
    try {
      const { rows } = await sql<{ table_name: string }>`
        select table_name from information_schema.tables
        where table_schema = 'public' and table_name not like 'kysely_%'
        order by table_name`.execute(db)
      expect(rows.map(r => r.table_name)).toEqual([
        'characters',
        'chronicle_invites',
        'chronicle_members',
        'chronicles',
        'game_systems',
        'refresh_tokens',
        'trait_templates',
        'users',
      ])
    } finally {
      await destroy()
    }
  })

  it('todo down desfaz o up (desce tudo e sobe de novo)', async () => {
    const { db, destroy } = await createPGliteTestDb()
    try {
      const migrator = new Migrator({ db, provider: migrationProvider })
      const down = await migrator.migrateTo(NO_MIGRATIONS)
      expect(down.error).toBeUndefined()
      const up = await migrator.migrateToLatest()
      expect(up.error).toBeUndefined()
      expect(up.results?.length).toBe(files.length)
    } finally {
      await destroy()
    }
  })

  it('uma migration quebrada derruba o banco de teste', async () => {
    const broken = {
      getMigrations: async () => ({
        ...migrations,
        '9999_broken': {
          up: async () => {
            throw new Error('migration quebrada')
          },
        },
      }),
    }
    await expect(createPGliteTestDb(broken)).rejects.toThrow(
      'migration quebrada'
    )
  })
})
