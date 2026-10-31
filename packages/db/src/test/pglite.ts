import { PGlite } from '@electric-sql/pglite'
import { Kysely, type MigrationProvider, Migrator, sql } from 'kysely'
import { KyselyPGlite } from 'kysely-pglite'
import { migrationProvider } from '../migrations'
import type { DB } from '../types'

/**
 * Cria um Postgres em memória (PGLite) com todas as migrations aplicadas.
 *
 * Usa o mesmo `Migrator` do Kysely que o `migrate.ts` e falha se uma
 * migration falhar: teste com schema incompleto não passa. Com as migrations
 * do pacote, migra uma vez por processo e clona o diretório de dados a cada
 * banco (~4x mais rápido que migrar de novo).
 *
 * @example
 * const { db, destroy } = await createPGliteTestDb()
 * const users = await db.selectFrom('users').selectAll().execute()
 * await destroy()
 */
export async function createPGliteTestDb(
  provider: MigrationProvider = migrationProvider
) {
  const pglite =
    provider === migrationProvider
      ? new PGlite({ loadDataDir: await migratedSnapshot() })
      : await migrated(provider)
  return open(pglite)
}

/**
 * Banco de teste que se restaura sem subir outro PGLite: `reset()` volta os
 * dados ao estado de logo depois das migrations (~24 ms contra ~234 ms de um
 * banco novo). Apaga tudo e devolve as linhas que as migrations semearam
 * (sistemas e templates do produto), inclusive as que um teste mudou.
 *
 * @example
 * const { db, reset, destroy } = await createResettablePGliteTestDb()
 * await reset() // antes de cada teste
 * await destroy() // no fim do arquivo
 */
export async function createResettablePGliteTestDb() {
  const { db, destroy } = await createPGliteTestDb()
  const tables = (
    await sql<{ name: string }>`
      select tablename as name from pg_tables
      where schemaname = 'public' and tablename not like 'kysely_%'
      order by tablename`.execute(db)
  ).rows.map(r => `"${r.name}"`)
  // Uma cópia do que as migrations deixaram em cada tabela com dados
  await sql`create schema test_seed`.execute(db)
  const seeded: string[] = []
  for (const table of tables) {
    await sql
      .raw(`create table test_seed.${table} as table public.${table}`)
      .execute(db)
    const { rows } = await sql<{ n: number }>`
      select count(*)::int as n from ${sql.raw(`test_seed.${table}`)}`.execute(
      db
    )
    if (rows[0]?.n) seeded.push(table)
    else await sql.raw(`drop table test_seed.${table}`).execute(db)
  }
  const restore = [
    `truncate ${tables.map(t => `public.${t}`).join(', ')} restart identity cascade`,
    // Sem as chaves estrangeiras durante a cópia: a ordem das tabelas não
    // importa (o `local` vale só até o fim da transação)
    'set local session_replication_role = replica',
    ...seeded.map(t => `insert into public.${t} select * from test_seed.${t}`),
  ]
  const reset = () =>
    db.transaction().execute(async trx => {
      for (const statement of restore) await sql.raw(statement).execute(trx)
    })
  return { db, reset, destroy }
}

let snapshot: Promise<Blob> | undefined

function migratedSnapshot(): Promise<Blob> {
  snapshot ??= (async () => {
    const pglite = await migrated(migrationProvider)
    const blob = await pglite.dumpDataDir('none')
    await pglite.close()
    return blob
  })().catch(error => {
    snapshot = undefined
    throw error
  })
  return snapshot
}

async function migrated(provider: MigrationProvider): Promise<PGlite> {
  const pglite = new PGlite()
  const db = new Kysely<DB>({ dialect: new KyselyPGlite(pglite).dialect })
  const { error } = await new Migrator({ db, provider }).migrateToLatest()
  if (error) {
    await pglite.close()
    throw error instanceof Error ? error : new Error(String(error))
  }
  return pglite
}

function open(pglite: PGlite) {
  const db = new Kysely<DB>({ dialect: new KyselyPGlite(pglite).dialect })
  const destroy = async () => {
    try {
      // O driver do kysely-pglite fecha o PGLite junto
      await db.destroy()
    } catch {
      // já destruído
    }
    if (!pglite.closed)
      try {
        await pglite.close()
      } catch {
        // já fechado
      }
    // Fechado, o PGLite ainda segura o módulo WASM (~180 MB). Quem guardou o
    // db (o ctx de um arquivo de teste, vivo até o fim do bun test) seguraria
    // essa memória: soltar aqui mantém a suíte num processo só sem acumular.
    Object.assign(pglite, { mod: undefined, fs: undefined })
  }
  return { db, destroy }
}
