import { createHash } from 'node:crypto'
import type { DB } from '@tms/db'
import type { Kysely } from 'kysely'
import { logger } from '../logger'

// Refresh tokens opacos (32 bytes aleatórios), guardados só como SHA-256.
// Cada uso troca o token (rotação); reusar um token já trocado revoga a
// família inteira, porque só acontece se alguém copiou o token. O app faz um
// refresh por vez (single-flight) para nunca disparar isso sozinho.
//
// Tolerância (reuse interval, como no Auth0 e no Okta): o app encerrado com
// um refresh em voo não recebe o sucessor e, reaberto, apresenta o token
// anterior. Até REFRESH_REUSE_GRACE_MS depois do giro, e só se o sucessor
// ainda não foi usado nem revogado, o token anterior ganha um novo sucessor
// uma única vez. Fora disso, o reuso revoga a família como sempre.

export interface SessionConfig {
  readonly now: () => Date
  // Validade de cada token e limite absoluto da sessão (família).
  readonly refreshTtlMs: number
  readonly familyTtlMs: number
}

/** Janela da tolerância, contada do giro (`revoked_at`) do token anterior. */
export const REFRESH_REUSE_GRACE_MS = 30_000

const sha256 = (raw: string) => createHash('sha256').update(raw).digest('hex')

export function newRefreshToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Buffer.from(bytes).toString('base64url')
}

async function issue(
  db: Kysely<DB>,
  cfg: SessionConfig,
  userId: string,
  familyId: string,
  familyExpiresAt: Date,
  // Na tolerância: o novo token não vive mais que o sucessor que substitui
  notAfter?: Date
): Promise<{ id: string; raw: string }> {
  const raw = newRefreshToken()
  const now = cfg.now().getTime()
  const expiresAt = new Date(
    Math.min(
      now + cfg.refreshTtlMs,
      familyExpiresAt.getTime(),
      notAfter?.getTime() ?? Number.POSITIVE_INFINITY
    )
  )
  const { id } = await db
    .insertInto('refresh_tokens')
    .values({
      user_id: userId,
      family_id: familyId,
      token_hash: sha256(raw),
      created_at: cfg.now(),
      expires_at: expiresAt,
      family_expires_at: familyExpiresAt,
    })
    .returning('id')
    .executeTakeFirstOrThrow()
  return { id, raw }
}

/** Abre uma sessão (login ou cadastro) e devolve o refresh token. */
export async function createSession(
  db: Kysely<DB>,
  cfg: SessionConfig,
  userId: string
): Promise<string> {
  const familyExpiresAt = new Date(cfg.now().getTime() + cfg.familyTtlMs)
  const { raw } = await issue(
    db,
    cfg,
    userId,
    crypto.randomUUID(),
    familyExpiresAt
  )
  return raw
}

const revokeFamily = (db: Kysely<DB>, familyId: string, at: Date) =>
  db
    .updateTable('refresh_tokens')
    .set({ revoked_at: at })
    .where('family_id', '=', familyId)
    .where('revoked_at', 'is', null)
    .execute()

interface PresentedToken {
  readonly user_id: string
  readonly family_id: string
  readonly expires_at: Date
  readonly family_expires_at: Date
  readonly revoked_at: Date | null
  readonly replaced_by: string | null
  readonly deleted_at: Date | null
}

/**
 * A tolerância do token anterior: só para um token revogado por rotação
 * (`replaced_by`), há no máximo REFRESH_REUSE_GRACE_MS, ainda válido, cujo
 * sucessor S nunca foi usado nem revogado. S é revogado sem `replaced_by`
 * (nunca entra na tolerância: apresentá-lo depois revoga a família), e o
 * novo token herda a `family_expires_at` e não vive mais que S. O
 * `replaced_by` do anterior continua S: uma segunda apresentação encontra S
 * revogado e cai na detecção de reuso. Chamada com o anterior travado; trava
 * S também (`FOR UPDATE`), então duas apresentações simultâneas não ganham
 * as duas. null quando não se aplica.
 */
