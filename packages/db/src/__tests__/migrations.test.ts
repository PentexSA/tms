/// <reference types="bun-types" />
import { describe, expect, it } from 'bun:test'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { Migrator, NO_MIGRATIONS, sql } from 'kysely'
import { migrationProvider, migrations } from '../migrations'
import { PRODUCT_TEMPLATES, productTemplate, storeTemplate } from '../templates'
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
        'character_commands',
        'character_events',
        'character_rolls',
        'characters',
        'chronicle_audit',
        'chronicle_commands',
        'chronicle_invites',
        'chronicle_members',
        'chronicle_operations',
        'chronicle_sessions',
        'chronicle_transfers',
        'chronicles',
        'game_systems',
        'refresh_tokens',
        'trait_templates',
        'user_commands',
        'users',
        'xp_entries',
        'xp_requests',
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
        .values({ code: 'sistema-teste', name: 'Teste' })
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
        chronicle_id: chronicle.id,
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
        .values({ code: 'sistema-teste', name: 'Teste' })
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
          chronicle_id: chronicle.id,
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
        .values({ code: 'sistema-teste', name: 'Teste' })
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

      // Estado fora da lista: o banco recusa
      await expect(
        db
          .updateTable('characters')
          .set({ status: 'zumbi' })
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

  it('0015: operação idempotente por chave, reversão de um alvo só e no máximo uma vez', async () => {
    const { db, destroy } = await createPGliteTestDb()
    try {
      const user = await db
        .insertInto('users')
        .values({ username: 'n', email: 'n@x.test', hashed_password: 'h' })
        .returning('id')
        .executeTakeFirstOrThrow()
      const system = await db
        .insertInto('game_systems')
        .values({ code: 'sistema-teste', name: 'Teste' })
        .returning('id')
        .executeTakeFirstOrThrow()
      const chronicle = await db
        .insertInto('chronicles')
        .values({ name: 'c', storyteller_id: user.id, system_id: system.id })
        .returning('id')
        .executeTakeFirstOrThrow()
      const op = (values: {
        client_operation_id?: string
        kind?: string
        reverts_operation_id?: string
        reverts_batch_id?: string
      }) =>
        db
          .insertInto('chronicle_operations')
          .values({
            chronicle_id: chronicle.id,
            client_operation_id: crypto.randomUUID(),
            kind: 'damage',
            created_by: user.id,
            ...values,
          })
          .returning('id')
          .executeTakeFirstOrThrow()
      const damage = await op({})
      const key = crypto.randomUUID()
      await op({ client_operation_id: key })
      // A mesma chave na mesma crônica não grava duas vezes
      await expect(op({ client_operation_id: key })).rejects.toThrow()
      await expect(op({ kind: 'explosion' })).rejects.toThrow()
      await op({ kind: 'revert', reverts_operation_id: damage.id })
      // Revertida uma vez só
      await expect(
        op({ kind: 'revert', reverts_operation_id: damage.id })
      ).rejects.toThrow()
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
          by_role: 'storyteller',
          sheet_version: 1,
          operation_id: damage.id,
        })
        .returning('id')
        .executeTakeFirstOrThrow()
      // Uma reversão aponta para a operação ou para o lote, nunca os dois
      await expect(
        op({
          kind: 'revert',
          reverts_operation_id: damage.id,
          reverts_batch_id: batch.id,
        })
      ).rejects.toThrow()
      const event = await db
        .insertInto('character_events')
        .values({
          batch_id: batch.id,
          seq: 0,
          path: 'values.blood',
          from_value: JSON.stringify({ current: 10 }),
          to_value: JSON.stringify({ current: 9 }),
        })
        .returning('from_absent')
        .executeTakeFirstOrThrow()
      expect(event.from_absent).toBe(false)
    } finally {
      await destroy()
    }
  })

  it('0016–0018: criação, extrato e um pedido pendente por traço', async () => {
    const { db, destroy } = await createPGliteTestDb()
    try {
      const user = await db
        .insertInto('users')
        .values({ username: 'n', email: 'n@x.test', hashed_password: 'h' })
        .returning('id')
        .executeTakeFirstOrThrow()
      const system = await db
        .insertInto('game_systems')
        .values({ code: 'sistema-teste', name: 'Teste' })
        .returning('id')
        .executeTakeFirstOrThrow()
      const chronicle = await db
        .insertInto('chronicles')
        .values({ name: 'c', storyteller_id: user.id, system_id: system.id })
        .returning([
          'id',
          'character_approval',
          'creation_defaults',
          'creation_settings_revision',
        ])
        .executeTakeFirstOrThrow()
      // Aprovação desligada por padrão
      expect(chronicle).toMatchObject({
        character_approval: false,
        creation_defaults: {},
        creation_settings_revision: 0,
      })
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
        .returning(['id', 'creation', 'creation_revision', 'activated_at'])
        .executeTakeFirstOrThrow()
      expect(character).toMatchObject({
        creation: {},
        creation_revision: 0,
        activated_at: null,
      })
      await db
        .updateTable('characters')
        .set({ status: 'pending', approved_by: user.id })
        .where('id', '=', character.id)
        .execute()
      const command = () =>
        db
          .insertInto('character_commands')
          .values({
            character_id: character.id,
            client_command_id: '00000000-0000-4000-8000-000000000001',
            kind: 'creation.complete',
            request_hash: 'h',
            result: JSON.stringify({ status: 'pending' }),
            created_by: user.id,
          })
          .execute()
      await command()
      // A mesma chave na mesma ficha não grava duas vezes
      await expect(command()).rejects.toThrow()

      // As operações de XP entram na lista de tipos
      await db
        .insertInto('chronicle_operations')
        .values({
          chronicle_id: chronicle.id,
          client_operation_id: crypto.randomUUID(),
          kind: 'xp-grant',
          request_hash: 'h',
        })
        .execute()
      const entry = (values: {
        kind: string
        total_delta?: number
        spent_delta?: number
        reverses_entry_id?: string
      }) =>
        db
          .insertInto('xp_entries')
          .values({ character_id: character.id, ...values })
          .returning('id')
          .executeTakeFirstOrThrow()
      const grant = await entry({ kind: 'grant', total_delta: 5 })
      await expect(entry({ kind: 'grant', total_delta: -1 })).rejects.toThrow()
      await expect(entry({ kind: 'adjust', total_delta: 0 })).rejects.toThrow()
      await expect(entry({ kind: 'spend', spent_delta: 0 })).rejects.toThrow()
      await expect(
        entry({ kind: 'spend', spent_delta: 1, total_delta: 1 })
      ).rejects.toThrow()
      // Estorno: só um ajuste negativo aponta a concessão
      await entry({
        kind: 'adjust',
        total_delta: -2,
        reverses_entry_id: grant.id,
      })
      await expect(
        entry({ kind: 'adjust', total_delta: 2, reverses_entry_id: grant.id })
      ).rejects.toThrow()

      const request = (values: { status?: string; to_value?: number } = {}) =>
        db
          .insertInto('xp_requests')
          .values({
            character_id: character.id,
            client_request_id: crypto.randomUUID(),
            target_field: 'dexterity',
            target_key: 'dexterity',
            from_value: 2,
            to_value: 3,
            cost: 8,
            ...values,
          })
          .returning('id')
          .executeTakeFirstOrThrow()
      await request()
      // Um pendente por traço; decididos não contam
      await expect(request()).rejects.toThrow()
      await request({ status: 'rejected' })
      await expect(
        request({ status: 'approved', to_value: 4 })
      ).rejects.toThrow()
      await expect(request({ status: 'lost' })).rejects.toThrow()

      // A ficha sai: extrato e pedidos vão junto, mesmo com estorno apontando
      await db.deleteFrom('characters').execute()
      expect(await db.selectFrom('xp_entries').select('id').execute()).toEqual(
        []
      )
      expect(await db.selectFrom('xp_requests').select('id').execute()).toEqual(
        []
      )
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

  it('0019 diagnostica colisão histórica da chave de rolagem por crônica', async () => {
    const { db, destroy } = await createPGliteTestDb()
    try {
      const migrator = new Migrator({ db, provider: migrationProvider })
      expect(
        (await migrator.migrateTo('0018_xp_requests')).error
      ).toBeUndefined()
      const user = await db
        .insertInto('users')
        .values({ username: 'u', email: 'u@x.test', hashed_password: 'h' })
        .returning('id')
        .executeTakeFirstOrThrow()
      const system = await db
        .insertInto('game_systems')
        .values({ code: 'sistema-teste', name: 'Teste' })
        .returning('id')
        .executeTakeFirstOrThrow()
      const chronicle = await db
        .insertInto('chronicles')
        .values({ name: 'c', storyteller_id: user.id, system_id: system.id })
        .returning('id')
        .executeTakeFirstOrThrow()
      const characters = await db
        .insertInto('characters')
        .values(
          ['a', 'b'].map(name => ({
            name,
            chronicle_id: chronicle.id,
            system_id: system.id,
            user_id: user.id,
            template_version: '1.0.0',
            sheet_data: JSON.stringify({ values: { name } }),
          }))
        )
        .returning('id')
        .execute()
      const key = crypto.randomUUID()
      for (const character of characters)
        await sql`
          insert into character_rolls
            (character_id, client_roll_id, created_by, by_role, label, request, result)
          values
            (${character.id}, ${key}, ${user.id}, 'owner', 'Teste', '{}'::jsonb, '{}'::jsonb)
        `.execute(db)
      const result = await migrator.migrateToLatest()
      expect(result.error).toBeDefined()
      expect(String(result.error)).toContain(
        'client_roll_id histórico colide dentro da mesma crônica'
      )
    } finally {
      await destroy()
    }
  })

  it('0020: o banco migrado já tem os templates do produto, imutáveis por versão', async () => {
    const { db, destroy } = await createPGliteTestDb()
    try {
      const rows = await db
        .selectFrom('trait_templates as t')
        .innerJoin('game_systems as g', 'g.id', 't.system_id')
        .select(['g.code', 't.version'])
        .orderBy('g.code')
        .execute()
      const current = PRODUCT_TEMPLATES.map(system => ({
        code: system,
        version: (productTemplate(system) as { templateVersion: string })
          .templateVersion,
      })).sort((a, b) => a.code.localeCompare(b.code))
      expect(rows).toEqual(current)
      const vtm = productTemplate('vtm-v20') as Record<string, unknown>
      expect((await storeTemplate(db, vtm)).status).toBe('unchanged')
      expect(
        (await storeTemplate(db, { ...vtm, name: 'Outro conteúdo' })).status
      ).toBe('conflict')
    } finally {
      await destroy()
    }
  })

  it('0020 não sobrescreve a versão já gravada com outro conteúdo', async () => {
    const { db, destroy } = await createPGliteTestDb()
    try {
      const migrator = new Migrator({ db, provider: migrationProvider })
      expect((await migrator.migrateTo('0019_backstage')).error).toBeUndefined()
      await db.deleteFrom('trait_templates').execute()
      const vtm = productTemplate('vtm-v20') as Record<string, unknown>
      expect(
        (await storeTemplate(db, { ...vtm, name: 'Outro conteúdo' })).status
      ).toBe('published')
      const result = await migrator.migrateToLatest()
      expect(String(result.error)).toContain(
        'já está no banco com outro conteúdo'
      )
    } finally {
      await destroy()
    }
  })

  // Onda 4 (onda-4.md §4.7): a 0023 grava as versões novas dos templates do
  // produto num banco que já tem as anteriores, que continuam lá
  describe('0023: as versões da onda 4', () => {
    // As versões de hoje, dos arquivos; a "anterior" de cada uma é a minor de
    // antes. O banco "de antes" leva o conteúdo de hoje com essa versão: o
    // teste prova a convivência das versões, não o conteúdo da main
    const current = (system: string) =>
      (productTemplate(system) as { templateVersion: string }).templateVersion
    const previousOf = (v: string) => {
      const [major, minor, patch] = v.split('.').map(Number)
      return `${major}.${(minor ?? 1) - 1}.${patch}`
    }
    const versions = async (
      db: Awaited<ReturnType<typeof createPGliteTestDb>>['db']
    ) =>
      (
        await db
          .selectFrom('trait_templates as t')
          .innerJoin('game_systems as g', 'g.id', 't.system_id')
          .select(['g.code', 't.version'])
          .orderBy('g.code')
          .orderBy('t.version')
          .execute()
      ).map(r => `${r.code}@${r.version}`)

    it('cada template do produto tem uma minor de antes para conviver', () => {
      for (const system of PRODUCT_TEMPLATES)
        expect(Number(current(system).split('.')[1])).toBeGreaterThan(0)
    })

    it('um banco com as versões anteriores ganha as novas, e as anteriores ficam', async () => {
      const { db, destroy } = await createPGliteTestDb()
      try {
        const migrator = new Migrator({ db, provider: migrationProvider })
        expect(
          (await migrator.migrateTo('0022_user_commands')).error
        ).toBeUndefined()
        // Como em produção antes da onda: só as versões anteriores no banco
        await db.deleteFrom('trait_templates').execute()
        for (const system of PRODUCT_TEMPLATES) {
          const old = {
            ...(productTemplate(system) as Record<string, unknown>),
            templateVersion: previousOf(current(system)),
          }
          expect((await storeTemplate(db, old)).status).toBe('published')
        }
        expect((await migrator.migrateToLatest()).error).toBeUndefined()
        // As anteriores ficam; as novas entram (a ordem de gravação é a de
        // PRODUCT_TEMPLATES, no laço da migration; o published_at da mesma
        // transação não a distingue)
        expect((await versions(db)).sort()).toEqual(
          PRODUCT_TEMPLATES.flatMap(system => [
            `${system}@${previousOf(current(system))}`,
            `${system}@${current(system)}`,
          ]).sort()
        )
        // Num banco novo, a 0020 já gravou estes arquivos: a 0023 só confirma
        for (const system of PRODUCT_TEMPLATES)
          expect(
            (await storeTemplate(db, productTemplate(system))).status
          ).toBe('unchanged')
      } finally {
        await destroy()
      }
    })

    it('a 0023 recusa a versão já gravada com outro conteúdo', async () => {
      const { db, destroy } = await createPGliteTestDb()
      try {
        const migrator = new Migrator({ db, provider: migrationProvider })
        expect(
          (await migrator.migrateTo('0022_user_commands')).error
        ).toBeUndefined()
        await db.deleteFrom('trait_templates').execute()
        const vtm = productTemplate('vtm-v20') as Record<string, unknown>
        await storeTemplate(db, { ...vtm, name: 'Outro conteúdo' })
        const result = await migrator.migrateToLatest()
        expect(String(result.error)).toContain(
          'já está no banco com outro conteúdo'
        )
      } finally {
        await destroy()
      }
    })

    it('descer a 0023 não apaga versão publicada', async () => {
      const { db, destroy } = await createPGliteTestDb()
      try {
        const before = await versions(db)
        const migrator = new Migrator({ db, provider: migrationProvider })
        const down = await migrator.migrateTo('0022_user_commands')
        expect(down.error).toBeUndefined()
        expect(down.results?.map(r => r.migrationName)).toEqual([
          '0025_character_reveal',
          '0023_templates_onda4',
        ])
        expect(await versions(db)).toEqual(before)
        expect((await migrator.migrateToLatest()).error).toBeUndefined()
      } finally {
        await destroy()
      }
    })
  })

  // T-47: a hora da Mesa vinha 3 h no futuro e a ordem por última alteração
  // errava, porque as colunas das migrations 0002 a 0005 não tinham fuso
  it('0021: nenhuma coluna timestamp sem fuso no schema', async () => {
    const { db, destroy } = await createPGliteTestDb()
    try {
      const { rows } = await sql<{ column: string }>`
        select table_name || '.' || column_name as column
        from information_schema.columns
        where table_schema = 'public'
          and data_type = 'timestamp without time zone'
        order by 1`.execute(db)
      expect(rows).toEqual([])
    } finally {
      await destroy()
    }
  })

  it('0021 converte o default no fuso do banco e o que a API gravou no fuso do processo', async () => {
    const { db, destroy } = await createPGliteTestDb()
    const previous = process.env.TMS_LEGACY_APP_TZ
    try {
      const migrator = new Migrator({ db, provider: migrationProvider })
      expect(
        (await migrator.migrateTo('0020_product_templates')).error
      ).toBeUndefined()
      // O banco em UTC (o default now() gravou a hora UTC) e a API em
      // Brasília (gravou a hora de Brasília). Texto literal, não Date: o
      // PGLite serializa o Date em UTC e a mistura não aconteceria
      await sql`set time zone 'UTC'`.execute(db)
      const { rows: users } = await sql<{ id: string }>`
        insert into users (email, username, hashed_password, created_at, updated_at, deleted_at)
        values ('t47@x.test', 't47', 'h', '2026-11-01 15:00:00', '2026-11-01 15:00:00', '2026-11-01 12:10:00')
        returning id`.execute(db)
      const user = users[0]?.id
      const { rows: systems } = await sql<{ id: string }>`
        select id from game_systems order by code limit 1`.execute(db)
      const system = systems[0]?.id
      const { rows: chronicles } = await sql<{ id: string }>`
        insert into chronicles (name, storyteller_id, system_id, created_at, updated_at)
        values ('c', ${user}, ${system}, '2026-11-01 15:20:00', '2026-11-01 12:40:00')
        returning id`.execute(db)
      const chronicle = chronicles[0]?.id
      // Ficha nova (nunca tocada pela API) e ficha editada pela API depois
      await sql`
        insert into characters
          (name, chronicle_id, system_id, user_id, template_version, sheet_data, created_at, updated_at)
        values
          ('nova', ${chronicle}, ${system}, ${user}, '1.0.0', '{}', '2026-11-01 16:04:00.123456', '2026-11-01 16:04:00.123456'),
          ('editada', ${chronicle}, ${system}, ${user}, '1.0.0', '{}', '2026-11-01 15:50:00', '2026-11-01 13:30:00')
      `.execute(db)

      process.env.TMS_LEGACY_APP_TZ = 'America/Sao_Paulo'
      expect((await migrator.migrateToLatest()).error).toBeUndefined()

      const utc = (column: string, table: string) =>
        sql<{ v: string }>`
          select to_char(${sql.ref(column)} at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS') as v
          from ${sql.table(table)} order by ${sql.ref(column)} desc`
          .execute(db)
          .then(r => r.rows.map(row => row.v))
      // Default: a hora UTC continua; API: Brasília (-03) vira UTC
      expect(await utc('created_at', 'users')).toEqual(['2026-11-01 15:00:00'])
      expect(await utc('deleted_at', 'users')).toEqual(['2026-11-01 15:10:00'])
      expect(await utc('updated_at', 'chronicles')).toEqual([
        '2026-11-01 15:40:00',
      ])
      // A editada às 16:30 UTC, a nova às 16:04 UTC, intacta
      expect(await utc('updated_at', 'characters')).toEqual([
        '2026-11-01 16:30:00',
        '2026-11-01 16:04:00',
      ])
      // A última alteração ordena certo: a editada vem primeiro
      const { rows: order } = await sql<{ name: string }>`
        select name from characters order by updated_at desc`.execute(db)
      expect(order.map(r => r.name)).toEqual(['editada', 'nova'])

      // O down volta os tipos e a hora de parede do fuso do banco. Desce até
      // antes da 0021: as migrations depois dela (0022) descem junto
      expect(
        (await migrator.migrateTo('0020_product_templates')).error
      ).toBeUndefined()
      const { rows: types } = await sql<{ column: string }>`
        select table_name || '.' || column_name as column
        from information_schema.columns
        where table_schema = 'public'
          and data_type = 'timestamp without time zone'
        order by 1`.execute(db)
      expect(types.map(r => r.column)).toEqual([
        'characters.created_at',
        'characters.deleted_at',
        'characters.updated_at',
        'chronicles.created_at',
        'chronicles.updated_at',
        'game_systems.created_at',
        'users.created_at',
        'users.deleted_at',
        'users.updated_at',
      ])
      const { rows: back } = await sql<{ v: string }>`
        select deleted_at::text as v from users`.execute(db)
      expect(back.map(r => r.v)).toEqual(['2026-11-01 15:10:00'])
    } finally {
      if (previous === undefined) delete process.env.TMS_LEGACY_APP_TZ
      else process.env.TMS_LEGACY_APP_TZ = previous
      await destroy()
    }
  })

  it('0021 recusa um TMS_LEGACY_APP_TZ que não é fuso do Postgres', async () => {
    const { db, destroy } = await createPGliteTestDb()
    const previous = process.env.TMS_LEGACY_APP_TZ
    try {
      const migrator = new Migrator({ db, provider: migrationProvider })
      expect(
        (await migrator.migrateTo('0020_product_templates')).error
      ).toBeUndefined()
      process.env.TMS_LEGACY_APP_TZ = "UTC'; drop table users; --"
      const result = await migrator.migrateToLatest()
      expect(String(result.error)).toContain(
        'TMS_LEGACY_APP_TZ não é um fuso do Postgres'
      )
      const { rows } = await sql<{ n: number }>`
        select count(*)::int as n from information_schema.tables
        where table_schema = 'public' and table_name = 'users'`.execute(db)
      expect(rows[0]?.n).toBe(1)
    } finally {
      if (previous === undefined) delete process.env.TMS_LEGACY_APP_TZ
      else process.env.TMS_LEGACY_APP_TZ = previous
      await destroy()
    }
  })

  it('0022: a chave do comando é por usuário e cai com a conta', async () => {
    const { db, destroy } = await createPGliteTestDb()
    try {
      const user = (name: string) =>
        db
          .insertInto('users')
          .values({
            username: name,
            email: `${name}@x.test`,
            hashed_password: 'h',
          })
          .returning('id')
          .executeTakeFirstOrThrow()
      const a = await user('a')
      const b = await user('b')
      const key = crypto.randomUUID()
      const command = (userId: string) =>
        db
          .insertInto('user_commands')
          .values({
            user_id: userId,
            client_command_id: key,
            kind: 'chronicle.create',
            request_hash: 'h',
            result: JSON.stringify({ id: crypto.randomUUID() }),
          })
          .execute()
      await command(a.id)
      // A mesma chave do mesmo usuário não grava duas vezes
      await expect(command(a.id)).rejects.toThrow()
      // Em outra conta, é outra intenção
      await command(b.id)
      await db.deleteFrom('users').where('id', '=', a.id).execute()
      const left = await db
        .selectFrom('user_commands')
        .select('user_id')
        .execute()
      expect(left).toEqual([{ user_id: b.id }])
    } finally {
      await destroy()
    }
  })

  it('0025: a ficha nasce privada; NPC e mais de 8 seções são recusados; desce e sobe', async () => {
    const { db, destroy } = await createPGliteTestDb()
    try {
      const migrator = new Migrator({ db, provider: migrationProvider })
      expect(
        (await migrator.migrateTo('0023_templates_onda4')).error
      ).toBeUndefined()
      const user = await db
        .insertInto('users')
        .values({ username: 'u', email: 'u@x.test', hashed_password: 'h' })
        .returning('id')
        .executeTakeFirstOrThrow()
      const system = await db
        .insertInto('game_systems')
        .values({ code: 'sistema-teste', name: 'Teste' })
        .returning('id')
        .executeTakeFirstOrThrow()
      const chronicle = await db
        .insertInto('chronicles')
        .values({ name: 'c', storyteller_id: user.id, system_id: system.id })
        .returning('id')
        .executeTakeFirstOrThrow()
      const insert = (name: string, kind: 'pc' | 'npc') =>
        db
          .insertInto('characters')
          .values({
            name,
            kind,
            chronicle_id: chronicle.id,
            system_id: system.id,
            user_id: user.id,
            template_version: '1.0.0',
            sheet_data: JSON.stringify({ values: { name } }),
          })
          .returning('id')
          .executeTakeFirstOrThrow()
      // Uma ficha de antes da 0025
      const old = await insert('antiga', 'pc')
      expect((await migrator.migrateToLatest()).error).toBeUndefined()
      const npc = await insert('npc', 'npc')
      const pc = await insert('nova', 'pc')
      const rows = await db
        .selectFrom('characters')
        .select(['id', 'revealed_sections', 'reveal_revision'])
        .orderBy('name')
        .execute()
      for (const row of rows) {
        expect(row.revealed_sections).toEqual([])
        expect(row.reveal_revision).toBe(0)
      }
      expect(rows.map(r => r.id).sort()).toEqual([old.id, npc.id, pc.id].sort())
      const reveal = (id: string, sections: string[]) =>
        db
          .updateTable('characters')
          .set({ revealed_sections: sections })
          .where('id', '=', id)
          .execute()
      await reveal(pc.id, ['storyteller'])
      await expect(reveal(npc.id, ['storyteller'])).rejects.toThrow()
      await expect(
        reveal(
          pc.id,
          Array.from({ length: 9 }, (_, i) => `s${i}`)
        )
      ).rejects.toThrow()

      const down = await migrator.migrateTo('0023_templates_onda4')
      expect(down.error).toBeUndefined()
      const { rows: columns } = await sql<{ column_name: string }>`
        select column_name from information_schema.columns
        where table_name = 'characters'
          and column_name in ('revealed_sections', 'reveal_revision')`.execute(
        db
      )
      expect(columns).toEqual([])
      expect((await migrator.migrateToLatest()).error).toBeUndefined()
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
