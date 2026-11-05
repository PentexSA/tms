// Fase 5a (doc/plano-observabilidade-fase-5.md §2): relatório de funil e
// retenção sobre os dados que o banco já tem, sob demanda.
//
//   pnpm metrics:funnel --from 2026-10-01 --to 2026-11-01 \
//     --timezone America/Sao_Paulo [--window-days 7] [--format text|json]
//
// - Período semiaberto: inclui `from`, exclui `to`, datas no fuso informado.
//   Nada depois de `to` (ou do horário da extração, se `to` ainda não chegou)
//   entra em nenhuma conta: o mesmo banco dá o mesmo relatório.
// - Lê só METRICS_DATABASE_URL, de um role com leitura restrita
//   (scripts/metrics-role.sql). Nunca a DATABASE_URL, nem como fallback, e
//   se recusa a rodar com um role que leia além da lista ou possa escrever.
// - Uma transação somente leitura, com snapshot consistente (repeatable
//   read) e timeout por consulta; o pool fecha no fim, inclusive no erro.
// - A agregação é no banco. A saída só tem contagens, datas do período e
//   nomes de família: nenhum id de pessoa, ficha, crônica ou evento, nem no
//   erro (que só diz o código do Postgres).
// - Não importa a API, o Sentry nem os pacotes do monorepo: não envia nada a
//   outro serviço e não depende do build.
import { parseArgs } from 'node:util'
import { Kysely, PostgresDialect, type RawBuilder, sql } from 'kysely'
import pg from 'pg'

/** Colunas que o role do relatório lê; o resto do schema fica fechado. */
export const ALLOWED_COLUMNS: Readonly<Record<string, readonly string[]>> = {
  users: ['id', 'created_at'],
  chronicles: ['id', 'system_id'],
  game_systems: ['id', 'family'],
  chronicle_audit: [
    'chronicle_id',
    'actor_id',
    'action',
    'target_character_id',
    'target_user_id',
    'created_at',
  ],
  chronicle_members: ['chronicle_id', 'user_id', 'joined_at'],
  characters: [
    'id',
    'chronicle_id',
    'user_id',
    'system_id',
    'kind',
    'created_at',
  ],
  character_rolls: ['character_id', 'chronicle_id', 'created_by', 'created_at'],
  character_batches: ['character_id', 'created_by', 'created_at'],
}

const SENSITIVE = [
  'users.hashed_password',
  'users.email',
  'users.username',
  'refresh_tokens.token_hash',
  'chronicle_invites.code_hash',
  'characters.sheet_data',
  'chronicle_audit.payload',
  'chronicle_sessions.private_notes',
]

const SUBMITTED = ['character.creation.submit', 'character.creation.ready']
const ACTIVATED = ['character.creation.complete', 'character.creation.approve']

/**
 * Ações da auditoria que contam como atividade de produto na retenção
 * (criação, edição registrada e pedido de XP). Lista fixa: uma ação nova
 * só entra aqui de propósito.
 */
export const AUDIT_ACTIVITY = [
  'chronicle.create',
  'invite.create',
  'character.create-npc',
  ...SUBMITTED,
  ...ACTIVATED,
  'character.creation.return',
  'character.creation.adjust',
  'character.creation.update',
  'xp.request.create',
] as const

export const UNCLASSIFIED = '(não classificável)'

export class UsageError extends Error {}
export class RefusedError extends Error {}

export interface Params {
  readonly from: string
  readonly to: string
  readonly timezone: string
  readonly windowDays: number
  readonly format: 'text' | 'json'
  readonly timeoutMs: number
}

const USAGE = `Uso: pnpm metrics:funnel --from AAAA-MM-DD --to AAAA-MM-DD
  [--timezone America/Sao_Paulo] [--window-days 7] [--format text|json]
  [--timeout-ms 30000]

Lê METRICS_DATABASE_URL (role restrito: scripts/metrics-role.sql).`

const isDate = (s: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s)
}

const intIn = (raw: string, name: string, min: number, max: number) => {
  if (!/^\d+$/.test(raw)) throw new UsageError(`${name}: use um inteiro`)
  const n = Number(raw)
  if (n < min || n > max)
    throw new UsageError(`${name}: use um valor de ${min} a ${max}`)
  return n
}

