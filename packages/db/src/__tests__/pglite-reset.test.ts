/// <reference types="bun-types" />
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import type { Kysely } from 'kysely'
import { createResettablePGliteTestDb } from '../test/pglite'
import type { DB } from '../types'

// O banco do arquivo de teste (apps/api, useTestDb): reset() volta ao estado
// de logo depois das migrations, sem subir outro PGLite.
describe('createResettablePGliteTestDb', () => {
  let db: Kysely<DB>
  let reset: () => Promise<void>
  let destroy: () => Promise<void>
  let seeded: { systems: unknown[]; templates: unknown[] }

  const systems = () =>
    db.selectFrom('game_systems').selectAll().orderBy('code').execute()
  const templates = () =>
    db.selectFrom('trait_templates').selectAll().orderBy('id').execute()

  beforeAll(async () => {
    ;({ db, reset, destroy } = await createResettablePGliteTestDb())
    seeded = { systems: await systems(), templates: await templates() }
  })
  afterAll(async () => {
    await destroy()
  })

  it('parte das linhas que as migrations semearam', () => {
    expect(seeded.systems.length).toBeGreaterThan(0)
    expect(seeded.templates.length).toBeGreaterThan(0)
  })

  it('apaga o que o teste gravou, inclusive nas tabelas semeadas', async () => {
    const user = await db
      .insertInto('users')
      .values({ username: 'u', email: 'u@x.test', hashed_password: 'h' })
      .returning('id')
      .executeTakeFirstOrThrow()
    const system = await db
      .insertInto('game_systems')
      .values({ code: 'sem-template', name: 'Sem template', family: 'x' })
      .returning('id')
      .executeTakeFirstOrThrow()
    await db
      .insertInto('chronicles')
      .values({ name: 'c', storyteller_id: user.id, system_id: system.id })
      .execute()
    await reset()
    expect(await db.selectFrom('users').selectAll().execute()).toEqual([])
    expect(await db.selectFrom('chronicles').selectAll().execute()).toEqual([])
    expect(await systems()).toEqual(seeded.systems as never)
  })

  it('devolve as linhas semeadas que o teste mudou ou apagou', async () => {
    await db.updateTable('game_systems').set({ name: 'Outro nome' }).execute()
    await db.deleteFrom('trait_templates').execute()
    await reset()
    expect(await systems()).toEqual(seeded.systems as never)
    expect(await templates()).toEqual(seeded.templates as never)
  })

  it('as chaves estrangeiras voltam a valer depois da restauração', async () => {
    await reset()
    const missing = '00000000-0000-0000-0000-000000000000'
    await expect(
      db
        .insertInto('chronicles')
        .values({ name: 'c', storyteller_id: missing, system_id: missing })
        .execute()
    ).rejects.toThrow()
  })
})
