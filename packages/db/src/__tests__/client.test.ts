import { describe, expect, it } from 'vitest'
import { db } from '../client'
import { checkConnection } from '../test/helpers'

describe('@tms/db - Database Client', () => {
  describe('Connection', () => {
    it('should connect to PostgreSQL database', async () => {
      const isConnected = await checkConnection()
      expect(isConnected).toBe(true)
    })

    it('should have db instance defined', () => {
      expect(db).toBeDefined()
      expect(db).toHaveProperty('selectFrom')
      expect(db).toHaveProperty('insertInto')
      expect(db).toHaveProperty('updateTable')
      expect(db).toHaveProperty('deleteFrom')
    })
  })

  describe('Query Builder', () => {
    it('should execute SELECT query', async () => {
      const result = await db.selectFrom('todos').selectAll().execute()

      expect(Array.isArray(result)).toBe(true)
    })

    it('should execute INSERT query', async () => {
      const result = await db
        .insertInto('todos')
        .values({ title: 'Test Todo' })
        .returningAll()
        .executeTakeFirstOrThrow()

      expect(result).toHaveProperty('id')
      expect(result.title).toBe('Test Todo')
      expect(result.done).toBe(false)
      expect(result.created_at).toBeInstanceOf(Date)
    })

    it('should execute UPDATE query', async () => {
      const inserted = await db
        .insertInto('todos')
        .values({ title: 'Update Test' })
        .returningAll()
        .executeTakeFirstOrThrow()

      const updated = await db
        .updateTable('todos')
        .set({ done: true })
        .where('id', '=', inserted.id)
        .returningAll()
        .executeTakeFirstOrThrow()

      expect(updated.done).toBe(true)
      expect(updated.id).toBe(inserted.id)
    })

    it('should execute DELETE query', async () => {
      const inserted = await db
        .insertInto('todos')
        .values({ title: 'Delete Test' })
        .returningAll()
        .executeTakeFirstOrThrow()

      await db
        .deleteFrom('todos')
        .where('id', '=', inserted.id)
        .execute()

      const found = await db
        .selectFrom('todos')
        .selectAll()
        .where('id', '=', inserted.id)
        .executeTakeFirst()

      expect(found).toBeUndefined()
    })
  })

  describe('Type Safety', () => {
    it('should have typed query results', async () => {
      const result = await db
        .selectFrom('todos')
        .select(['id', 'title', 'done', 'created_at'])
        .limit(1)
        .execute()

      if (result.length > 0) {
        const todo = result[0]
        expect(todo).toBeDefined()
        expect(typeof todo?.id).toBe('number')
        expect(typeof todo?.title).toBe('string')
        expect(typeof todo?.done).toBe('boolean')
        expect(todo?.created_at).toBeInstanceOf(Date)
      }
    })

    it('should enforce column names at compile time', async () => {
      const result = await db
        .selectFrom('todos')
        .select('title')
        .limit(1)
        .execute()

      expect(Array.isArray(result)).toBe(true)
    })
  })

  describe('Transactions', () => {
    it('should support transactions', async () => {
      await db.transaction().execute(async (trx) => {
        const inserted = await trx
          .insertInto('todos')
          .values({ title: 'Transaction Test' })
          .returningAll()
          .executeTakeFirstOrThrow()

        expect(inserted.title).toBe('Transaction Test')
      })
    })

    it('should rollback on error', async () => {
      const initialCount = await db
        .selectFrom('todos')
        .select(db.fn.count('id').as('count'))
        .executeTakeFirstOrThrow()

      try {
        await db.transaction().execute(async (trx) => {
          await trx
            .insertInto('todos')
            .values({ title: 'Rollback Test' })
            .execute()

          throw new Error('Test rollback')
        })
      } catch (error) {
        // Expected error
      }

      const finalCount = await db
        .selectFrom('todos')
        .select(db.fn.count('id').as('count'))
        .executeTakeFirstOrThrow()

      expect(finalCount.count).toBe(initialCount.count)
    })
  })

  describe('Schema', () => {
    it('should have todos table with correct columns', async () => {
      const todo = await db
        .insertInto('todos')
        .values({ title: 'Schema Test' })
        .returningAll()
        .executeTakeFirstOrThrow()

      expect(todo).toHaveProperty('id')
      expect(todo).toHaveProperty('title')
      expect(todo).toHaveProperty('done')
      expect(todo).toHaveProperty('created_at')
    })

    it('should set default value for done column', async () => {
      const todo = await db
        .insertInto('todos')
        .values({ title: 'Default Test' })
        .returningAll()
        .executeTakeFirstOrThrow()

      expect(todo.done).toBe(false)
    })

    it('should set default value for created_at column', async () => {
      const beforeInsert = new Date()

      const todo = await db
        .insertInto('todos')
        .values({ title: 'Timestamp Test' })
        .returningAll()
        .executeTakeFirstOrThrow()

      const afterInsert = new Date()

      expect(todo.created_at).toBeDefined()
      expect(todo.created_at?.getTime()).toBeGreaterThanOrEqual(beforeInsert.getTime())
      expect(todo.created_at?.getTime()).toBeLessThanOrEqual(afterInsert.getTime())
    })
  })
})