export function parseParams(argv: readonly string[]): Params {
  let values: Record<string, string | undefined>
  try {
    ;({ values } = parseArgs({
      args: [...argv],
      strict: true,
      allowPositionals: false,
      options: {
        from: { type: 'string' },
        to: { type: 'string' },
        timezone: { type: 'string', default: 'America/Sao_Paulo' },
        'window-days': { type: 'string', default: '7' },
        format: { type: 'string', default: 'text' },
        'timeout-ms': { type: 'string', default: '30000' },
      },
    }))
  } catch {
    throw new UsageError(USAGE)
  }
  const { from, to, timezone = '', format } = values
  if (!from || !to) throw new UsageError(USAGE)
  if (!isDate(from) || !isDate(to))
    throw new UsageError('--from e --to: use datas AAAA-MM-DD')
  if (from >= to) throw new UsageError('--to precisa ser depois de --from')
  try {
    new Intl.DateTimeFormat('en', { timeZone: timezone })
  } catch {
    throw new UsageError('--timezone: use um fuso IANA, como America/Sao_Paulo')
  }
  if (format !== 'text' && format !== 'json')
    throw new UsageError('--format: text ou json')
  return {
    from,
    to,
    timezone,
    windowDays: intIn(values['window-days'] ?? '', '--window-days', 1, 90),
    format,
    timeoutMs: intIn(values['timeout-ms'] ?? '', '--timeout-ms', 1000, 600000),
  }
}

// Kysely de qualquer schema: as consultas são SQL cru
// biome-ignore lint/suspicious/noExplicitAny: o script não depende dos tipos do @tms/db
type Db = Kysely<any>

interface Bounds {
  readonly from: Date
  readonly to: Date
  readonly cutoff: Date
  readonly extractedAt: Date
  readonly tz: string
  readonly windowDays: number
}

const ts = (d: Date) => sql`${d}::timestamptz`
const list = (items: readonly string[]) => sql.join(items.map(i => sql.lit(i)))

/**
 * Confere o role antes de consultar: lê exatamente ALLOWED_COLUMNS no
 * schema public e não escreve. Sem fallback: um role a mais ou a menos é
 * recusado, com os nomes das colunas (só o schema, nunca dados).
 */
export async function checkPrivileges(db: Db): Promise<void> {
  const readable = await sql<{ table: string; column: string }>`
    select c.relname as "table", a.attname as "column"
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    join pg_catalog.pg_attribute a on a.attrelid = c.oid
    where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f')
      and a.attnum > 0 and not a.attisdropped
      and has_column_privilege(c.oid, a.attnum, 'SELECT')
  `.execute(db)
  const got = new Set(readable.rows.map(r => `${r.table}.${r.column}`))
  const allowed = new Set(
    Object.entries(ALLOWED_COLUMNS).flatMap(([t, cols]) =>
      cols.map(c => `${t}.${c}`)
    )
  )
  // As mais sensíveis primeiro, para a mensagem dizer o que importa
  const rank = (c: string) => (SENSITIVE.includes(c) ? 0 : 1)
  const extra = [...got]
    .filter(c => !allowed.has(c))
    .sort((x, y) => rank(x) - rank(y) || x.localeCompare(y))
  if (extra.length > 0)
    throw new RefusedError(
      `o role lê colunas fora da lista (${extra.length}): ${extra.slice(0, 8).join(', ')}${extra.length > 8 ? ', …' : ''}. ` +
        'Use o role restrito de scripts/metrics-role.sql, nunca a credencial da API.'
    )
  const missing = [...allowed].filter(c => !got.has(c)).sort()
  if (missing.length > 0)
    throw new RefusedError(
      `faltam permissões de leitura: ${missing.join(', ')}. Rode scripts/metrics-role.sql de novo.`
    )
  const writable = await sql<{ table: string }>`
    select c.relname as "table"
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'f')
      and (has_table_privilege(c.oid, 'DELETE, TRUNCATE, REFERENCES, TRIGGER')
        or has_any_column_privilege(c.oid, 'INSERT, UPDATE'))
    union all
    select 'schema public' where has_schema_privilege('public', 'CREATE')
  `.execute(db)
  if (writable.rows.length > 0)
    throw new RefusedError(
      `o role pode escrever (${writable.rows.map(r => r.table).join(', ')}). Use o role restrito de scripts/metrics-role.sql.`
    )
}

async function resolveBounds(
  db: Db,
  p: Params,
  now: Date | undefined
): Promise<Bounds> {
  const { rows } = await sql<{ from: Date; to: Date; now: Date }>`
    select (${p.from}::timestamp at time zone ${p.timezone}) as "from",
      (${p.to}::timestamp at time zone ${p.timezone}) as "to",
      ${now ? ts(now) : sql`now()`} as "now"
  `.execute(db)
  const r = rows[0]
  if (!r) throw new Error('bounds')
  const extractedAt = new Date(r.now)
  const from = new Date(r.from)
  const to = new Date(r.to)
  if (from.getTime() >= extractedAt.getTime())
    throw new UsageError('o período começa depois da extração: nada a medir')
  return {
    from,
    to,
    extractedAt,
    cutoff: to.getTime() < extractedAt.getTime() ? to : extractedAt,
    tz: p.timezone,
    windowDays: p.windowDays,
  }
}

const window = (b: Bounds) => sql`(${b.windowDays}::int * interval '1 day')`

