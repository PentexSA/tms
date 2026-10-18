/// <reference types="bun-types" />
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import type { Kysely } from 'kysely'
import { createPGliteTestDb } from '../test/pglite'
import type { DB } from '../types'

const newUser = (n: number) => ({
  email: `user${n}@example.test`,
  username: `user${n}`,
  hashed_password: 'x',
})

describe('@tms/db - Database Client', () => {
  let testDb: Kysely<DB>
  let destroy: () => Promise<void>

  beforeEach(async () => {
    const result = await createPGliteTestDb()
    testDb = result.db
    destroy = result.destroy
  })

  afterEach(async () => {
    await destroy()
  })

  describe('Query Builder', () => {
    it('should execute INSERT with generated id and timestamps', async () => {
      const user = await testDb
        .insertInto('users')
        .values(newUser(1))
        .returningAll()
        .executeTakeFirstOrThrow()

      expect(user.id).toMatch(/^[0-9a-f-]{36}$/)
      expect(user.created_at).toBeInstanceOf(Date)
      expect(user.deleted_at).toBeNull()
    })

    it('should execute UPDATE and DELETE', async () => {
      const { id } = await testDb
        .insertInto('users')
        .values(newUser(1))
        .returning('id')
        .executeTakeFirstOrThrow()

      const updated = await testDb
        .updateTable('users')
        .set({ username: 'renamed' })
        .where('id', '=', id)
        .returning('username')
        .executeTakeFirstOrThrow()
      expect(updated.username).toBe('renamed')

      await testDb.deleteFrom('users').where('id', '=', id).execute()
      const found = await testDb
        .selectFrom('users')
        .select('id')
        .where('id', '=', id)
        .executeTakeFirst()
      expect(found).toBeUndefined()
    })

    it('should reject the same template version twice', async () => {
      const system = await testDb
        .insertInto('game_systems')
        .values({ code: 'vtm-v20', name: 'Vampiro', family: 'wod' })
        .returning('id')
        .executeTakeFirstOrThrow()
      const row = {
        system_id: system.id,
        version: '1.0.0',
        template_data: JSON.stringify({ schema: 1 }),
      }
      await testDb.insertInto('trait_templates').values(row).execute()
      await expect(
        testDb.insertInto('trait_templates').values(row).execute()
      ).rejects.toThrow()
    })

    it('should reject duplicate email (unique constraint)', async () => {
      await testDb.insertInto('users').values(newUser(1)).execute()
      await expect(
        testDb
          .insertInto('users')
          .values({ ...newUser(2), email: newUser(1).email })
          .execute()
      ).rejects.toThrow()
    })

    it('should store jsonb as structured data', async () => {
      const system = await testDb
        .insertInto('game_systems')
        .values({ code: 'vtm-v20', name: 'Vampiro', family: 'wod' })
        .returning('id')
        .executeTakeFirstOrThrow()
      const template = await testDb
        .insertInto('trait_templates')
        .values({
          system_id: system.id,
          version: '1.0.0',
          template_data: JSON.stringify({ schema: 1, fields: { a: 1 } }),
        })
        .returning('template_data')
        .executeTakeFirstOrThrow()

      expect(template.template_data).toEqual({ schema: 1, fields: { a: 1 } })
    })
  })

  describe('Transactions', () => {
    it('should rollback on error', async () => {
      await expect(
        testDb.transaction().execute(async trx => {
          await trx.insertInto('users').values(newUser(1)).execute()
          throw new Error('Test rollback')
        })
      ).rejects.toThrow('Test rollback')

      const { count } = await testDb
        .selectFrom('users')
        .select(testDb.fn.countAll().as('count'))
        .executeTakeFirstOrThrow()
      expect(Number(count)).toBe(0)
    })
  })

  describe('Isolation', () => {
    it('each test database starts empty', async () => {
      const users = await testDb.selectFrom('users').select('id').execute()
      expect(users).toEqual([])
    })
  })
})
