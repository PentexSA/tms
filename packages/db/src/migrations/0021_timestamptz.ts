import { type Kysely, type RawBuilder, sql } from 'kysely'
import { logger } from '../logger'

// T-47: as nove colunas de data das migrations 0002 a 0005 eram `timestamp`
// sem fuso. O default now() gravava a hora de parede do fuso da sessão do
// Postgres; a API, a hora de parede do processo (o driver pg serializa o Date
// na hora local com o deslocamento, que a coluna sem fuso ignora). Ficha
// nova aparecia "alterada às 15:25" às 12:54, e a ordem por última alteração
// errava. Com timestamptz, o instante é o mesmo nos dois caminhos.
//
// Os dados existentes misturam as duas origens. Onde importa, dá para
// separar:
// - colunas só de default: hora do fuso do banco (current_setting);
// - colunas só da API (deleted_at): hora do fuso do processo que gravou;
// - updated_at de characters e chronicles: o INSERT grava created_at e
//   updated_at com o mesmo now() (o mesmo microssegundo). Igual ao
//   created_at, nunca foi tocada pela API: fuso do banco; senão, do processo.
//
// O fuso do processo não está no banco: vem de TMS_LEGACY_APP_TZ (o fuso em
// que rodava a API que gravou os dados). Sem ela, vale o fuso do processo que
// roda a migration. Isso é o certo onde a migration roda hoje:
// - deploy (deploy/render/start.sh): no mesmo container da API, logo antes
//   de subi-la, com o mesmo fuso (o Dockerfile não define TZ: UTC);
// - dev (scripts/backend.sh, pnpm db:migrate): na mesma máquina da API;
// - CI e testes: UTC.
// Quem rodar a migration fora da máquina ou do container da API que gravou os
// dados define TMS_LEGACY_APP_TZ. A migration loga os dois fusos usados, sem
// dado de usuário.

const DEFAULT_ONLY = [
  ['users', 'created_at'],
  ['users', 'updated_at'],
  ['game_systems', 'created_at'],
  ['chronicles', 'created_at'],
  ['characters', 'created_at'],
] as const
const APP_ONLY = [
  ['users', 'deleted_at'],
  ['characters', 'deleted_at'],
] as const
const MIXED = [
  ['chronicles', 'updated_at'],
  ['characters', 'updated_at'],
] as const

const alter = (
  table: string,
  column: string,
  type: 'timestamp' | 'timestamptz',
  using: RawBuilder<unknown>
) =>
  sql`alter table ${sql.table(table)} alter column ${sql.ref(column)} type ${sql.raw(type)} using ${using}`

/** Fuso do processo que gravou os dados antigos, conferido no Postgres. */
async function legacyAppTimeZone(db: Kysely<unknown>): Promise<string> {
  const zone =
    process.env.TMS_LEGACY_APP_TZ ??
    Intl.DateTimeFormat().resolvedOptions().timeZone
  // DDL não aceita parâmetro: o fuso só vira literal depois de conferido
  // numa consulta parametrizada (e o sql.lit ainda escapa as aspas)
  const { rows } = await sql<{ ok: boolean }>`
    select exists (select 1 from pg_timezone_names where name = ${zone}) as ok
  `.execute(db)
  if (!rows[0]?.ok)
    throw new Error('TMS_LEGACY_APP_TZ não é um fuso do Postgres')
  return zone
}

export async function up(db: Kysely<unknown>): Promise<void> {
  const appZone = await legacyAppTimeZone(db)
  const { rows } = await sql<{
    zone: string
  }>`select current_setting('TimeZone') as zone`.execute(db)
  logger.info(
    { databaseTimeZone: rows[0]?.zone, legacyAppTimeZone: appZone },
    '0021: fusos usados na conversão para timestamptz'
  )
  const app = sql.lit(appZone)
  const database = sql`current_setting('TimeZone')`
  // updated_at antes de created_at: a comparação usa o created_at ainda sem
  // fuso, no mesmo tipo
  for (const [table, column] of MIXED)
    await alter(
      table,
      column,
      'timestamptz',
      sql`case when ${sql.ref(column)} = created_at
        then ${sql.ref(column)} at time zone ${database}
        else ${sql.ref(column)} at time zone ${app} end`
    ).execute(db)
  for (const [table, column] of DEFAULT_ONLY)
    await alter(
      table,
      column,
      'timestamptz',
      sql`${sql.ref(column)} at time zone ${database}`
    ).execute(db)
  for (const [table, column] of APP_ONLY)
    await alter(
      table,
      column,
      'timestamptz',
      sql`${sql.ref(column)} at time zone ${app}`
    ).execute(db)
}

// Volta à hora de parede do fuso do banco, como o default gravava. Depois do
// down, a API volta a gravar no fuso do processo: o bug volta junto.
export async function down(db: Kysely<unknown>): Promise<void> {
  for (const [table, column] of [...MIXED, ...DEFAULT_ONLY, ...APP_ONLY])
    await alter(
      table,
      column,
      'timestamp',
      sql`${sql.ref(column)} at time zone current_setting('TimeZone')`
    ).execute(db)
}