/** Gera `count(*) filter (where flag)` e a mesma conta só para janelas completas. */
function counts(flags: readonly string[]): RawBuilder<unknown> {
  return sql.join(
    flags.flatMap(f => [
      sql.raw(`count(*) filter (where ${f})::int as "${f}"`),
      sql.raw(`count(*) filter (where mature and ${f})::int as "mature_${f}"`),
    ])
  )
}

type Counts<K extends string> = Readonly<Record<K, number>>

function split<K extends string>(
  row: Record<string, number>,
  flags: readonly K[]
): { all: Counts<K>; mature: Counts<K> } {
  const all = {} as Record<K, number>
  const mature = {} as Record<K, number>
  for (const f of flags) {
    all[f] = row[f] ?? 0
    mature[f] = row[`mature_${f}`] ?? 0
  }
  return { all, mature }
}

const NARRATOR_FLAGS = [
  'signed_up',
  'created_chronicle',
  'created_invite',
] as const

async function narratorFunnel(db: Db, b: Bounds) {
  // Cadastro → crônica criada pela pessoa → convite dela numa crônica que
  // ela criou, depois de criá-la, tudo dentro da janela a partir do cadastro
  const signups = await sql<Record<string, number>>`
    with signups as (
      select id, created_at,
        created_at + ${window(b)} <= ${ts(b.cutoff)} as mature,
        least(created_at + ${window(b)}, ${ts(b.cutoff)}) as until
      from users
      where created_at >= ${ts(b.from)} and created_at < ${ts(b.cutoff)}
    ),
    per_person as (
      select s.mature, true as signed_up,
        exists (
          select 1 from chronicle_audit c
          where c.action = 'chronicle.create' and c.actor_id = s.id
            and c.created_at >= s.created_at and c.created_at < s.until
        ) as created_chronicle,
        exists (
          select 1 from chronicle_audit c
          join chronicle_audit i on i.chronicle_id = c.chronicle_id
            and i.action = 'invite.create' and i.actor_id = c.actor_id
            and i.created_at >= c.created_at
          where c.action = 'chronicle.create' and c.actor_id = s.id
            and c.created_at >= s.created_at and i.created_at < s.until
        ) as created_invite
      from signups s
    )
    select count(*) filter (where mature)::int as mature_accounts,
      ${counts(NARRATOR_FLAGS)}
    from per_person
  `.execute(db)
  // Ativação de qualquer conta, sem exigir o cadastro no período
  const existing = await sql<Record<string, number>>`
    with created as (
      select a.actor_id, a.chronicle_id, a.created_at, u.created_at as account_at
      from chronicle_audit a
      left join users u on u.id = a.actor_id
      where a.action = 'chronicle.create' and a.actor_id is not null
        and a.created_at >= ${ts(b.from)} and a.created_at < ${ts(b.cutoff)}
    )
    select count(*)::int as chronicles,
      count(distinct actor_id)::int as people,
      count(distinct actor_id) filter (where account_at < ${ts(b.from)})::int
        as people_older_accounts,
      count(distinct actor_id) filter (where exists (
        select 1 from chronicle_audit i
        where i.action = 'invite.create' and i.actor_id = c.actor_id
          and i.chronicle_id = c.chronicle_id and i.created_at >= c.created_at
          and i.created_at < ${ts(b.cutoff)}
      ))::int as people_with_invite,
      (select count(*)::int from chronicle_audit
        where action = 'invite.create'
          and created_at >= ${ts(b.from)} and created_at < ${ts(b.cutoff)})
        as invites
    from created c
  `.execute(db)
  const s = signups.rows[0] ?? {}
  const e = existing.rows[0] ?? {}
  return {
    signupCohort: {
      ...split(s, NARRATOR_FLAGS),
      matureAccounts: s.mature_accounts ?? 0,
    },
    anyAccount: {
      chroniclesCreated: e.chronicles ?? 0,
      invitesCreated: e.invites ?? 0,
      peopleWhoCreatedChronicle: e.people ?? 0,
      ofWhichAccountBeforePeriod: e.people_older_accounts ?? 0,
      peopleWhoInvitedToOwnChronicle: e.people_with_invite ?? 0,
    },
  }
}

const PLAYER_FLAGS = [
  'joined',
  'drafted',
  'sent',
  'activated',
  'activated_by_owner',
  'activated_by_other',
  'activated_direct',
  'player_rolled',
  'only_other_rolled',
] as const

