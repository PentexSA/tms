import { createHash } from 'node:crypto'
import type { DB } from '@tms/db'
import type { Kysely } from 'kysely'

// Refresh tokens opacos (32 bytes aleatórios), guardados só como SHA-256.
// Cada uso troca o token (rotação); reusar um token já trocado revoga a
// família inteira, porque só acontece se alguém copiou o token. O app faz um
// refresh por vez (single-flight) para nunca disparar isso sozinho.

export interface SessionConfig {
  readonly now: () => Date
  // Validade de cada token e limite absoluto da sessão (família).
  readonly refreshTtlMs: number
  readonly familyTtlMs: number
}

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
  familyExpiresAt: Date
): Promise<{ id: string; raw: string }> {
  const raw = newRefreshToken()
  const now = cfg.now().getTime()
  const expiresAt = new Date(
    Math.min(now + cfg.refreshTtlMs, familyExpiresAt.getTime())
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

/**
 * Troca o refresh token por um novo da mesma família. null quando o token
 * não existe, expirou, foi revogado ou o usuário foi excluído; reuso de um
 * token já trocado revoga a família.
 */
export async function rotateSession(
  db: Kysely<DB>,
  cfg: SessionConfig,
  raw: string
): Promise<{ userId: string; refreshToken: string } | null> {
  if (raw.length > 200) return null
  const now = cfg.now()
  return db.transaction().execute(async trx => {
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
        'users.deleted_at',
      ])
      .where('refresh_tokens.token_hash', '=', sha256(raw))
      .forUpdate()
      .executeTakeFirst()
    if (!row) return null
    if (row.revoked_at !== null) {
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