async function reuseWithinGrace(
  trx: Kysely<DB>,
  cfg: SessionConfig,
  row: PresentedToken,
  now: Date
): Promise<{ userId: string; refreshToken: string } | null> {
  if (row.revoked_at === null || row.replaced_by === null) return null
  const elapsed = now.getTime() - row.revoked_at.getTime()
  if (elapsed < 0 || elapsed > REFRESH_REUSE_GRACE_MS) return null
  if (
    row.deleted_at !== null ||
    row.expires_at <= now ||
    row.family_expires_at <= now
  )
    return null
  const successor = await trx
    .selectFrom('refresh_tokens')
    .select(['id', 'family_id', 'expires_at', 'revoked_at'])
    .where('id', '=', row.replaced_by)
    .forUpdate()
    .executeTakeFirst()
  if (
    !successor ||
    successor.family_id !== row.family_id ||
    successor.revoked_at !== null ||
    successor.expires_at <= now
  )
    return null
  const next = await issue(
    trx,
    cfg,
    row.user_id,
    row.family_id,
    row.family_expires_at,
    successor.expires_at
  )
  await trx
    .updateTable('refresh_tokens')
    .set({ revoked_at: now })
    .where('id', '=', successor.id)
    .execute()
  // Mensagem fixa e só o tipo do evento: sem token, hash, id nem PII
  logger.info({ event: 'auth.refresh_grace' }, 'refresh dentro da tolerância')
  return { userId: row.user_id, refreshToken: next.raw }
}

/**
 * Troca o refresh token por um novo da mesma família. null quando o token
 * não existe, expirou, foi revogado ou o usuário foi excluído; reuso de um
 * token já trocado revoga a família, fora da tolerância (reuseWithinGrace).
 */
export async function rotateSession(
  db: Kysely<DB>,
  cfg: SessionConfig,
  raw: string
): Promise<{ userId: string; refreshToken: string } | null> {
  if (raw.length > 200) return null
  const now = cfg.now()
  const hash = sha256(raw)
  return db.transaction().execute(async trx => {
    // Trava a pessoa antes de qualquer token: toda rotação dela segue a mesma
    // ordem (pessoa, token apresentado, sucessor). Sem isso, o token anterior
    // e o sucessor apresentados juntos travavam um o token do outro
    // (deadlock), porque o join abaixo trava o token e a pessoa nessa ordem
    await trx
      .selectFrom('users')
      .select('id')
      .where(
        'id',
        '=',
        trx
          .selectFrom('refresh_tokens')
          .select('user_id')
          .where('token_hash', '=', hash)
      )
      .forUpdate()
      .execute()
    const row = await trx
      .selectFrom('refresh_tokens')
      .innerJoin('users', 'users.id', 'refresh_tokens.user_id')
      .select([
        'refresh_tokens.id',
        'refresh_tokens.user_id',
        'refresh_tokens.family_id',
        'refresh_tokens.expires_at',
        'refresh_tokens.family_expires_at',
        'refresh_tokens.revoked_at',
        'refresh_tokens.replaced_by',
        'users.deleted_at',
      ])
      .where('refresh_tokens.token_hash', '=', hash)
      .forUpdate()
      .executeTakeFirst()
    if (!row) return null
    if (row.revoked_at !== null) {
      const grace = await reuseWithinGrace(trx, cfg, row, now)
      if (grace) return grace
      await revokeFamily(trx, row.family_id, now)
      return null
    }
    if (
      row.deleted_at !== null ||
      row.expires_at <= now ||
      row.family_expires_at <= now
    )
      return null
    const next = await issue(
      trx,
      cfg,
      row.user_id,
      row.family_id,
      row.family_expires_at
    )
    await trx
      .updateTable('refresh_tokens')
      .set({ revoked_at: now, replaced_by: next.id })
      .where('id', '=', row.id)
      .execute()
    return { userId: row.user_id, refreshToken: next.raw }
  })
}

/** Logout: revoga a família do token (todas as trocas daquele login). */
export async function revokeSession(
  db: Kysely<DB>,
  cfg: SessionConfig,
  raw: string
): Promise<void> {
  if (raw.length > 200) return
  const row = await db
    .selectFrom('refresh_tokens')
    .select('family_id')
    .where('token_hash', '=', sha256(raw))
    .executeTakeFirst()
  if (row) await revokeFamily(db, row.family_id, cfg.now())
}