async function playerFunnel(db: Db, b: Bounds) {
  // Unidade: o vínculo (pessoa × crônica) que ainda existe, com as fichas
  // de PC dele criadas depois da entrada e dentro da janela
  const { rows } = await sql<Record<string, number>>`
    with joined as (
      select m.chronicle_id, m.user_id, m.joined_at,
        m.joined_at + ${window(b)} <= ${ts(b.cutoff)} as mature,
        least(m.joined_at + ${window(b)}, ${ts(b.cutoff)}) as until,
        -- Quem passou a narração vira membro na mesma transação: não é aceite
        exists (
          select 1 from chronicle_audit t
          where t.action = 'chronicle.transfer.accept'
            and t.chronicle_id = m.chronicle_id and t.target_user_id = m.user_id
            and t.created_at between m.joined_at - interval '1 minute'
              and m.joined_at + interval '1 minute'
        ) as transfer
      from chronicle_members m
      where m.joined_at >= ${ts(b.from)} and m.joined_at < ${ts(b.cutoff)}
    ),
    pcs as (
      select j.chronicle_id, j.user_id, j.until, ch.id as character_id
      from joined j
      join characters ch on ch.chronicle_id = j.chronicle_id
        and ch.user_id = j.user_id and ch.kind = 'pc'
        and ch.created_at >= j.joined_at and ch.created_at < j.until
      where not j.transfer
    ),
    steps as (
      select p.chronicle_id, p.user_id, p.until, p.character_id,
        (select min(a.created_at) from chronicle_audit a
          where a.target_character_id = p.character_id
            and a.action in (${list(SUBMITTED)}) and a.created_at < p.until)
          as sent_at,
        act.created_at as activated_at, act.actor_id as activated_by
      from pcs p
      left join lateral (
        select a.created_at, a.actor_id from chronicle_audit a
        where a.target_character_id = p.character_id
          and a.action in (${list(ACTIVATED)}) and a.created_at < p.until
        order by a.created_at limit 1
      ) act on true
    ),
    rolled as (
      select s.*,
        s.activated_at is not null and exists (
          select 1 from character_rolls r
          where r.character_id = s.character_id and r.created_by = s.user_id
            and r.created_at >= s.activated_at and r.created_at < s.until
        ) as player_rolled,
        s.activated_at is not null and exists (
          select 1 from character_rolls r
          where r.character_id = s.character_id
            and r.created_by is distinct from s.user_id
            and r.created_at >= s.activated_at and r.created_at < s.until
        ) as other_rolled
      from steps s
    ),
    per_membership as (
      select j.mature, true as joined,
        count(r.character_id) > 0 as drafted,
        coalesce(bool_or(r.sent_at is not null), false) as sent,
        coalesce(bool_or(r.activated_at is not null), false) as activated,
        coalesce(bool_or(r.activated_by = r.user_id), false)
          as activated_by_owner,
        coalesce(bool_or(r.activated_at is not null
          and r.activated_by is distinct from r.user_id), false)
          as activated_by_other,
        coalesce(bool_or(r.activated_at is not null
          and (r.sent_at is null or r.sent_at > r.activated_at)), false)
          as activated_direct,
        coalesce(bool_or(r.player_rolled), false) as player_rolled,
        coalesce(bool_or(r.other_rolled), false)
          and not coalesce(bool_or(r.player_rolled), false) as only_other_rolled
      from joined j
      left join rolled r on r.chronicle_id = j.chronicle_id
        and r.user_id = j.user_id
      where not j.transfer
      group by j.chronicle_id, j.user_id, j.mature
    )
    select
      (select count(*)::int from joined where transfer) as transfers_excluded,
      (select count(distinct user_id)::int from joined where not transfer)
        as people,
      count(*) filter (where mature)::int as mature_memberships,
      ${counts(PLAYER_FLAGS)}
    from per_membership
  `.execute(db)
  const r = rows[0] ?? {}
  return {
    ...split(r, PLAYER_FLAGS),
    people: r.people ?? 0,
    matureMemberships: r.mature_memberships ?? 0,
    transfersExcluded: r.transfers_excluded ?? 0,
  }
}

/** Atividade de produto por pessoa: a lista fixa da retenção. */
const activity = (b: Bounds) => sql`
  observed(person, at) as (
    select person, at from (
      select actor_id, created_at from chronicle_audit
        where action in (${list(AUDIT_ACTIVITY)})
      union all
      select user_id, created_at from characters where kind = 'pc'
      union all
      select created_by, created_at from character_batches
      union all
      select created_by, created_at from character_rolls
    ) a(person, at)
    where person is not null and at < ${ts(b.cutoff)}
  ),
  cohort as (
    select person, date_trunc('week', min(at) at time zone ${b.tz}) as week
    from observed
    group by person
    having min(at) >= ${ts(b.from)}
  ),
  cohort_weeks as (
    select week, count(*)::int as size from cohort group by week
  )`

export interface CohortRow {
  readonly week: string
  readonly size: number
  /** A semana da coorte começa antes do período ou termina depois dele. */
  readonly partial: boolean
  /** Só semanas já encerradas: `k` semanas depois da primeira atividade. */
  readonly returns: readonly { readonly k: number; readonly people: number }[]
}

