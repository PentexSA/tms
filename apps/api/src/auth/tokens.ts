import { jwtVerify, SignJWT } from 'jose'

// JWT de acesso: HS256 fixado (o verificador recusa qualquer outro `alg`,
// inclusive `none`), com exp, iss, aud, sub e jti. Vive só em memória no app.

export interface TokenConfig {
  readonly secret: Uint8Array
  readonly issuer: string
  readonly audience: string
  readonly ttlSeconds: number
  readonly now: () => Date
}

const ALG = 'HS256'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

export function signAccessToken(cfg: TokenConfig, userId: string) {
  const now = Math.floor(cfg.now().getTime() / 1000)
  return new SignJWT({})
    .setProtectedHeader({ alg: ALG, typ: 'JWT' })
    .setSubject(userId)
    .setIssuer(cfg.issuer)
    .setAudience(cfg.audience)
    .setIssuedAt(now)
    .setExpirationTime(now + cfg.ttlSeconds)
    .setJti(crypto.randomUUID())
    .sign(cfg.secret)
}

/** O id do usuário do token, ou null para qualquer token que não seja válido. */
export async function verifyAccessToken(
  cfg: TokenConfig,
  token: string
): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, cfg.secret, {
      algorithms: [ALG],
      issuer: cfg.issuer,
      audience: cfg.audience,
      typ: 'JWT',
      currentDate: cfg.now(),
      requiredClaims: ['sub', 'iat', 'exp', 'jti'],
    })
    return typeof payload.sub === 'string' && UUID.test(payload.sub)
      ? payload.sub
      : null
  } catch {
    return null
  }
}
