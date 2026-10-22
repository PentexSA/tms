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
        'character_batches',
        'character_events',
        'character_rolls',
        'characters',
        'chronicle_audit',
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

  it('0012: o mesmo client_roll_id não rola duas vezes; o lote some, a rolagem fica', async () => {
    const { db, destroy } = await createPGliteTestDb()
    try {
      const user = await db
        .insertInto('users')
        .values({ username: 'u', email: 'u@x.test', hashed_password: 'h' })
        .returning('id')
        .executeTakeFirstOrThrow()
      const system = await db
        .insertInto('game_systems')
        .values({ code: 'vtm-v20', name: 'V20' })
        .returning('id')
        .executeTakeFirstOrThrow()
      const chronicle = await db
        .insertInto('chronicles')
        .values({ name: 'c', storyteller_id: user.id, system_id: system.id })
        .returning('id')
        .executeTakeFirstOrThrow()
      const character = await db
        .insertInto('characters')
        .values({
          name: 'p',
          chronicle_id: chronicle.id,
          system_id: system.id,
          user_id: user.id,
          template_version: '1.0.0',
          sheet_data: JSON.stringify({ values: {} }),
        })
        .returning('id')
        .executeTakeFirstOrThrow()
      const batch = await db
        .insertInto('character_batches')
        .values({
          character_id: character.id,
          client_batch_id: crypto.randomUUID(),
          created_by: user.id,
          by_role: 'owner',
          sheet_version: 1,
        })
        .returning('id')
        .executeTakeFirstOrThrow()
      const roll = {
        character_id: character.id,
        client_roll_id: crypto.randomUUID(),
        created_by: user.id,
        by_role: 'owner',
        label: 'Destreza',
        request: JSON.stringify({}),
        result: JSON.stringify({ total: 1 }),
        batch_id: batch.id,
      }
      await db.insertInto('character_rolls').values(roll).execute()
      await expect(
        db.insertInto('character_rolls').values(roll).execute()
      ).rejects.toThrow()
      await db.deleteFrom('character_batches').execute()
      const kept = await db
        .selectFrom('character_rolls')
        .select(['batch_id', 'manual'])
        .executeTakeFirstOrThrow()
      expect(kept).toEqual({ batch_id: null, manual: false })
    } finally {
      await destroy()
    }
  })

  it('0013: excluir usuário apaga o que é dele e anonimiza o que fez em fichas alheias', async () => {
    const { db, destroy } = await createPGliteTestDb()
    try {
      const user = (username: string) =>
        db
          .insertInto('users')
          .values({
            username,
            email: `${username}@x.test`,
            hashed_password: 'h',
          })
          .returning('id')
          .executeTakeFirstOrThrow()
      const storyteller = await user('narra')
      const owner = await user('dona')
      // Quem escreveu na ficha da dona (ex.: narrador anterior)
      const other = await user('outro')
      const system = await db
        .insertInto('game_systems')
        .values({ code: 'vtm-v20', name: 'V20' })
        .returning('id')
        .executeTakeFirstOrThrow()
      const chronicle = await db
        .insertInto('chronicles')
        .values({
          name: 'c',
          storyteller_id: storyteller.id,
          system_id: system.id,
        })
        .returning('id')
        .executeTakeFirstOrThrow()
      const character = await db
        .insertInto('characters')
        .values({
          name: 'p',
          chronicle_id: chronicle.id,
          system_id: system.id,
          user_id: owner.id,
          template_version: '1.0.0',
          sheet_data: JSON.stringify({ values: {} }),
        })
        .returning('id')
        .executeTakeFirstOrThrow()
      const batch = (by: string) =>
        db
          .insertInto('character_batches')
          .values({
            character_id: character.id,
            client_batch_id: crypto.randomUUID(),
            created_by: by,
            by_role: 'storyteller',
            sheet_version: 1,
          })
          .returning('id')
          .executeTakeFirstOrThrow()
      const byOther = await batch(other.id)
      await db
        .insertInto('character_rolls')
        .values({
          character_id: character.id,
          client_roll_id: crypto.randomUUID(),
          created_by: other.id,
          by_role: 'storyteller',
          label: 'Destreza',
          request: JSON.stringify({}),
          result: JSON.stringify({ total: 1 }),
        })
        .execute()

      // Quem fez em ficha alheia: o histórico fica, sem autor
      await db.deleteFrom('users').where('id', '=', other.id).execute()
      expect(
        await db
          .selectFrom('character_batches')
          .select(['id', 'created_by'])
          .execute()
      ).toEqual([{ id: byOther.id, created_by: null }])
      expect(
        await db.selectFrom('character_rolls').select('created_by').execute()
      ).toEqual([{ created_by: null }])

      // O narrador não sai com a crônica no ar: o banco recusa (a API decide)
      await expect(
        db.deleteFrom('users').where('id', '=', storyteller.id).execute()
      ).rejects.toThrow()

      // A dona sai e a ficha dela vai junto, com o histórico e as rolagens
      await db.deleteFrom('users').where('id', '=', owner.id).execute()
      expect(await db.selectFrom('characters').select('id').execute()).toEqual(
        []
      )
      expect(
        await db.selectFrom('character_batches').select('id').execute()
      ).toEqual([])
      expect(
        await db.selectFrom('character_rolls').select('id').execute()
      ).toEqual([])
    } finally {
      await destroy()
    }
  })

  it('0014: a ficha nasce em creating, o estado é uma lista fechada e o registro sobrevive a quem agiu', async () => {
    const { db, destroy } = await createPGliteTestDb()
    try {
      const user = (username: string) =>
        db
          .insertInto('users')
          .values({
            username,
            email: `${username}@x.test`,
            hashed_password: 'h',
          })
          .returning('id')
          .executeTakeFirstOrThrow()
      const storyteller = await user('narra')
      const owner = await user('dona')
      const system = await db
        .insertInto('game_systems')
        .values({ code: 'vtm-v20', name: 'V20' })
        .returning('id')
        .executeTakeFirstOrThrow()
      const chronicle = await db
        .insertInto('chronicles')
        .values({
          name: 'c',
          storyteller_id: storyteller.id,
          system_id: system.id,
        })
        .returning('id')
        .executeTakeFirstOrThrow()
      const character = await db
        .insertInto('characters')
        .values({
          name: 'p',
          chronicle_id: chronicle.id,
          system_id: system.id,
          user_id: owner.id,
          template_version: '1.0.0',
          sheet_data: JSON.stringify({ values: {} }),
        })
        .returning(['id', 'status', 'locked_at'])
        .executeTakeFirstOrThrow()
      expect(character).toMatchObject({ status: 'creating', locked_at: null })

      // `pending` chega na v4: até lá, o banco recusa
      await expect(
        db
          .updateTable('characters')
          .set({ status: 'pending' })
          .where('id', '=', character.id)
          .execute()
      ).rejects.toThrow()

      await db
        .updateTable('characters')
        .set({
          status: 'active',
          creation_completed_at: new Date(),
          creation_completed_by: storyteller.id,
        })
        .where('id', '=', character.id)
        .execute()
      await db
        .insertInto('chronicle_audit')
        .values({
          chronicle_id: chronicle.id,
          actor_id: owner.id,
          action: 'character.delete',
          target_character_id: character.id,
          target_user_id: owner.id,
        })
        .execute()

      // Quem agiu sai: a linha fica, sem autor nem alvo
      await db.deleteFrom('users').where('id', '=', owner.id).execute()
      expect(
        await db
          .selectFrom('chronicle_audit')
          .select([
            'actor_id',
            'target_character_id',
            'target_user_id',
            'payload',
          ])
          .execute()
      ).toEqual([
        {
          actor_id: null,
          target_character_id: null,
          target_user_id: null,
          payload: {},
        },
      ])

      // A crônica sai: o registro dela vai junto
      await db.deleteFrom('chronicles').execute()
      expect(
        await db.selectFrom('chronicle_audit').select('id').execute()
      ).toEqual([])
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