async function retention(db: Db, b: Bounds): Promise<CohortRow[]> {
  const cohorts = await sql<{ week: string; size: number; partial: boolean }>`
    with ${activity(b)}
    select to_char(week, 'YYYY-MM-DD') as week, size,
      (week at time zone ${b.tz}) < ${ts(b.from)}
        or ((week + interval '1 week') at time zone ${b.tz}) > ${ts(b.cutoff)}
        as partial
    from cohort_weeks order by week
  `.execute(db)
  const returns = await sql<{ week: string; k: number; people: number }>`
    with ${activity(b)},
    active_weeks as (
      select distinct person, date_trunc('week', at at time zone ${b.tz}) as week
      from observed
    ),
    offsets as (
      select cw.week, k
      from cohort_weeks cw cross join generate_series(1, 520) as k
      where ((cw.week + (k + 1) * interval '1 week') at time zone ${b.tz})
        <= ${ts(b.cutoff)}
    )
    select to_char(o.week, 'YYYY-MM-DD') as week, o.k::int as k,
      count(w.person)::int as people
    from offsets o
    join cohort c on c.week = o.week
    left join active_weeks w on w.person = c.person
      and w.week = o.week + o.k * interval '1 week'
    group by o.week, o.k
    order by o.week, o.k
  `.execute(db)
  return cohorts.rows.map(c => ({
    week: c.week,
    size: c.size,
    partial: c.partial,
    returns: returns.rows
      .filter(r => r.week === c.week)
      .map(r => ({ k: r.k, people: r.people })),
  }))
}

export const FAMILY_KINDS = [
  'chronicles',
  'invites',
  'pcs',
  'pc_edits',
  'pc_rolls',
  'free_rolls',
  'xp_requests',
] as const
type FamilyKind = (typeof FAMILY_KINDS)[number]

export interface FamilyRow {
  readonly family: string
  readonly people: number
  readonly operations: Readonly<Record<FamilyKind, number>>
}

async function families(db: Db, b: Bounds): Promise<FamilyRow[]> {
  const period = (col: string) =>
    sql`${sql.ref(col)} >= ${ts(b.from)} and ${sql.ref(col)} < ${ts(b.cutoff)}`
  const ops = sql`
    ops(family, kind, person) as (
      select gs.family,
        case a.action when 'chronicle.create' then 'chronicles'
          when 'invite.create' then 'invites' else 'xp_requests' end,
        a.actor_id
      from chronicle_audit a
      join chronicles c on c.id = a.chronicle_id
      left join game_systems gs on gs.id = c.system_id
      where a.action in ('chronicle.create', 'invite.create', 'xp.request.create')
        and ${period('a.created_at')}
      union all
      select gs.family, 'pcs', ch.user_id
      from characters ch left join game_systems gs on gs.id = ch.system_id
      where ch.kind = 'pc' and ${period('ch.created_at')}
      union all
      select gs.family, 'pc_edits', b.created_by
      from character_batches b
      join characters ch on ch.id = b.character_id and ch.kind = 'pc'
      left join game_systems gs on gs.id = ch.system_id
      where ${period('b.created_at')}
      union all
      select gs.family,
        case when r.character_id is null then 'free_rolls' else 'pc_rolls' end,
        r.created_by
      from character_rolls r
      join chronicles c on c.id = r.chronicle_id
      left join game_systems gs on gs.id = c.system_id
      left join characters ch on ch.id = r.character_id
      where (r.character_id is null or ch.kind = 'pc')
        and ${period('r.created_at')}
    )`
  const byKind = await sql<{
    family: string | null
    kind: FamilyKind
    n: number
  }>`
    with ${ops}
    select family, kind, count(*)::int as n from ops group by family, kind
  `.execute(db)
  const people = await sql<{ family: string | null; people: number }>`
    with ${ops}
    select family, count(distinct person)::int as people from ops group by family
  `.execute(db)
  const name = (f: string | null) => f ?? UNCLASSIFIED
  return people.rows
    .map(p => {
      const operations = Object.fromEntries(
        FAMILY_KINDS.map(k => [k, 0])
      ) as Record<FamilyKind, number>
      for (const r of byKind.rows)
        if (r.family === p.family) operations[r.kind] = r.n
      return { family: name(p.family), people: p.people, operations }
    })
    .sort((x, y) =>
      x.family === UNCLASSIFIED
        ? 1
        : y.family === UNCLASSIFIED
          ? -1
          : x.family.localeCompare(y.family)
    )
}

async function gaps(db: Db, b: Bounds) {
  const inPeriod = sql`created_at >= ${ts(b.from)} and created_at < ${ts(b.cutoff)}`
  const { rows } = await sql<Record<string, number>>`
    select
      (select count(*)::int from chronicle_audit
        where actor_id is null and action in (${list(AUDIT_ACTIVITY)})
          and ${inPeriod}) as audit_without_actor,
      (select count(*)::int from chronicle_audit
        where target_character_id is null
          and action in (${list([...SUBMITTED, ...ACTIVATED])})
          and ${inPeriod}) as creation_without_character,
      (select count(*)::int from character_rolls
        where created_by is null and ${inPeriod}) as rolls_without_author,
      (select count(*)::int from character_batches
        where created_by is null and ${inPeriod}) as edits_without_author
  `.execute(db)
  // Desde quando a auditoria tem crônica e convite (instrumentação recente):
  // antes disso o funil do narrador dá zero sem medir nada
  const since = await sql<{ action: string; day: string }>`
    select action, to_char(min(created_at) at time zone ${b.tz}, 'YYYY-MM-DD') as day
    from chronicle_audit
    where action in ('chronicle.create', 'invite.create')
      and created_at < ${ts(b.cutoff)}
    group by action
  `.execute(db)
  const day = (action: string) =>
    since.rows.find(x => x.action === action)?.day ?? null
  const r = rows[0] ?? {}
  return {
    auditSince: {
      chronicleCreate: day('chronicle.create'),
      inviteCreate: day('invite.create'),
    },
    auditWithoutActor: r.audit_without_actor ?? 0,
    creationWithoutCharacter: r.creation_without_character ?? 0,
    rollsWithoutAuthor: r.rolls_without_author ?? 0,
    editsWithoutAuthor: r.edits_without_author ?? 0,
  }
}

export const DEFINITIONS = [
  'Narrador: cadastro no período → crônica criada pela pessoa (auditoria chronicle.create) → convite criado por ela numa crônica que ela criou, depois de criá-la (invite.create), dentro da janela a partir do cadastro.',
  'Qualquer conta: quem criou crônica no período, com ou sem cadastro nele, e quem convidou para uma crônica própria até o fim do período.',
  'Jogador: por vínculo ainda existente (pessoa × crônica) iniciado no período → rascunho de PC criado depois da entrada → envio para aprovação ou aviso de criação livre (character.creation.submit/ready) → ativação (character.creation.complete/approve) → rolagem registrada pelo próprio dono no PC depois da ativação. Tudo dentro da janela a partir da entrada.',
  'Ativação direta: sem envio ou aviso antes (conclusão do dono sem aprovação, ou do narrador). "Por outra pessoa" é o narrador ou uma conta excluída.',
  'Retenção: coorte pela semana (segunda a domingo, no fuso) da primeira atividade disponível de cada pessoa, se ela caiu no período; retorno é atividade numa semana posterior. Só aparecem semanas já encerradas antes do fim da observação.',
  `Atividade: ações da auditoria (${AUDIT_ACTIVITY.join(', ')}), PC criado (dono), edição registrada (character_batches, autor) e rolagem registrada (autor, inclusive NPC e parada livre).`,
  'Família: game_systems.family da crônica (ou da ficha). Rolagens excluem NPC e separam PC de parada livre do narrador; edições contam só PCs.',
]

export const LIMITATIONS = [
  'Contas excluídas não aparecem, e o que fizeram fica sem autoria: não dá para reconstruir.',
  'Crônicas apagadas levam a auditoria junto (cascata); a auditoria de crônica e convite só existe desde a instrumentação dessas ações.',
  'Vínculo é o que ainda existe: saída e remoção apagam a entrada, e a reentrada guarda só a data nova. Não é o histórico de aceites.',
  'Rascunho mede ficha salva, não formulário aberto, tentativa ou abandono antes de salvar. Envio e ativação são operações confirmadas, não tentativas.',
  'Sem o payload da auditoria: sem recorte por modo de criação; a configuração atual da ficha não prova o modo do passado.',
  'Rolagens locais, sem registro, não estão no banco. Login e ausência de registro não provam uso nem inatividade.',
  'Uma pessoa pode narrar e jogar: os funis não são grupos exclusivos. Amostra pequena: leia as contagens, não os percentuais.',
]

export type Report = Awaited<ReturnType<typeof buildReport>>

/** Todas as consultas, no snapshot da transação. */
export async function buildReport(db: Db, p: Params, now?: Date) {
  await checkPrivileges(db)
  const b = await resolveBounds(db, p, now)
  return {
    report: 'tms-metrics-funnel',
    version: 1,
    period: {
      from: p.from,
      to: p.to,
      timezone: p.timezone,
      fromInstant: b.from.toISOString(),
      toInstant: b.to.toISOString(),
      observedUntil: b.cutoff.toISOString(),
      open: b.cutoff.getTime() < b.to.getTime(),
    },
    extractedAt: b.extractedAt.toISOString(),
    windowDays: b.windowDays,
    narrator: await narratorFunnel(db, b),
    player: await playerFunnel(db, b),
    retention: await retention(db, b),
    families: await families(db, b),
    gaps: await gaps(db, b),
    definitions: DEFINITIONS,
    limitations: LIMITATIONS,
  }
}

/**
 * Snapshot consistente, somente leitura, com timeout por consulta. O modo
 * vem de um `set transaction` explícito e é conferido antes de `fn`: nem todo
 * driver do Kysely repassa o modo do builder (o do PGLite não repassa).
 */
export function readOnlySnapshot<T>(
  db: Db,
  timeoutMs: number,
  fn: (trx: Db) => Promise<T>
): Promise<T> {
  return db.transaction().execute(async trx => {
    await sql`set transaction isolation level repeatable read, read only`.execute(
      trx
    )
    await sql`select set_config('statement_timeout', ${String(timeoutMs)}, true)`.execute(
      trx
    )
    const { rows } = await sql<{ ro: string; iso: string }>`
      select current_setting('transaction_read_only') as ro,
        current_setting('transaction_isolation') as iso`.execute(trx)
    if (rows[0]?.ro !== 'on' || rows[0]?.iso !== 'repeatable read')
      throw new RefusedError('a transação não ficou somente leitura')
    return fn(trx)
  })
}

export function runReport(db: Db, p: Params, now?: Date): Promise<Report> {
  return readOnlySnapshot(db, p.timeoutMs, trx => buildReport(trx, p, now))
}

const pad = (s: string | number, n: number) => String(s).padStart(n)
const line = (label: string, all: number, mature: number) =>
  `  ${label.padEnd(46)}${pad(all, 6)}${pad(mature, 10)}`

/** Diz quando o zero do narrador é falta de registro, não medida. */
function auditCoverage(r: Report): string {
  const { chronicleCreate, inviteCreate } = r.gaps.auditSince
  const prefix = '  Primeiro registro na auditoria:'
  if (!chronicleCreate)
    return `${prefix} nenhuma crônica criada até o fim da observação (o funil do narrador não mede este período)`
  const late =
    chronicleCreate > r.period.from ? ' (antes disso, zero não é medida)' : ''
  return `${prefix} crônica ${chronicleCreate}, convite ${inviteCreate ?? 'nenhum'}${late}`
}

export function formatText(r: Report): string {
  const out: string[] = []
  const n = r.narrator
  const pl = r.player
  out.push(
    'Relatório de funil e retenção (Fase 5a)',
    `Período: ${r.period.from} (inclusive) a ${r.period.to} (exclusive), fuso ${r.period.timezone}`,
    `Observado até: ${r.period.observedUntil}${r.period.open ? ' (período ainda aberto: os números podem mudar)' : ''}`,
    `Extraído em: ${r.extractedAt}`,
    `Janela dos funis: ${r.windowDays} dias`,
    '',
    '1. Narrador: cadastros no período',
    `  ${''.padEnd(46)}${pad('todos', 6)}${pad('janela ok', 10)}`,
    line(
      'Cadastros',
      n.signupCohort.all.signed_up,
      n.signupCohort.mature.signed_up
    ),
    line(
      'Criaram crônica na janela',
      n.signupCohort.all.created_chronicle,
      n.signupCohort.mature.created_chronicle
    ),
    line(
      'Convidaram para a crônica na janela',
      n.signupCohort.all.created_invite,
      n.signupCohort.mature.created_invite
    ),
    auditCoverage(r),
    '',
    '   Qualquer conta, no período',
    `  Crônicas criadas: ${n.anyAccount.chroniclesCreated}; convites criados: ${n.anyAccount.invitesCreated}`,
    `  Pessoas que criaram crônica: ${n.anyAccount.peopleWhoCreatedChronicle} (conta anterior ao período: ${n.anyAccount.ofWhichAccountBeforePeriod})`,
    `  Dessas, convidaram para uma crônica própria: ${n.anyAccount.peopleWhoInvitedToOwnChronicle}`,
    '',
    `2. Jogador: vínculos iniciados no período (${pl.people} pessoas)`,
    `  ${''.padEnd(46)}${pad('todos', 6)}${pad('janela ok', 10)}`,
    line('Vínculos ainda existentes', pl.all.joined, pl.mature.joined),
    line('Com rascunho de PC', pl.all.drafted, pl.mature.drafted),
    line('Com envio ou aviso de criação', pl.all.sent, pl.mature.sent),
    line('Com PC ativado', pl.all.activated, pl.mature.activated),
    line(
      '  ativado pelo dono',
      pl.all.activated_by_owner,
      pl.mature.activated_by_owner
    ),
    line(
      '  ativado por outra pessoa',
      pl.all.activated_by_other,
      pl.mature.activated_by_other
    ),
    line(
      '  ativação direta (sem envio antes)',
      pl.all.activated_direct,
      pl.mature.activated_direct
    ),
    line(
      'Com rolagem do próprio jogador',
      pl.all.player_rolled,
      pl.mature.player_rolled
    ),
    line(
      'Só com rolagem de outra pessoa',
      pl.all.only_other_rolled,
      pl.mature.only_other_rolled
    ),
    `  Excluídos: ${pl.transfersExcluded} vínculo(s) de ex-narrador por transferência`,
    '',
    '3. Retenção semanal observada (pessoas com retorno em +k semanas)'
  )
  if (r.retention.length === 0) out.push('  Nenhuma coorte no período.')
  for (const c of r.retention) {
    const ret = c.returns.map(x => `+${x.k}: ${x.people}`).join('  ')
    out.push(
      `  ${c.week}  coorte ${pad(c.size, 4)}${c.partial ? ' (semana parcial)' : ''}  ${ret || '(nenhuma semana encerrada)'}`
    )
  }
  out.push('', '4. Uso por família, no período')
  if (r.families.length === 0) out.push('  Nenhuma operação no período.')
  for (const f of r.families) {
    const o = f.operations
    out.push(
      `  ${f.family}: ${f.people} pessoa(s); crônicas ${o.chronicles}, convites ${o.invites}, PCs ${o.pcs}, edições ${o.pc_edits}, rolagens de PC ${o.pc_rolls}, paradas livres ${o.free_rolls}, pedidos de XP ${o.xp_requests}`
    )
  }
  const g = r.gaps
  out.push(
    '',
    'Registros sem autoria ou alvo no período (fora das contas por pessoa)',
    `  Auditoria sem autor: ${g.auditWithoutActor}; criação sem ficha: ${g.creationWithoutCharacter}; rolagens sem autor: ${g.rollsWithoutAuthor}; edições sem autor: ${g.editsWithoutAuthor}`,
    '',
    'Definições',
    ...r.definitions.map(d => `  - ${d}`),
    '',
    'Limitações',
    ...r.limitations.map(l => `  - ${l}`)
  )
  return `${out.join('\n')}\n`
}

/** Mensagem segura: o texto do erro do banco pode trazer valores. */
export function describeError(e: unknown): string {
  if (e instanceof UsageError) return e.message
  if (e instanceof RefusedError) return `Recusado: ${e.message}`
  const code =
    e && typeof e === 'object' && 'code' in e && typeof e.code === 'string'
      ? e.code
      : undefined
  const known: Record<string, string> = {
    '42501': 'permissão negada: confira os grants de scripts/metrics-role.sql',
    '57014': 'a consulta passou do timeout (--timeout-ms)',
    '25006': 'tentativa de escrita recusada: a transação é somente leitura',
    '28P01': 'autenticação recusada pelo banco',
    '28000': 'autenticação recusada pelo banco',
    '3D000': 'o banco da URL não existe',
    ECONNREFUSED: 'não conectou ao banco',
    ENOTFOUND: 'não conectou ao banco',
    ETIMEDOUT: 'não conectou ao banco',
  }
  if (code && known[code]) return `Falha: ${known[code]} (${code})`
  const safe = code && /^[0-9A-Z]{5}$|^E[A-Z]+$/.test(code) ? ` (${code})` : ''
  return `Falha ao gerar o relatório${safe}`
}

export interface MainDeps {
  readonly argv: readonly string[]
  readonly env: Readonly<Record<string, string | undefined>>
  readonly out: (s: string) => void
  readonly err: (s: string) => void
  readonly connect?: (url: string) => { db: Db; close: () => Promise<void> }
  readonly now?: Date
}

function connectPg(url: string) {
  const pool = new pg.Pool({
    connectionString: url,
    max: 1,
    connectionTimeoutMillis: 10000,
    application_name: 'tms-metrics-funnel',
  })
  // Erro de conexão ociosa: sem isso o processo cai com o texto cru
  pool.on('error', () => undefined)
  const db = new Kysely({ dialect: new PostgresDialect({ pool }) })
  return { db, close: () => db.destroy() }
}

export async function main(deps: MainDeps): Promise<number> {
  let params: Params
  try {
    params = parseParams(deps.argv)
  } catch (e) {
    deps.err(describeError(e))
    return 2
  }
  const url = deps.env.METRICS_DATABASE_URL?.trim()
  if (!url) {
    deps.err(
      'Falta METRICS_DATABASE_URL, de um role com leitura restrita (scripts/metrics-role.sql). A DATABASE_URL da API não é usada.'
    )
    return 2
  }
  let conn: ReturnType<NonNullable<MainDeps['connect']>> | undefined
  try {
    conn = (deps.connect ?? connectPg)(url)
    const report = await runReport(conn.db, params, deps.now)
    deps.out(
      params.format === 'json'
        ? `${JSON.stringify(report, null, 2)}\n`
        : formatText(report)
    )
    return 0
  } catch (e) {
    deps.err(describeError(e))
    return e instanceof UsageError ? 2 : 1
  } finally {
    await conn?.close().catch(() => undefined)
  }
}

if (import.meta.main)
  process.exitCode = await main({
    argv: process.argv.slice(2),
    env: process.env,
    out: s => process.stdout.write(s),
    err: s => process.stderr.write(`${s}\n`),
  })
